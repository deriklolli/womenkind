import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'
import { isSlotAvailable, getDayOfWeek } from '@/lib/scheduling'
import { createCalendarEvent } from '@/lib/google-calendar'
import { createVideoRoom } from '@/lib/daily-video'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

async function sendBookingConfirmationEmail({
  appointmentId,
  patientEmail,
  patientName,
  appointmentName,
  durationMinutes,
  startsAt,
  endsAt,
  videoRoomUrl,
}: {
  appointmentId: string
  patientEmail: string
  patientName: string
  appointmentName: string
  durationMinutes: number
  startsAt: string
  endsAt: string
  videoRoomUrl?: string | null
}) {
  if (!process.env.RESEND_API_KEY || !patientEmail) return

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const firstName = patientName.split(' ')[0] || 'there'
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
      to: patientEmail,
      subject: `Your ${appointmentName} is Confirmed`,
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
                You're all set, ${firstName}!
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
                Your appointment has been confirmed. We look forward to seeing you.
              </p>

              <!-- Appointment card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">
                      ${appointmentName}
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

              <!-- CTA -->
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

              <!-- Add to Calendar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; border-top: 1px solid #f2f1f4; padding-top: 20px;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #b3aaa5;">Add to your calendar</p>
                    <a href="${appUrl}/api/scheduling/calendar-export?appointmentId=${appointmentId}" style="font-size: 13px; color: #944fed; text-decoration: none; margin-right: 16px;">Apple / Outlook</a>
                    <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(appointmentName + ' — Womenkind')}&dates=${new Date(startsAt).toISOString().replace(/[-:]/g, '').replace(/\\.\\d{3}/, '')}/${new Date(endsAt).toISOString().replace(/[-:]/g, '').replace(/\\.\\d{3}/, '')}&details=${encodeURIComponent('Womenkind appointment')}&location=${encodeURIComponent('Virtual (video call)')}" target="_blank" style="font-size: 13px; color: #944fed; text-decoration: none;">Google Calendar</a>
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
    console.log(`[RESEND] Booking confirmation email sent to ${patientEmail}`)
  } catch (emailErr) {
    console.error('[RESEND] Failed to send booking confirmation:', emailErr)
  }
}

async function sendProviderBookingNotification({
  providerEmail,
  patientName,
  appointmentName,
  durationMinutes,
  startsAt,
  endsAt,
}: {
  providerEmail: string
  patientName: string
  appointmentName: string
  durationMinutes: number
  startsAt: string
  endsAt: string
}) {
  if (!process.env.RESEND_API_KEY || !providerEmail) return

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const start = new Date(startsAt)
  const end = new Date(endsAt)

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
    const resend = getResend()
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>',
      to: providerEmail,
      subject: `New appointment booked — ${patientName}`,
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
                New appointment booked
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
                A patient has scheduled an appointment with you.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">
                      ${appointmentName}
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #a1958f;">
                      ${patientName} &nbsp;&middot;&nbsp; ${durationMinutes} min
                    </p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${dateStr}</p>
                    <p style="margin: 0; font-size: 14px; color: #280f49;">${startTime} – ${endTime} MT</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/provider/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #944fed; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
                      View Provider Portal
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
    console.log(`[RESEND] Provider booking notification sent to ${providerEmail}`)
  } catch (emailErr) {
    console.error('[RESEND] Failed to send provider booking notification:', emailErr)
  }
}

