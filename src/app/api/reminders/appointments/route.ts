import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

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

  const supabase = getServiceSupabase()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

  // Window: 23.5 to 24.5 hours from now
  const now = new Date()
  const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000)

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      starts_at,
      ends_at,
      video_room_url,
      reminder_sent_at,
      appointment_types(name, duration_minutes),
      patients(id, profiles(first_name, last_name, email))
    `)
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('starts_at', windowStart.toISOString())
    .lte('starts_at', windowEnd.toISOString())

  if (error) {
    console.error('[REMINDERS] Failed to fetch appointments:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!appointments?.length) {
    return NextResponse.json({ sent: 0 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)
  const from = process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>'
  let sent = 0

  for (const appointment of appointments) {
    const profile = (appointment as any).patients?.profiles
    const patientEmail = profile?.email
    if (!patientEmail) continue

    const firstName = profile.first_name || 'there'
    const typeName = (appointment as any).appointment_types?.name || 'Appointment'
    const durationMinutes = (appointment as any).appointment_types?.duration_minutes || 0
    const videoRoomUrl = appointment.video_room_url

    const start = new Date(appointment.starts_at)
    const end = new Date(appointment.ends_at)

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
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body bgcolor="#f7f3ee" style="margin: 0; padding: 0; background-color: #f7f3ee; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee;">
    <tr>
      <td align="center" style="padding: 48px 24px 40px 24px;">
        <img src="${appUrl}/womenkind-logo-dark.png" alt="Womenkind" style="height: 96px;" />
      </td>
    </tr>
    <tr>
      <td align="center">
        <table role="presentation" width="610" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 610px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 36px 32px 36px;">
              <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: normal; font-family: Georgia, 'Playfair Display', serif; color: #280f49;">
                See you tomorrow, ${firstName}
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
                Just a reminder that your appointment is coming up.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">
                      ${typeName}
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #a1958f;">
                      ${durationMinutes} min
                    </p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${dateStr}</p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${startTime} – ${endTime} MT</p>
                    ${videoRoomUrl ? `<p style="margin: 0; font-size: 14px; color: #280f49;">Virtual visit via video call</p>` : ''}
                  </td>
                </tr>
              </table>
              ${videoRoomUrl ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="${videoRoomUrl}" style="display: inline-block; padding: 14px 32px; background-color: #944fed; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
                      Join Video Call
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 12px;">
                    <a href="${appUrl}/patient/dashboard" style="font-size: 13px; color: #944fed; text-decoration: none;">
                      or view your dashboard
                    </a>
                  </td>
                </tr>
              </table>
              ` : `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/patient/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #944fed; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
                      View Your Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              `}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 32px 24px 48px 24px;">
        <p style="margin: 0; font-size: 12px; color: #bdb4b1;">
          Womenkind &mdash; Personalized menopause &amp; midlife care
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      })

      // Mark reminder sent so we don't send it again
      await supabase
        .from('appointments')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', appointment.id)

      sent++
      console.log(`[REMINDERS] Sent reminder to ${patientEmail} for appointment ${appointment.id}`)
    } catch (emailErr) {
      console.error(`[REMINDERS] Failed to send reminder for appointment ${appointment.id}:`, emailErr)
    }
  }

  return NextResponse.json({ sent })
}
