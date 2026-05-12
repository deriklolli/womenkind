import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { eq, isNull, gte, lte, and } from 'drizzle-orm'
import { Resend } from 'resend'
import { buildEngagementEmail } from '@/lib/engagement'

/**
 * POST /api/reminders/appointments
 *
 * Called by Vercel Cron every hour.
 * Finds confirmed appointments starting in 23.5–24.5 hours and sends
 * a reminder email to the patient if one hasn't been sent already.
 */
export async function POST(req: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

  // Window: 23.5 to 24.5 hours from now
  const now = new Date()
  const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000)

  const appts = await db.query.appointments.findMany({
    where: and(
      eq(appointments.status, 'confirmed'),
      isNull(appointments.reminder_sent_at),
      gte(appointments.starts_at, windowStart),
      lte(appointments.starts_at, windowEnd)
    ),
    with: {
      appointment_types: true,
      patients: {
        with: { profiles: true },
      },
    },
  })

  if (!appts.length) {
    return NextResponse.json({ sent: 0 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)
  const from = process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>'
  let sent = 0

  for (const appointment of appts) {
    const profile = appointment.patients?.profiles
    const patientEmail = profile?.email
    if (!patientEmail) continue

    const firstName = profile.first_name || 'there'
    const typeName = appointment.appointment_types?.name || 'Appointment'
    const durationMinutes = appointment.appointment_types?.duration_minutes || 0
    const videoRoomUrl = appointment.video_room_url

    const start = appointment.starts_at
    const end = appointment.ends_at

    const dateStr = start.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Denver',
    })
    const startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Denver',
    })
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Denver',
    })

    try {
      await resend.emails.send({
        from,
        to: patientEmail,
        subject: `Your appointment is tomorrow`,
        html: buildEngagementEmail({
          heading: `See you tomorrow, ${firstName}`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
              Just a reminder that your appointment is coming up.
            </p>
            <div style="background-color: #f7f3ee; border-radius: 12px; padding: 24px;">
              <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">${typeName}</p>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #a1958f;">${durationMinutes} min</p>
              <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${dateStr}</p>
              <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${startTime} – ${endTime} MT</p>
              ${videoRoomUrl ? `<p style="margin: 0; font-size: 14px; color: #280f49;">Virtual visit via video call</p>` : ''}
            </div>
          `,
          ctaText: videoRoomUrl ? 'Join Video Call' : 'View Your Dashboard',
          ctaUrl: videoRoomUrl || `${appUrl}/patient/dashboard`,
          secondaryCtaText: videoRoomUrl ? 'or view your dashboard' : undefined,
          secondaryCtaUrl: videoRoomUrl ? `${appUrl}/patient/dashboard` : undefined,
          patientId: appointment.patient_id,
        }),
      })

      // Mark reminder sent so we don't send it again
      await db
        .update(appointments)
        .set({ reminder_sent_at: new Date() })
        .where(eq(appointments.id, appointment.id))

      sent++
      console.log(`[REMINDERS] Sent reminder to ${patientEmail} for appointment ${appointment.id}`)
    } catch (emailErr) {
      console.error(`[REMINDERS] Failed to send reminder for appointment ${appointment.id}:`, emailErr)
    }
  }

  return NextResponse.json({ sent })
}
