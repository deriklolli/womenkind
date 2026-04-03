import { NextRequest, NextResponse } from 'next/server'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase-server'

/**
 * POST /api/stripe/membership
 *
 * Creates a Stripe Checkout Session for the $200/mo membership subscription.
 * Called from the payment success page as an optional upsell.
 *
 * Body: { intakeId: string, stripeCustomerId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()
    const supabase = getServiceSupabase()
    const { intakeId, stripeCustomerId } = await req.json()

    if (!STRIPE_PRICES.membership) {
      return NextResponse.json(
        { error: 'Stripe membership price not configured.' },
        { status: 500 }
      )
    }

    // Try to find existing Stripe customer from the intake payment
    let customerId = stripeCustomerId

    if (!customerId && intakeId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('intake_id', intakeId)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .single()

      customerId = sub?.stripe_customer_id
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...(customerId ? { customer: customerId } : {}),
      line_items: [
        {
          price: STRIPE_PRICES.membership,
          quantity: 1,
        },
      ],
      metadata: {
        intakeId: intakeId || '',
        type: 'membership',
      },
      success_url: `${origin}/patient/dashboard?membership=active`,
      cancel_url: `${origin}/patient/dashboard?membership=skipped`,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err: any) {
    console.error('Stripe membership error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
