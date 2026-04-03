import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase-server'
import Stripe from 'stripe'

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed → marks intake as paid, creates subscription record
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
        } else if (metadata.type === 'membership') {
          // Membership subscription started
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id || null

          await handleMembershipStart(supabase, {
            intakeId: metadata.intakeId,
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
  // Mark intake as paid (status goes from 'submitted' to 'paid')
  if (data.intakeId) {
    await supabase
      .from('intakes')
      .update({
        status: 'submitted', // Keep as submitted — provider still needs to review
        paid: true,
        paid_at: new Date().toISOString(),
        stripe_session_id: data.stripeSessionId,
      })
      .eq('id', data.intakeId)
  }

  // Create a subscription record for the intake payment
  if (data.patientId) {
    await supabase.from('subscriptions').insert({
      patient_id: data.patientId,
      stripe_customer_id: data.stripeCustomerId,
      plan_type: 'intake',
      status: 'active',
      intake_id: data.intakeId,
      created_at: new Date().toISOString(),
    })
  }
}

/**
 * Handle membership start: create or update subscription record
 */
async function handleMembershipStart(
  supabase: ReturnType<typeof getServiceSupabase>,
  data: {
    intakeId: string
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
  }
) {
  // Look up patient from intake
  let patientId: string | null = null
  if (data.intakeId) {
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
