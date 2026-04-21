import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { cancelCalendarEvent } from '@/lib/google-calendar'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

async function sendCancellationEmail({
  toEmail,
  toName,
  canceledByName,
  appointmentName,
  durationMinutes,
  startsAt,
  endsAt,
}: {
  toEmail: string
  toName: string
  canceledByName: string
  appointmentName: string
  durationMinutes: number
  startsAt: string
  endsAt: string
}) {
  if (!process.env.RESEND_API_KEY || !toEmail) return

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const firstName = toName.split(' ')[0] || 'there'
  const start = new Date(startsAt)
  const end = new Date(endsAt)

  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Denver',
  })
  const startTime = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Denver',
  })
  const endTime = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Denver',
  })

  try {
    const resend = getResend()
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>',
      to: toEmail,
      subject: `Appointment Canceled — ${appointmentName}`,
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
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 36px 32px 36px;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #280f49;">
                Appointment Canceled
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
                Hi ${firstName}, your appointment has been canceled by ${canceledByName}.
              </p>

              <!-- Appointment card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #9487a4; text-decoration: line-through;">
                      ${appointmentName}
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #a1958f;">
                      ${durationMinutes} min
                    </p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #9487a4;">${dateStr}</p>
                    <p style="margin: 0; font-size: 14px; color: #9487a4;">${startTime} – ${endTime} MT</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/patient/schedule" style="display: inline-block; padding: 14px 32px; background-color: #944fed; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
                      Book a New Appointment
                    </a>
                  </td>
                </tr>
              </table>
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
    console.log(`[RESEND] Cancellation email sent to ${toEmail}`)
  } catch (emailErr) {
    console.error('[RESEND] Failed to send cancellation email:', emailErr)
  }
}

/**
 * POST /api/scheduling/cancel
 *
 * Cancel an appointment. Updates status, cancels Google Calendar event,
 * and emails the other party.
 *
 * Body: { appointmentId, reason?, canceledBy: 'patient' | 'provider' }
 */
export async function POST(req: NextRequest) {
  try {
    const { appointmentId, reason, canceledBy } = await req.json()

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    // Get the appointment with patient and provider info
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
      with: {
        appointment_types: true,
        patients: {
          with: { profiles: true },
        },
        providers: {
          with: { profiles: true },
        },
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (appointment.status === 'canceled') {
      return NextResponse.json({ error: 'Appointment is already canceled' }, { status: 400 })
    }

    // Cancel the appointment
    const [updated] = await db
      .update(appointments)
      .set({
        status: 'canceled',
        canceled_at: new Date(),
        provider_notes: reason
          ? `${appointment.provider_notes ? appointment.provider_notes + '\n' : ''}Cancellation reason: ${reason}`
          : appointment.provider_notes,
        updated_at: new Date(),
      })
      .where(eq(appointments.id, appointmentId))
      .returning()

    if (!updated) throw new Error('Failed to update appointment')

    // Cancel Google Calendar event if one exists
    if (appointment.google_calendar_event_id) {
      await cancelCalendarEvent(appointment.provider_id, appointment.google_calendar_event_id)
    }

    // Send cancellation email to the other party
    const patientProfile = appointment.patients?.profiles
    const patientName = patientProfile
      ? `${patientProfile.first_name || ''} ${patientProfile.last_name || ''}`.trim()
      : 'Patient'
    const patientEmail = patientProfile?.email

    const appointmentTypeName = appointment.appointment_types?.name || 'Appointment'
    const durationMinutes = appointment.appointment_types?.duration_minutes || 30

    // Build provider display name dynamically
    const providerProfile = appointment.providers?.profiles
    const providerDisplayName = providerProfile
      ? `${providerProfile.first_name || ''} ${providerProfile.last_name || ''}`.trim()
      : 'Your provider'

    if (canceledBy === 'provider') {
      // Provider canceled — notify the patient
      if (patientEmail) {
        await sendCancellationEmail({
          toEmail: patientEmail,
          toName: patientName,
          canceledByName: providerDisplayName,
          appointmentName: appointmentTypeName,
          durationMinutes,
          startsAt: appointment.starts_at.toISOString(),
          endsAt: appointment.ends_at.toISOString(),
        })
      }
    } else {
      // Patient canceled — notify the provider
      const providerEmail = process.env.PROVIDER_EMAIL
      if (providerEmail) {
        await sendCancellationEmail({
          toEmail: providerEmail,
          toName: 'Dr. Urban',
          canceledByName: patientName,
          appointmentName: appointmentTypeName,
          durationMinutes,
          startsAt: appointment.starts_at.toISOString(),
          endsAt: appointment.ends_at.toISOString(),
        })
      }
    }

    return NextResponse.json({ appointment: updated, status: 'canceled' })
  } catch (err: any) {
    console.error('Cancel error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
