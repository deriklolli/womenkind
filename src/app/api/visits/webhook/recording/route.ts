import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/visits/webhook/recording
 *
 * Daily.co calls this when a cloud recording is ready.
 * We look up the appointment, create an encounter_note record,
 * then submit the audio to AssemblyAI for transcription.
 *
 * Configure this URL in the Daily.co dashboard under:
 *   Developers → Webhooks → Add endpoint
 *   Events: recording-ready
 *
 * Daily.co webhook payload (recording-ready):
 * {
 *   event_type: 'recording-ready',
 *   payload: {
 *     room_name: 'wk-xxxxxxxx',
 *     recording_id: '...',
 *     duration: 1234,           // seconds
 *     s3_key: '...',
 *     s3_url: 'https://...',    // direct download URL
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Only handle recording-ready events
    if (body.event_type !== 'recording-ready') {
      return NextResponse.json({ ok: true })
    }

    const { room_name, s3_url, duration } = body.payload || {}

    if (!room_name || !s3_url) {
      console.error('[recording-webhook] Missing room_name or s3_url', body)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Skip very short recordings (< 30 seconds — likely test joins)
    if (duration && duration < 30) {
      console.log(`[recording-webhook] Skipping short recording (${duration}s) for room ${room_name}`)
      return NextResponse.json({ ok: true })
    }

    const supabase = getSupabase()

    // Look up the appointment by room name
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, patient_id, provider_id, starts_at')
      .eq('video_room_name', room_name)
      .maybeSingle()

    if (!appointment) {
      console.error(`[recording-webhook] No appointment found for room: ${room_name}`)
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Create encounter note in 'transcribing' state
    const { data: note, error: noteErr } = await supabase
      .from('encounter_notes')
      .insert({
        patient_id: appointment.patient_id,
        provider_id: appointment.provider_id,
        appointment_id: appointment.id,
        source: 'telehealth',
        recording_url: s3_url,
        status: 'transcribing',
      })
      .select('id')
      .single()

    if (noteErr || !note) {
      console.error('[recording-webhook] Failed to create encounter note:', noteErr)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Submit to AssemblyAI for transcription
    const assemblyKey = process.env.ASSEMBLYAI_API_KEY
    if (!assemblyKey) {
      console.warn('[recording-webhook] ASSEMBLYAI_API_KEY not set — skipping transcription')
      await supabase
        .from('encounter_notes')
        .update({ status: 'failed' })
        .eq('id', note.id)
      return NextResponse.json({ ok: true })
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com').replace(/\/+$/, '')
    const webhookUrl = `${appUrl}/api/visits/webhook/transcription`

    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        Authorization: assemblyKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: s3_url,
        speech_models: ['universal-2'],
        speaker_labels: true,
        speakers_expected: 2,
        // Callback when transcription is complete
        webhook_url: webhookUrl,
        webhook_auth_header_name: 'x-webhook-secret',
        webhook_auth_header_value: process.env.WEBHOOK_SECRET || '',
      }),
    })

    if (!transcriptRes.ok) {
      const err = await transcriptRes.text()
      console.error('[recording-webhook] AssemblyAI submit failed:', err)
      await supabase
        .from('encounter_notes')
        .update({ status: 'failed' })
        .eq('id', note.id)
      return NextResponse.json({ error: 'Transcription submit failed' }, { status: 502 })
    }

    const transcriptData = await transcriptRes.json()

    // Store the AssemblyAI transcript ID so we can match it when the callback arrives
    await supabase
      .from('encounter_notes')
      .update({ assemblyai_transcript_id: transcriptData.id })
      .eq('id', note.id)

    console.log(`[recording-webhook] Transcription submitted for note ${note.id}, transcript ${transcriptData.id}`)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[recording-webhook] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
