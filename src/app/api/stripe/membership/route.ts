import { NextRequest, NextResponse } from 'next/server'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'
import { db } from '@/lib/db'
import { subscriptions } from '@/lib/db/schema'
import { eq, isNotNull, and } from 'drizzle-orm'

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
      const sub = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.intake_id, intakeId),
          isNotNull(subscriptions.stripe_customer_id)
        ),
      })

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
