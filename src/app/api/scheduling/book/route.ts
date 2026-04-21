import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments, appointment_types, provider_availability, subscriptions, patients } from '@/lib/db/schema'
import { eq, and, gte, lte, ne, isNotNull } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'
import { isSlotAvailable, getDayOfWeek } from '@/lib/scheduling'
import { createCalendarEvent } from '@/lib/google-calendar'
import { createVideoRoom, startCloudRecording } from '@/lib/daily-video'
import { Resend } from 'resend'
import { getServerSession } from '@/lib/getServerSession'

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
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { patientId, providerId, appointmentTypeId, startsAt, patientNotes } = await req.json()

    if (!patientId || !providerId || !appointmentTypeId || !startsAt) {
      return NextResponse.json(
        { error: 'patientId, providerId, appointmentTypeId, and startsAt are required' },
        { status: 400 }
      )
    }

    if (session.role === 'patient' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Get appointment type details
    const appointmentType = await db.query.appointment_types.findFirst({
      where: eq(appointment_types.id, appointmentTypeId),
    })

    if (!appointmentType) {
      return NextResponse.json({ error: 'Appointment type not found' }, { status: 404 })
    }

    // 2. Compute ends_at from duration
    const endsAt = new Date(
      new Date(startsAt).getTime() + appointmentType.duration_minutes * 60 * 1000
    ).toISOString()

    // 3. Verify the slot is still available (prevent double-booking)
    const date = startsAt.split('T')[0]
    const dayOfWeek = getDayOfWeek(date)

    const availability = await db.query.provider_availability.findMany({
      where: and(
        eq(provider_availability.provider_id, providerId),
        eq(provider_availability.day_of_week, dayOfWeek),
        eq(provider_availability.is_active, true)
      ),
    })

    const bookedAppointments = await db.query.appointments.findMany({
      where: and(
        eq(appointments.provider_id, providerId),
        ne(appointments.status, 'canceled'),
        gte(appointments.starts_at, new Date(`${date}T00:00:00`)),
        lte(appointments.starts_at, new Date(`${date}T23:59:59`))
      ),
    })

    const windows = availability?.map(a => ({ start_time: a.start_time, end_time: a.end_time })) || []
    const bookedSlots = bookedAppointments?.map(a => ({
      starts_at: a.starts_at.toISOString(),
      ends_at: a.ends_at.toISOString(),
    })) || []

    if (!isSlotAvailable({ startsAt, endsAt, availabilityWindows: windows, bookedSlots, date })) {
      return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 })
    }

    // 4. Check membership status
    const membership = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.patient_id, patientId),
        eq(subscriptions.plan_type, 'membership'),
        eq(subscriptions.status, 'active')
      ),
    })

    const isMember = !!membership

    // 5. Get patient info for Stripe / calendar
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, patientId),
      with: { profiles: true },
    })

    const profile = patient?.profiles
    const patientName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Patient'
    const patientEmail = profile?.email ?? undefined

    if (isMember) {
      // 6a. Member: book directly
      const [appointment] = await db
        .insert(appointments)
        .values({
          provider_id: providerId,
          patient_id: patientId,
          appointment_type_id: appointmentTypeId,
          starts_at: new Date(startsAt),
          ends_at: new Date(endsAt),
          status: 'confirmed',
          is_paid: true,
          amount_cents: 0,
          patient_notes: patientNotes || null,
        })
        .returning()

      if (!appointment) throw new Error('Failed to insert appointment')

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
          await db
            .update(appointments)
            .set({ video_room_url: videoRoom.url, video_room_name: videoRoom.roomName })
            .where(eq(appointments.id, appointment.id))

          // Auto-start cloud recording — stops automatically when all participants leave.
          // Recording consent is captured during pre-visit check-in (Build 14).
          // Fire-and-forget: don't block booking response on this.
          startCloudRecording(videoRoom.roomName).catch(err =>
            console.error('[DAILY] Recording start error:', err)
          )
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
            await db
              .update(appointments)
              .set({ google_calendar_event_id: calendarEventId })
              .where(eq(appointments.id, appointment.id))
          }

          await sendBookingConfirmationEmail({
            appointmentId: appointment.id,
            patientEmail: patientEmail ?? '',
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
      const [appointment] = await db
        .insert(appointments)
        .values({
          provider_id: providerId,
          patient_id: patientId,
          appointment_type_id: appointmentTypeId,
          starts_at: new Date(startsAt),
          ends_at: new Date(endsAt),
          status: 'pending_payment',
          is_paid: false,
          amount_cents: appointmentType.price_cents,
          patient_notes: patientNotes || null,
        })
        .returning()

      if (!appointment) throw new Error('Failed to insert appointment')

      // Create Stripe Checkout session
      const stripe = getStripe()
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      // Check for existing Stripe customer
      let customerId: string | undefined
      const existingSub = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.patient_id, patientId),
          isNotNull(subscriptions.stripe_customer_id)
        ),
      })

      if (existingSub?.stripe_customer_id) {
        customerId = existingSub.stripe_customer_id
      }

      const stripeSession = await stripe.checkout.sessions.create({
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
      await db
        .update(appointments)
        .set({ stripe_session_id: stripeSession.id })
        .where(eq(appointments.id, appointment.id))

      return NextResponse.json({
        appointment,
        status: 'pending_payment',
        checkoutUrl: stripeSession.url,
      })
    }
  } catch (err: any) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