/**
 * POST /api/scheduling/book
 *
 * Book an appointment. Checks membership status:
 * - Members: book directly (free)
 * - Non-members: create pending appointment + Stripe Checkout session
 *
 * Body: { patientId, providerId, appointmentTypeId, startsAt, patientNotes? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const { patientId, providerId, appointmentTypeId, startsAt, patientNotes } = await req.json()

    if (!patientId || !providerId || !appointmentTypeId || !startsAt) {
      return NextResponse.json(
        { error: 'patientId, providerId, appointmentTypeId, and startsAt are required' },
        { status: 400 }
      )
    }

    // 1. Get appointment type details
    const { data: appointmentType, error: typeError } = await supabase
      .from('appointment_types')
      .select('*')
      .eq('id', appointmentTypeId)
      .single()

    if (typeError || !appointmentType) {
      return NextResponse.json({ error: 'Appointment type not found' }, { status: 404 })
    }

    // 2. Compute ends_at from duration
    const endsAt = new Date(
      new Date(startsAt).getTime() + appointmentType.duration_minutes * 60 * 1000
    ).toISOString()

    // 3. Verify the slot is still available (prevent double-booking)
    const date = startsAt.split('T')[0]
    const dayOfWeek = getDayOfWeek(date)

    const { data: availability } = await supabase
      .from('provider_availability')
      .select('start_time, end_time')
      .eq('provider_id', providerId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)

    const { data: bookedAppointments } = await supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('provider_id', providerId)
      .neq('status', 'canceled')
      .gte('starts_at', `${date}T00:00:00`)
      .lte('starts_at', `${date}T23:59:59`)

    const windows = availability?.map(a => ({ start_time: a.start_time, end_time: a.end_time })) || []
    const bookedSlots = bookedAppointments?.map(a => ({ starts_at: a.starts_at, ends_at: a.ends_at })) || []

    if (!isSlotAvailable({ startsAt, endsAt, availabilityWindows: windows, bookedSlots, date })) {
      return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 })
    }

    // 4. Check membership status
    const { data: membership } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('patient_id', patientId)
      .eq('plan_type', 'membership')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const isMember = !!membership

    // 5. Get patient info for Stripe / calendar
    const { data: patient } = await supabase
      .from('patients')
      .select('id, profiles(first_name, last_name, email)')
      .eq('id', patientId)
      .single()

    const profile = (patient as any)?.profiles
    const patientName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Patient'
    const patientEmail = profile?.email

    if (isMember) {
      // 6a. Member: book directly
      const { data: appointment, error: insertError } = await supabase
        .from('appointments')
        .insert({
          provider_id: providerId,
          patient_id: patientId,
          appointment_type_id: appointmentTypeId,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'confirmed',
          is_paid: true,
          amount_cents: 0,
          patient_notes: patientNotes || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Create video room synchronously so the URL is available in the response
      let videoRoom: { url: string; roomName: string } | null = null
      try {
        videoRoom = await createVideoRoom({
          appointmentId: appointment.id,
          appointmentName: appointmentType.name,
          startsAt,
          endsAt,
        })

        if (videoRoom) {
          await supabase
            .from('appointments')
            .update({ video_room_url: videoRoom.url, video_room_name: videoRoom.roomName })
            .eq('id', appointment.id)
        }
      } catch (videoErr) {
        console.error('Video room creation failed:', videoErr)
      }

      // Fire-and-forget: calendar event + confirmation email run in the background
      const backgroundTasks = async () => {
        try {
          const calendarEventId = await createCalendarEvent({
            providerId,
            summary: `${appointmentType.name} — ${patientName}`,
            description: `${patientNotes || `${appointmentType.name} with ${patientName}`}${videoRoom ? `\n\nJoin video call: ${videoRoom.url}` : ''}`,
            startTime: startsAt,
            endTime: endsAt,
            patientEmail,
          })

          if (calendarEventId) {
            await supabase
              .from('appointments')
              .update({ google_calendar_event_id: calendarEventId })
              .eq('id', appointment.id)
          }

          await sendBookingConfirmationEmail({
            appointmentId: appointment.id,
            patientEmail,
            patientName,
            appointmentName: appointmentType.name,
            durationMinutes: appointmentType.duration_minutes,
            startsAt,
            endsAt,
            videoRoomUrl: videoRoom?.url,
          })

          const providerEmail = process.env.PROVIDER_EMAIL
          if (providerEmail) {
            await sendProviderBookingNotification({
              providerEmail,
              patientName,
              appointmentName: appointmentType.name,
              durationMinutes: appointmentType.duration_minutes,
              startsAt,
              endsAt,
            })
          }
        } catch (bgErr) {
          console.error('Background booking tasks failed:', bgErr)
        }
      }

      backgroundTasks()

      return NextResponse.json({
        appointment: {
          ...appointment,
          video_room_url: videoRoom?.url ?? null,
          video_room_name: videoRoom?.roomName ?? null,
        },
        status: 'confirmed',
        message: 'Appointment booked successfully',
      })
    } else {
      // 6b. Non-member: create pending appointment + Stripe checkout
      const { data: appointment, error: insertError } = await supabase
        .from('appointments')
        .insert({
          provider_id: providerId,
          patient_id: patientId,
          appointment_type_id: appointmentTypeId,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'pending_payment',
          is_paid: false,
          amount_cents: appointmentType.price_cents,
          patient_notes: patientNotes || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Create Stripe Checkout session
      const stripe = getStripe()
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      // Check for existing Stripe customer
      let customerId: string | undefined
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('patient_id', patientId)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle()

      if (existingSub?.stripe_customer_id) {
        customerId = existingSub.stripe_customer_id
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        ...(customerId ? { customer: customerId } : { customer_email: patientEmail }),
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: appointmentType.price_cents,
              product_data: {
                name: appointmentType.name,
                description: `${appointmentType.duration_minutes}-minute appointment`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          type: 'appointment',
          appointmentId: appointment.id,
          patientId,
          providerId,
        },
        success_url: `${origin}/patient/schedule?booked=${appointment.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/patient/schedule?canceled=true`,
      })

      // Store the Stripe session ID on the appointment
      await supabase
        .from('appointments')
        .update({ stripe_session_id: session.id })
        .eq('id', appointment.id)

      return NextResponse.json({
        appointment,
        status: 'pending_payment',
        checkoutUrl: session.url,
      })
    }
  } catch (err: any) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
