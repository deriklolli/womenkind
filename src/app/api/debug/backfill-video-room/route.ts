import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments, appointment_types } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createVideoRoom } from '@/lib/daily-video'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { appointmentId } = await req.json()
  if (!appointmentId) {
    return NextResponse.json({ error: 'appointmentId required' }, { status: 400 })
  }

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    with: { appointment_types: { columns: { name: true } } },
    columns: { id: true, starts_at: true, ends_at: true, video_room_url: true },
  })

  if (!appt) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  if (appt.video_room_url) {
    return NextResponse.json({ ok: true, already_set: true, video_room_url: appt.video_room_url })
  }

  const videoRoom = await createVideoRoom({
    appointmentId: appt.id,
    appointmentName: (appt as any).appointment_types?.name ?? 'Visit',
    startsAt: appt.starts_at.toISOString(),
    endsAt: appt.ends_at.toISOString(),
  })

  if (!videoRoom) {
    return NextResponse.json({ error: 'Daily room creation failed' }, { status: 500 })
  }

  await db
    .update(appointments)
    .set({ video_room_url: videoRoom.url, video_room_name: videoRoom.roomName })
    .where(eq(appointments.id, appt.id))

  return NextResponse.json({ ok: true, video_room_url: videoRoom.url, room_name: videoRoom.roomName })
}
