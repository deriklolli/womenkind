import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments, encounter_notes, patients, providers, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// A real public audio file with spoken English — AssemblyAI will transcribe it
const TEST_AUDIO_URL =
  'https://github.com/AssemblyAI-Examples/audio-examples/raw/main/20230607_me_canadian_wildfires.mp3'

/**
 * POST /api/debug/inject-test-recording
 *
 * Submits a public test audio to AssemblyAI and creates an encounter note,
 * exercising the full transcription → Bedrock SOAP note → provider email pipeline
 * without needing a real Daily video call or a pre-existing appointment.
 *
 * Body (all optional):
 *   appointmentId  — use an existing appointment; if omitted, one is created
 *   patientEmail   — for auto-created appointment (default: dlolli@gmail.com)
 *   providerEmail  — for auto-created appointment (default: josephurbanmd@gmail.com)
 */
export async function POST(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com'
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  const webhookSecret = process.env.WEBHOOK_SECRET

  if (!apiKey) return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not set' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  let appointmentId: string = body.appointmentId

  let patientId: string
  let providerId: string

  if (appointmentId) {
    const appt = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
      columns: { id: true, patient_id: true, provider_id: true },
    })
    if (!appt) return NextResponse.json({ error: `Appointment not found: ${appointmentId}` }, { status: 404 })
    patientId = appt.patient_id
    providerId = appt.provider_id
  } else {
    // Auto-create a test appointment so the endpoint is fully self-contained
    const patientEmail: string = body.patientEmail || 'dlolli@gmail.com'
    const providerEmail: string = body.providerEmail || 'josephurbanmd@gmail.com'

    const providerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.email, providerEmail),
      columns: { id: true },
    })
    if (!providerProfile) return NextResponse.json({ error: `Provider not found: ${providerEmail}` }, { status: 404 })
    const provider = await db.query.providers.findFirst({
      where: eq(providers.profile_id, providerProfile.id),
      columns: { id: true },
    })
    if (!provider) return NextResponse.json({ error: 'Provider record not found' }, { status: 404 })

    const patientProfile = await db.query.profiles.findFirst({
      where: eq(profiles.email, patientEmail),
      columns: { id: true },
    })
    if (!patientProfile) return NextResponse.json({ error: `Patient not found: ${patientEmail}` }, { status: 404 })
    const patient = await db.query.patients.findFirst({
      where: eq(patients.profile_id, patientProfile.id),
      columns: { id: true },
    })
    if (!patient) return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })

    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)
    const [appt] = await db
      .insert(appointments)
      .values({ provider_id: provider.id, patient_id: patient.id, status: 'confirmed', starts_at: startsAt, ends_at: endsAt })
      .returning({ id: appointments.id })

    appointmentId = appt.id
    patientId = patient.id
    providerId = provider.id
  }

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
      patient_id: patientId,
      provider_id: providerId,
      appointment_id: appointmentId,
      source: 'telehealth',
      status: 'transcribing',
      assemblyai_transcript_id: transcriptId,
    })
    .returning({ id: encounter_notes.id })

  return NextResponse.json({
    noteId: note.id,
    transcriptId,
    appointmentId,
    message: `Audio submitted to AssemblyAI (transcript ${transcriptId}). Encounter note created with status=transcribing. Expect status → draft in 2–5 minutes when the transcription webhook fires.`,
    monitorUrl: `${appUrl}/api/debug/poll-note-status?noteId=${note.id}`,
  })
}
