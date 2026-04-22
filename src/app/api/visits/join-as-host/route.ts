import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createProviderMeetingToken } from '@/lib/daily-video'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session || session.role !== 'provider') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const appointmentId = req.nextUrl.searchParams.get('appointmentId')
  if (!appointmentId) {
    return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 })
  }

  const apt = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    columns: { video_room_url: true, video_room_name: true, ends_at: true },
  })

  if (!apt?.video_room_url || !apt.video_room_name) {
    return NextResponse.json({ error: 'No video room for this appointment' }, { status: 404 })
  }

  const token = await createProviderMeetingToken({
    roomName: apt.video_room_name,
    endsAt: apt.ends_at instanceof Date ? apt.ends_at.toISOString() : String(apt.ends_at),
  })

  const joinUrl = token
    ? `${apt.video_room_url}?t=${token}`
    : apt.video_room_url

  return NextResponse.redirect(joinUrl)
}
