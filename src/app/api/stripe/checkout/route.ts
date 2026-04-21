import { NextRequest, NextResponse } from 'next/server'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'
import { db } from '@/lib/db'
import { intakes, subscriptions } from '@/lib/db/schema'
import { eq, isNotNull, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the intake payment ($650).
 * After successful payment, optionally prompts for membership enrollment.
 *
 * Body: { intakeId: string, patientEmail?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authSession = await getServerSession()
    if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const stripe = getStripe()
    const { intakeId, patientEmail, addMembership } = await req.json()

    if (!intakeId) {
      return NextResponse.json({ error: 'intakeId is required' }, { status: 400 })
    }

    if (!STRIPE_PRICES.intake) {
      return NextResponse.json(
        { error: 'Stripe intake price not configured. Run: npx tsx scripts/seed-stripe.ts' },
        { status: 500 }
      )
    }

    // Look up the intake to get patient info
    const intake = await db.query.intakes.findFirst({
      where: eq(intakes.id, intakeId),
    })

    const patientId = intake?.patient_id || null
    if (authSession.role === 'patient' && authSession.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Determine patient email from intake answers or parameter
    const email =
      patientEmail ||
      (intake?.answers as any)?.email ||
      undefined

    // Get or create Stripe customer
    let customerId: string | undefined

    if (intake?.patient_id) {
      // Check if patient already has a Stripe customer
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.patient_id, intake.patient_id),
          isNotNull(subscriptions.stripe_customer_id)
        ),
      })

      if (subscription?.stripe_customer_id) {
        customerId = subscription.stripe_customer_id
      }
    }

    // Build the base URL for redirects
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Build line items — intake is always included, membership is optional
    const lineItems: { price: string; quantity: number }[] = [
      { price: STRIPE_PRICES.intake, quantity: 1 },
    ]

    // If adding membership, we need subscription mode which supports both
    // one-time and recurring items in the same checkout
    if (addMembership && STRIPE_PRICES.membership) {
      lineItems.push({ price: STRIPE_PRICES.membership, quantity: 1 })
    }

    // Use subscription mode if membership is included (supports mixed line items),
    // otherwise use payment mode for intake only
    const session = await stripe.checkout.sessions.create({
      mode: addMembership ? 'subscription' : 'payment',
      ...(customerId ? { customer: customerId } : { customer_email: email }),
      line_items: lineItems,
      metadata: {
        intakeId,
        patientId: intake?.patient_id || '',
        type: addMembership ? 'intake_and_membership' : 'intake',
      },
      success_url: `${origin}/intake/payment-success?session_id={CHECKOUT_SESSION_ID}&intake_id=${intakeId}${addMembership ? '&membership=active' : ''}`,
      cancel_url: `${origin}/intake/payment?intake_id=${intakeId}&canceled=true`,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
