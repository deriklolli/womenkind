import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments, providers, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { startCloudRecording } from '@/lib/daily-video'

/**
 * POST /api/debug/create-test-video-appointment
 *
 * Creates a test appointment with a Daily video room for testing
 * the video + transcription pipeline without needing calendar setup.
 *
 * Body (optional): { patientEmail, providerEmail }
 * Defaults: dlolli@gmail.com + josephurbanmd@gmail.com
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const patientEmail: string = body.patientEmail || 'dlolli@gmail.com'
    const providerEmail: string = body.providerEmail || 'josephurbanmd@gmail.com'

    // Look up provider
    const providerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.email, providerEmail),
      columns: { id: true },
    })
    if (!providerProfile) return NextResponse.json({ error: `Provider profile not found: ${providerEmail}` }, { status: 404 })

    const provider = await db.query.providers.findFirst({
      where: eq(providers.profile_id, providerProfile.id),
      columns: { id: true },
    })
    if (!provider) return NextResponse.json({ error: 'Provider record not found' }, { status: 404 })

    // Look up patient
    const patientProfile = await db.query.profiles.findFirst({
      where: eq(profiles.email, patientEmail),
      columns: { id: true },
    })
    if (!patientProfile) return NextResponse.json({ error: `Patient profile not found: ${patientEmail}` }, { status: 404 })

    const patient = await db.query.patients.findFirst({
      where: eq(patients.profile_id, patientProfile.id),
      columns: { id: true },
    })
    if (!patient) return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })

    // Create appointment: starts now, ends in 1 hour
    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000)

    const [appt] = await db.insert(appointments).values({
      provider_id: provider.id,
      patient_id: patient.id,
      status: 'confirmed',
      starts_at: startsAt,
      ends_at: endsAt,
    }).returning({ id: appointments.id })

    if (!appt) return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })

    // Create Daily video room (public so both test tabs can join without knocking)
    const room = await createTestVideoRoom(appt.id, endsAt)

    if (!room) return NextResponse.json({ error: 'Failed to create video room — check DAILY_API_KEY' }, { status: 500 })

    // Save room details to appointment
    await db.update(appointments).set({
      video_room_url: room.url,
      video_room_name: room.roomName,
    }).where(eq(appointments.id, appt.id))

    // Start cloud recording
    await startCloudRecording(room.roomName)

    return NextResponse.json({
      appointmentId: appt.id,
      videoRoomUrl: room.url,
      roomName: room.roomName,
      note: 'Join the room, have a conversation, then leave. Recording auto-stops when both participants leave. SOAP note will appear in the patient Notes tab within ~2 minutes.',
    })
  } catch (err: any) {
    console.error('[create-test-video-appointment]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function createTestVideoRoom(appointmentId: string, endsAt: Date) {
  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) return null
  const expiresAt = Math.floor(endsAt.getTime() / 1000) + 3600
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      name: `wk-test-${appointmentId.slice(0, 8)}`,
      privacy: 'public',
      properties: { exp: expiresAt, enable_chat: true, enable_recording: 'cloud' },
    }),
  })
  if (!res.ok) return null
  const room = await res.json()
  return { url: room.url as string, roomName: room.name as string }
}
