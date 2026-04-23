import { timingSafeEqual } from 'crypto'

export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { logPhiAccess } from '@/lib/phi-audit'
import { invokeModel } from '@/lib/bedrock'
import { db } from '@/lib/db'
import { encounter_notes, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/visits/webhook/transcription
 *
 * AssemblyAI calls this when transcription is complete.
 * We fetch the full transcript, send it to Claude to generate
 * a SOAP note, save the draft, then notify the provider.
 *
 * AssemblyAI webhook payload:
 * { transcript_id: '...', status: 'completed' | 'error' }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret (only enforced when WEBHOOK_SECRET is configured)
    const expected = process.env.WEBHOOK_SECRET
    if (expected) {
      const secret = req.headers.get('x-webhook-secret')
      if (!secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      try {
        const secretBuf = Buffer.from(secret)
        const expectedBuf = Buffer.from(expected)
        if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
      } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const { transcript_id, status } = body

    if (!transcript_id) {
      return NextResponse.json({ error: 'Missing transcript_id' }, { status: 400 })
    }

    // Find the encounter note by AssemblyAI transcript ID
    const note = await db.query.encounter_notes.findFirst({
      where: eq(encounter_notes.assemblyai_transcript_id, transcript_id),
      columns: { id: true, patient_id: true, provider_id: true },
    })

    if (!note) {
      console.error(`[transcription-webhook] No note found for transcript: ${transcript_id}`)
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Handle failed transcription
    if (status === 'error') {
      await db.update(encounter_notes).set({ status: 'failed' }).where(eq(encounter_notes.id, note.id))
      console.error(`[transcription-webhook] Transcription failed for ${transcript_id}`)
      return NextResponse.json({ ok: true })
    }

    if (status !== 'completed') {
      // Still processing — AssemblyAI sometimes sends intermediate webhooks
      return NextResponse.json({ ok: true })
    }

    const assemblyKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyKey) {
      console.error('[transcription-webhook] ASSEMBLYAI_API_KEY not set')
      return NextResponse.json({ ok: true })
    }

    // Fetch the full transcript from AssemblyAI
    const transcriptRes = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcript_id}`,
      { headers: { Authorization: assemblyKey } }
    )

    if (!transcriptRes.ok) {
      console.error('[transcription-webhook] Failed to fetch transcript from AssemblyAI')
      await db.update(encounter_notes).set({ status: 'failed' }).where(eq(encounter_notes.id, note.id))
      return NextResponse.json({ ok: true })
    }

    const transcriptData = await transcriptRes.json()

    // Build a readable transcript with speaker labels
    const fullTranscript = buildLabeledTranscript(transcriptData)

    // Save raw transcript
    await db.update(encounter_notes).set({ transcript: fullTranscript }).where(eq(encounter_notes.id, note.id))

    // Generate SOAP note with Bedrock
    const soapNote = await generateSoapNote(fullTranscript)

    // Save the structured SOAP note as a draft
    await db.update(encounter_notes).set({
      chief_complaint: soapNote.chief_complaint,
      hpi: soapNote.hpi,
      ros: soapNote.ros,
      assessment: soapNote.assessment,
      plan: soapNote.plan,
      status: 'draft',
      recording_url: null,
    }).where(eq(encounter_notes.id, note.id))

    logPhiAccess({ providerId: note.provider_id, patientId: note.patient_id, recordType: 'encounter_note', recordId: note.id, action: 'transcribe', route: '/api/visits/webhook/transcription' })
    console.log(`[transcription-webhook] SOAP note draft saved for note ${note.id}`)

    // HIPAA: Delete the transcript from AssemblyAI's servers now that we have
    // the data archived in our own DB. Fire-and-forget — deletion failure should
    // not block the response or alert the patient/provider.
    fetch(`https://api.assemblyai.com/v2/transcript/${transcript_id}`, {
      method: 'DELETE',
      headers: { Authorization: assemblyKey },
    }).catch((e) =>
      console.error('[transcription-webhook] AssemblyAI transcript deletion failed:', e)
    )

    // Notify the provider
    await notifyProvider(note.provider_id, note.patient_id, note.id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[transcription-webhook] Unhandled error:', err)
    return NextResponse.json({ ok: true })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildLabeledTranscript(transcriptData: any): string {
  if (!transcriptData.utterances?.length) {
    return transcriptData.text || ''
  }

  return transcriptData.utterances
    .map((u: any) => {
      const speaker = u.speaker === 'A' ? 'Provider' : 'Patient'
      return `${speaker}: ${u.text}`
    })
    .join('\n\n')
}

async function generateSoapNote(transcript: string): Promise<{
  chief_complaint: string
  hpi: string
  ros: string
  assessment: string
  plan: string
}> {
  const text = await invokeModel({
    maxTokens: 4096,
    system: `You are a clinical documentation specialist for Womenkind, a telehealth menopause care platform.
Your task is to generate a structured SOAP note from a clinical visit transcript.

Guidelines:
- Write in standard clinical documentation style
- Be specific and use the patient's own words where clinically relevant
- Focus on menopause-related symptoms, treatments, and management
- Assessment should include clinical reasoning, not just a list
- Plan should be actionable and specific
- Do not fabricate information not present in the transcript
- Return ONLY a JSON object, no markdown`,
    messages: [
      {
        role: 'user',
        content: `Generate a SOAP note from this clinical visit transcript. Return ONLY a JSON object.

TRANSCRIPT:
${transcript}

Return this exact JSON structure:
{
  "chief_complaint": "Primary reason for visit in 1-2 sentences",
  "hpi": "History of present illness — detailed narrative of symptoms, onset, duration, severity, modifying factors",
  "ros": "Review of systems — pertinent positives and negatives discussed during the visit",
  "assessment": "Clinical assessment including differential considerations and working diagnosis",
  "plan": "Treatment plan including medications, follow-up, labs ordered, patient education, and next steps"
}`,
      },
    ],
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) throw new Error('Failed to extract JSON from Bedrock SOAP note response')
    parsed = JSON.parse(jsonMatch[0])
  }

  const required = ['chief_complaint', 'hpi', 'ros', 'assessment', 'plan'] as const
  const missing = required.filter(k => !parsed[k] || typeof parsed[k] !== 'string' || !(parsed[k] as string).trim())
  if (missing.length > 0) {
    throw new Error(`SOAP note missing required fields: ${missing.join(', ')}`)
  }

  return parsed as { chief_complaint: string; hpi: string; ros: string; assessment: string; plan: string }
}

async function notifyProvider(
  providerId: string,
  patientId: string,
  noteId: string
) {
  const providerEmail = process.env.PROVIDER_EMAIL
  if (!providerEmail || !process.env.RESEND_API_KEY) return

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')

  // Get patient name via Drizzle
  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    with: { profiles: true },
  })

  const profile = (patient as any)?.profiles
  const patientName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : 'Your patient'

  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>'

  await resend.emails.send({
    from,
    to: providerEmail,
    subject: `Visit note ready to review — ${patientName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body bgcolor="#f7f3ee" style="margin:0;padding:0;background-color:#f7f3ee;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee">
    <tr>
      <td align="center" style="padding:48px 24px 40px 24px;">
        <img src="${appUrl}/womenkind-logo-dark.png" alt="Womenkind" style="height:96px;" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 24px 48px 24px;">
        <table role="presentation" width="610" cellpadding="0" cellspacing="0" bgcolor="#ffffff"
          style="max-width:610px;width:100%;background-color:#ffffff;border-radius:20px;border:1px solid #f2f1f4;">
          <tr>
            <td style="padding:48px 44px;">
              <h1 style="font-family:Georgia,serif;font-size:24px;color:#280f49;margin:0 0 8px 0;font-weight:normal;">
                Visit note ready to review
              </h1>
              <p style="font-size:14px;color:#7b6a62;line-height:1.7;margin:0 0 32px 0;">
                An AI-generated SOAP note from your visit with ${patientName} is ready. Review and sign it from the patient chart.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color:#944fed;border-radius:9999px;">
                          <a href="${appUrl}/provider/patient/${patientId}?tab=notes"
                            style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 32px;font-size:15px;font-weight:500;">
                            Review &amp; Sign Note &nbsp;&#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 24px 48px 24px;">
        <p style="font-size:12px;color:#d0cac7;margin:0;">Womenkind &mdash; Personalized menopause &amp; midlife care</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  })

  console.log(`[transcription-webhook] Provider notified at ${providerEmail}`)
}
