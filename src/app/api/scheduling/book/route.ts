import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments, appointment_types, provider_availability, subscriptions, patients } from '@/lib/db/schema'
import { eq, and, gte, lte, ne, isNotNull, inArray } from 'drizzle-orm'
import { getStripe, MEMBER_PLAN_TYPES } from '@/lib/stripe'
import { isSlotAvailable, getDayOfWeek } from '@/lib/scheduling'
import { createCalendarEvent } from '@/lib/google-calendar'
import { createVideoRoom } from '@/lib/daily-video'
import { Resend } from 'resend'
import { getServerSession } from '@/lib/getServerSession'
import { buildEngagementEmail } from '@/lib/engagement'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

async function sendBookingConfirmationEmail({
  appointmentId,
  patientId,
  patientEmail,
  patientName,
  appointmentName,
  durationMinutes,
  startsAt,
  endsAt,
  videoRoomUrl,
}: {
  appointmentId: string
  patientId: string
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

  const calendarLinks = `
    <p style="margin: 20px 0 8px 0; font-size: 12px; color: #b3aaa5; text-align: center;">Add to your calendar</p>
    <p style="margin: 0; text-align: center;">
      <a href="${appUrl}/api/scheduling/calendar-export?appointmentId=${appointmentId}" style="font-size: 13px; color: #944fed; text-decoration: none; margin-right: 16px;">Apple / Outlook</a>
      <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(appointmentName + ' — Womenkind')}&dates=${new Date(startsAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${new Date(endsAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}&details=${encodeURIComponent('Womenkind appointment')}&location=${encodeURIComponent('Virtual (video call)')}" target="_blank" style="font-size: 13px; color: #944fed; text-decoration: none;">Google Calendar</a>
    </p>
  `

  try {
    const resend = getResend()
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>',
      to: patientEmail,
      subject: `Your ${appointmentName} is Confirmed`,
      html: buildEngagementEmail({
        heading: `You're all set, ${firstName}!`,
        bodyHtml: `
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
            Your appointment has been confirmed. We look forward to seeing you.
          </p>
          <div style="background-color: #f7f3ee; border-radius: 12px; padding: 24px; margin-bottom: 8px;">
            <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">${appointmentName}</p>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #a1958f;">${durationMinutes} min</p>
            <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${dateStr}</p>
            <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${startTime} – ${endTime} MT</p>
            ${videoRoomUrl ? `<p style="margin: 0; font-size: 14px; color: #280f49;">Virtual visit via video call</p>` : ''}
          </div>
          ${calendarLinks}
        `,
        ctaText: videoRoomUrl ? 'Join Video Call' : 'View Your Dashboard',
        ctaUrl: videoRoomUrl || `${appUrl}/patient/dashboard`,
        secondaryCtaText: videoRoomUrl ? 'or view your dashboard' : undefined,
        secondaryCtaUrl: videoRoomUrl ? `${appUrl}/patient/dashboard` : undefined,
        patientId,
      }),
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
      html: buildEngagementEmail({
        heading: 'New appointment booked',
        bodyHtml: `
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
            A patient has scheduled an appointment with you.
          </p>
          <div style="background-color: #f7f3ee; border-radius: 12px; padding: 24px;">
            <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">${appointmentName}</p>
            <p style="margin: 0 0 16px 0; font-size: 13px; color: #a1958f;">${patientName} &nbsp;&middot;&nbsp; ${durationMinutes} min</p>
            <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${dateStr}</p>
            <p style="margin: 0; font-size: 14px; color: #280f49;">${startTime} – ${endTime} MT</p>
          </div>
        `,
        ctaText: 'View Provider Portal',
        ctaUrl: `${appUrl}/provider/dashboard`,
        patientId: '',
      }),
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
        inArray(subscriptions.plan_type, [...MEMBER_PLAN_TYPES]),
        eq(subscriptions.status, 'active')
      ),
    })

    const isMember = !!membership || appointmentType.price_cents === 0

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
          // Recording is handled automatically by enable_recording:'cloud' on the room —
          // Daily starts it when the first participant joins and stops when all leave.
          // Do NOT call startCloudRecording() here; it runs before anyone is in the room
          // and conflicts with the auto-recording, causing no recording to be captured.
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
            patientId,
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
