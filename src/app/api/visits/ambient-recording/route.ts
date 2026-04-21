import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { logPhiAccess } from '@/lib/phi-audit'
import { getServerSession } from '@/lib/getServerSession'
import { getDownloadUrl } from '@/lib/s3'


function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/visits/ambient-recording
 *
 * 1. Creates encounter_note record
 * 2. Generates a pre-signed S3 GET URL for the recording
 * 3. Submits transcript job to AssemblyAI pointing at the S3 URL
 *
 * Body: { patientId, providerId, recordingStoragePath }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { patientId, providerId, recordingStoragePath } = await req.json()

    if (!patientId || !providerId || !recordingStoragePath) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the request is acting on behalf of the authenticated provider
    if (providerId !== session.providerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = getSupabase()

    // Create encounter note in 'transcribing' state
    const { data: note, error: noteErr } = await supabase
      .from('encounter_notes')
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        source: 'in_office',
        recording_storage_path: recordingStoragePath,
        status: 'transcribing',
      })
      .select('id')
      .single()

    if (noteErr || !note) {
      console.error('[ambient-recording] Failed to create encounter note:', noteErr)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    const assemblyKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyKey) {
      console.warn('[ambient-recording] ASSEMBLYAI_API_KEY not set')
      await supabase.from('encounter_notes').update({ status: 'failed' }).eq('id', note.id)
      return NextResponse.json({ noteId: note.id })
    }

    // ── Step 1: Generate pre-signed S3 GET URL for AssemblyAI ────────────
    let audioUrl: string
    try {
      audioUrl = await getDownloadUrl(recordingStoragePath)
    } catch (err) {
      console.error('[ambient-recording] Failed to create S3 signed URL:', err)
      await supabase.from('encounter_notes').update({ status: 'failed' }).eq('id', note.id)
      return NextResponse.json({ error: 'Could not generate audio URL' }, { status: 500 })
    }

    console.log('[ambient-recording] S3 pre-signed URL created')

    // ── Step 2: Submit transcript job directly with signed URL ─────────────
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.womenkindhealth.com'
    ).replace(/\/+$/, '')
    const webhookUrl = `${appUrl}/api/visits/webhook/transcription`

    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        Authorization: assemblyKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speech_models: ['universal-2'],
        speaker_labels: true,
        speakers_expected: 2,
        webhook_url: webhookUrl,
        ...(process.env.WEBHOOK_SECRET
          ? {
              webhook_auth_header_name: 'x-webhook-secret',
              webhook_auth_header_value: process.env.WEBHOOK_SECRET,
            }
          : {}),
      }),
    })

    if (!transcriptRes.ok) {
      const errText = await transcriptRes.text()
      console.error(`[ambient-recording] AssemblyAI transcript submit failed (HTTP ${transcriptRes.status}):`, errText)
      await supabase.from('encounter_notes').update({ status: 'failed' }).eq('id', note.id)
      return NextResponse.json({ error: 'Transcription submit failed', detail: errText }, { status: 502 })
    }

    const transcriptData = await transcriptRes.json()
    await supabase
      .from('encounter_notes')
      .update({ assemblyai_transcript_id: transcriptData.id })
      .eq('id', note.id)

    logPhiAccess({ providerId, patientId, recordType: 'encounter_note', recordId: note.id, action: 'create', route: '/api/visits/ambient-recording', req })
    console.log(`[ambient-recording] Transcription submitted. Note: ${note.id}, Transcript: ${transcriptData.id}`)
    return NextResponse.json({ noteId: note.id })
  } catch (err: any) {
    console.error('[ambient-recording] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
