import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/scheduling/calendar-export?appointmentId=xxx
 *
 * Returns an .ics file for a patient to add an appointment to their calendar.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appointmentId = req.nextUrl.searchParams.get('appointmentId')

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
      with: {
        appointment_types: true,
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const typeName = appointment.appointment_types?.name || 'Appointment'
    const videoUrl = appointment.video_room_url

    // Format dates for iCal (YYYYMMDDTHHMMSSZ)
    const formatICalDate = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const dtStart = formatICalDate(appointment.starts_at.toISOString())
    const dtEnd = formatICalDate(appointment.ends_at.toISOString())
    const now = formatICalDate(new Date().toISOString())

    const description = [
      `${typeName} with Dr. Joseph Urban Jr.`,
      appointment.patient_notes ? `\\nNotes: ${appointment.patient_notes}` : '',
      videoUrl ? `\\n\\nJoin video call: ${videoUrl}` : '',
    ].join('')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Womenkind//Appointment//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${appointmentId}@womenkind.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${typeName} — Womenkind`,
      `DESCRIPTION:${description}`,
      'LOCATION:Virtual (video call)',
      videoUrl ? `URL:${videoUrl}` : '',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Appointment reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n')

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="womenkind-appointment.ics"`,
      },
    })
  } catch (err: any) {
    console.error('Calendar export error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
