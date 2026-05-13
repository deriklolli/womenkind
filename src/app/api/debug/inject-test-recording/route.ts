import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments, encounter_notes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// A real public audio file with spoken English — AssemblyAI will transcribe it
const TEST_AUDIO_URL =
  'https://github.com/AssemblyAI-Examples/audio-examples/raw/main/20230607_me_canadian_wildfires.mp3'

/**
 * POST /api/debug/inject-test-recording
 *
 * Submits a public test audio to AssemblyAI and creates an encounter note,
 * exercising the full transcription → Bedrock SOAP note → provider email pipeline
 * without needing a real Daily video call.
 *
 * Body: { appointmentId: string }
 */
export async function POST(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com'
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  const webhookSecret = process.env.WEBHOOK_SECRET

  if (!apiKey) return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not set' }, { status: 500 })

  const { appointmentId } = await req.json().catch(() => ({}))
  if (!appointmentId) return NextResponse.json({ error: 'appointmentId required' }, { status: 400 })

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    columns: { id: true, patient_id: true, provider_id: true },
  })
  if (!appt) return NextResponse.json({ error: `Appointment not found: ${appointmentId}` }, { status: 404 })

  // Submit test audio to AssemblyAI
  const aaiBody: Record<string, unknown> = {
    audio_url: TEST_AUDIO_URL,
    speaker_labels: true,
    speakers_expected: 2,
    webhook_url: `${appUrl}/api/visits/webhook/transcription`,
  }
  if (webhookSecret) {
    aaiBody.webhook_auth_header_name = 'x-webhook-secret'
    aaiBody.webhook_auth_header_value = webhookSecret
  }

  const aaiRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(aaiBody),
  })
  if (!aaiRes.ok) {
    const err = await aaiRes.text()
    return NextResponse.json({ error: `AssemblyAI submission failed: ${err}` }, { status: 502 })
  }
  const { id: transcriptId } = await aaiRes.json()

  // Create encounter note (same shape as the recording webhook would create)
  const [note] = await db
    .insert(encounter_notes)
    .values({
      patient_id: appt.patient_id,
      provider_id: appt.provider_id,
      appointment_id: appt.id,
      source: 'telehealth',
      status: 'transcribing',
      assemblyai_transcript_id: transcriptId,
    })
    .returning({ id: encounter_notes.id })

  return NextResponse.json({
    noteId: note.id,
    transcriptId,
    appointmentId: appt.id,
    message: `Audio submitted to AssemblyAI (transcript ${transcriptId}). Encounter note created with status=transcribing. Expect status → draft in 2–5 minutes when the transcription webhook fires.`,
    monitorUrl: `${appUrl}/api/debug/poll-note-status?noteId=${note.id}`,
  })
}
