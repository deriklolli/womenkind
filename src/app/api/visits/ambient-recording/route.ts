import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/visits/ambient-recording
 *
 * Called by AmbientRecorder after uploading audio to Supabase Storage.
 * Creates an encounter_note record and submits the audio to AssemblyAI
 * for transcription — same pipeline as the telehealth recording webhook.
 *
 * Body: { patientId, providerId, recordingUrl, recordingStoragePath }
 */
export async function POST(req: NextRequest) {
  try {
    const { patientId, providerId, recordingUrl, recordingStoragePath } = await req.json()

    if (!patientId || !providerId || !recordingUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Create encounter note in 'transcribing' state
    const { data: note, error: noteErr } = await supabase
      .from('encounter_notes')
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        source: 'in_office',
        recording_url: recordingUrl,
        recording_storage_path: recordingStoragePath || null,
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
      console.warn('[ambient-recording] ASSEMBLYAI_API_KEY not set — saving without transcription')
      await supabase.from('encounter_notes').update({ status: 'failed' }).eq('id', note.id)
      return NextResponse.json({ noteId: note.id })
    }

    // Build webhook URL — fall back to production domain if env var not set
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.womenkindhealth.com'
    ).replace(/\/+$/, '')
    const webhookUrl = `${appUrl}/api/visits/webhook/transcription`

    const assemblyPayload = {
      audio_url: recordingUrl,
      speech_model: 'universal-2',
      speaker_labels: true,
      speakers_expected: 2,
      webhook_url: webhookUrl,
      ...(process.env.WEBHOOK_SECRET
        ? {
            webhook_auth_header_name: 'x-webhook-secret',
            webhook_auth_header_value: process.env.WEBHOOK_SECRET,
          }
        : {}),
    }

    console.log(`[ambient-recording] Submitting to AssemblyAI, webhook: ${webhookUrl}`)

    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        Authorization: assemblyKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assemblyPayload),
    })

    if (!transcriptRes.ok) {
      const errText = await transcriptRes.text()
      console.error(`[ambient-recording] AssemblyAI submit failed (HTTP ${transcriptRes.status}):`, errText)
      await supabase.from('encounter_notes').update({ status: 'failed' }).eq('id', note.id)
      return NextResponse.json({ error: 'Transcription submit failed', detail: errText }, { status: 502 })
    }

    const transcriptData = await transcriptRes.json()

    // Store the AssemblyAI transcript ID for webhook matching
    await supabase
      .from('encounter_notes')
      .update({ assemblyai_transcript_id: transcriptData.id })
      .eq('id', note.id)

    console.log(`[ambient-recording] Transcription submitted for note ${note.id}, transcript ${transcriptData.id}`)
    return NextResponse.json({ noteId: note.id })
  } catch (err: any) {
    console.error('[ambient-recording] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
