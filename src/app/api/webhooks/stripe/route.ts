import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase-server'
import { createCalendarEvent } from '@/lib/google-calendar'
import { createVideoRoom } from '@/lib/daily-video'
import { Resend } from 'resend'
import Stripe from 'stripe'

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed → marks intake as paid, creates subscription record, or confirms appointment
 * - invoice.payment_succeeded → updates subscription status
 * - customer.subscription.deleted → marks membership canceled
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const supabase = getServiceSupabase()

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event: Stripe.Event

  // Verify webhook signature
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    // In development without webhook secret, parse directly
    event = JSON.parse(body) as Stripe.Event
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata || {}
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id || null

        if (metadata.type === 'intake') {
          // Intake payment completed
          await handleIntakePayment(supabase, {
            intakeId: metadata.intakeId,
            patientId: metadata.patientId,
            stripeCustomerId: customerId,
            stripeSessionId: session.id,
            amountPaid: session.amount_total,
          })
        } else if (metadata.type === 'appointment') {
          // Appointment payment completed
          await handleAppointmentPayment(supabase, {
            appointmentId: metadata.appointmentId,
            patientId: metadata.patientId,
            providerId: metadata.providerId,
            stripeSessionId: session.id,
          })
        } else if (metadata.type === 'membership') {
          // Membership subscription started
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id || null

          await handleMembershipStart(supabase, {
            intakeId: metadata.intakeId,
            patientId: metadata.patientId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          })
        } else if (metadata.type === 'intake_and_membership') {
          // Intake + membership purchased together
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id || null

          // Handle intake portion
          await handleIntakePayment(supabase, {
            intakeId: metadata.intakeId,
            patientId: metadata.patientId,
            stripeCustomerId: customerId,
            stripeSessionId: session.id,
            amountPaid: session.amount_total,
          })

          // Handle membership portion
          await handleMembershipStart(supabase, {
            intakeId: metadata.intakeId,
            patientId: metadata.patientId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id || null

        if (subscriptionId) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_end: invoice.lines.data[0]?.period?.end
                ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
                : null,
            })
            .eq('stripe_subscription_id', subscriptionId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const status = subscription.status === 'active' ? 'active' :
                       subscription.status === 'past_due' ? 'past_due' :
                       subscription.status
        await supabase
          .from('subscriptions')
          .update({
            status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
        break
      }

      default:
        // Unhandled event type — that's fine
        break
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * Handle intake payment: update intake status, create subscription record
 */
async function handleIntakePayment(
  supabase: ReturnType<typeof getServiceSupabase>,
  data: {
    intakeId: string
    patientId: string
    stripeCustomerId: string | null
    stripeSessionId: string
    amountPaid: number | null
  }
) {
  // Mark intake as paid (status goes from 'draft' to 'submitted', record payment details)
  if (data.intakeId) {
    const { error: intakeErr } = await supabase
      .from('intakes')
      .update({
        status: 'submitted', // Provider still needs to review
        paid: true,
        paid_at: new Date().toISOString(),
        stripe_session_id: data.stripeSessionId,
      })
      .eq('id', data.intakeId)
    if (intakeErr) console.error('[STRIPE] Failed to update intake after payment:', intakeErr.message)
  }

  // Create a subscription record for the intake payment
  if (data.patientId) {
    const { error: subErr } = await supabase.from('subscriptions').insert({
      patient_id: data.patientId,
      stripe_customer_id: data.stripeCustomerId,
      plan_type: 'intake',
      status: 'active',
      intake_id: data.intakeId || null,
      created_at: new Date().toISOString(),
    })
    if (subErr) console.error('[STRIPE] Failed to create intake subscription record:', subErr.message)
  }
}

/**
 * Handle appointment payment: confirm the appointment + create calendar event
 */
async function handleAppointmentPayment(
  supabase: ReturnType<typeof getServiceSupabase>,
  data: {
    appointmentId: string
    patientId: string
    providerId: string
    stripeSessionId: string
  }
) {
  // Get appointment details for calendar event
  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      *,
      appointment_types(name, duration_minutes),
      patients(id, profiles(first_name, last_name, email))
    `)
    .eq('id', data.appointmentId)
    .single()

  // Confirm the appointment
  await supabase
    .from('appointments')
    .update({
      status: 'confirmed',
      is_paid: true,
      stripe_session_id: data.stripeSessionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.appointmentId)

  // Create video room + Google Calendar event
  if (appointment) {
    const profile = (appointment as any)?.patients?.profiles
    const patientName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Patient'
    const typeName = (appointment as any)?.appointment_types?.name || 'Appointment'

    // Create video room
    const videoRoom = await createVideoRoom({
      appointmentId: data.appointmentId,
      appointmentName: typeName,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
    })

    const calendarEventId = await createCalendarEvent({
      providerId: data.providerId,
      summary: `${typeName} — ${patientName}`,
      description: `${appointment.patient_notes || `${typeName} with ${patientName}`}${videoRoom ? `\n\nJoin video call: ${videoRoom.url}` : ''}`,
      startTime: appointment.starts_at,
      endTime: appointment.ends_at,
      patientEmail: profile?.email,
    })

    await supabase
      .from('appointments')
      .update({
        google_calendar_event_id: calendarEventId,
        ...(videoRoom ? { video_room_url: videoRoom.url, video_room_name: videoRoom.roomName } : {}),
      })
      .eq('id', data.appointmentId)

    // Send confirmation email
    if (profile?.email && process.env.RESEND_API_KEY) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const firstName = patientName.split(' ')[0] || 'there'
      const durationMinutes = (appointment as any)?.appointment_types?.duration_minutes || 0
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
        const resend = new Resend(process.env.RESEND_API_KEY!)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>',
          to: profile.email,
          subject: `Your ${typeName} is Confirmed`,
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
                You're all set, ${firstName}!
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #422a1f; opacity: 0.6; line-height: 1.5;">
                Your payment has been received and your appointment is confirmed.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f3ee; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">
                      ${typeName}
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #422a1f; opacity: 0.5;">
                      ${durationMinutes} min
                    </p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${dateStr}</p>
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #280f49;">${startTime} – ${endTime} MT</p>
                    ${videoRoom ? `<p style="margin: 0; font-size: 14px; color: #280f49;">Virtual visit via video call</p>` : ''}
                  </td>
                </tr>
              </table>
              ${videoRoom ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="${videoRoom.url}" style="display: inline-block; padding: 14px 32px; background-color: #944fed; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
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
        console.log(`[RESEND] Booking confirmation email sent to ${profile.email} (via webhook)`)
      } catch (emailErr) {
        console.error('[RESEND] Failed to send booking confirmation:', emailErr)
      }
    }
  }
}

/**
 * Handle membership start: create or update subscription record
 */
async function handleMembershipStart(
  supabase: ReturnType<typeof getServiceSupabase>,
  data: {
    intakeId?: string
    patientId?: string
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
  }
) {
  // Resolve patientId — prefer direct value, fall back to intake lookup
  let patientId: string | null = data.patientId || null

  if (!patientId && data.intakeId) {
    const { data: intake } = await supabase
      .from('intakes')
      .select('patient_id')
      .eq('id', data.intakeId)
      .single()
    patientId = intake?.patient_id || null
  }

  if (patientId) {
    await supabase.from('subscriptions').insert({
      patient_id: patientId,
      stripe_customer_id: data.stripeCustomerId,
      stripe_subscription_id: data.stripeSubscriptionId,
      plan_type: 'membership',
      status: 'active',
      created_at: new Date().toISOString(),
    })
  }
}
