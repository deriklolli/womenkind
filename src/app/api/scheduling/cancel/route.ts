import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
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
<body style="margin: 0; padding: 0; background-color: #f7f3ee; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f3ee;">
    <tr>
      <td align="center" style="padding: 48px 24px 40px 24px;">
        <img src="${appUrl}/womenkind-logo-dark.png" alt="Womenkind" style="height: 96px;" />
      </td>
    </tr>
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 36px 32px 36px;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #280f49;">
                Appointment Canceled
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #422a1f; opacity: 0.6; line-height: 1.5;">
                Hi ${firstName}, your appointment has been canceled by ${canceledByName}.
              </p>

              <!-- Appointment card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f3ee; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49; text-decoration: line-through; opacity: 0.5;">
                      ${appointmentName}
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #422a1f; opacity: 0.5;">
                      ${durationMinutes} minutes with Dr. Joseph Urban Jr.
                    </p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49; opacity: 0.5;">${dateStr}</p>
                    <p style="margin: 0; font-size: 14px; color: #280f49; opacity: 0.5;">${startTime} – ${endTime} MT</p>
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
        <p style="margin: 0; font-size: 12px; color: #422a1f; opacity: 0.35;">
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
    const supabase = getServiceSupabase()
    const { appointmentId, reason, canceledBy } = await req.json()

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    // Get the appointment with patient and provider info
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        *,
        appointment_types(name, duration_minutes),
        patients(id, profiles(first_name, last_name, email))
      `)
      .eq('id', appointmentId)
      .single()

    if (fetchError || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (appointment.status === 'canceled') {
      return NextResponse.json({ error: 'Appointment is already canceled' }, { status: 400 })
    }

    // Cancel the appointment
    const { data: updated, error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        provider_notes: reason
          ? `${appointment.provider_notes ? appointment.provider_notes + '\n' : ''}Cancellation reason: ${reason}`
          : appointment.provider_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .select()
      .single()

    if (updateError) throw updateError

    // Cancel Google Calendar event if one exists
    if (appointment.google_calendar_event_id) {
      await cancelCalendarEvent(appointment.provider_id, appointment.google_calendar_event_id)
    }

    // Send cancellation email to the other party
    const patientProfile = (appointment as any).patients?.profiles
    const patientName = patientProfile
      ? `${patientProfile.first_name || ''} ${patientProfile.last_name || ''}`.trim()
      : 'Patient'
    const patientEmail = patientProfile?.email

    const appointmentTypeName = (appointment as any).appointment_types?.name || 'Appointment'
    const durationMinutes = (appointment as any).appointment_types?.duration_minutes || 30

    if (canceledBy === 'provider') {
      // Provider canceled — notify the patient
      if (patientEmail) {
        await sendCancellationEmail({
          toEmail: patientEmail,
          toName: patientName,
          canceledByName: 'Dr. Joseph Urban Jr.',
          appointmentName: appointmentTypeName,
          durationMinutes,
          startsAt: appointment.starts_at,
          endsAt: appointment.ends_at,
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
          startsAt: appointment.starts_at,
          endsAt: appointment.ends_at,
        })
      }
    }

    return NextResponse.json({ appointment: updated, status: 'canceled' })
  } catch (err: any) {
    console.error('Cancel error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
