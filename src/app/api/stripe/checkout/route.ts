import { NextRequest, NextResponse } from 'next/server'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'
import { db } from '@/lib/db'
import { intakes, subscriptions, providers } from '@/lib/db/schema'
import { eq, isNotNull, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the intake payment ($650).
 *
 * New flow (payment-first): called without intakeId — a draft intake is
 * created here so the webhook can link the payment before the form is filled.
 *
 * Legacy flow (intake-first): called with an existing intakeId after form
 * submission. Both paths are supported.
 *
 * Body: { intakeId?: string, patientEmail?: string, addMembership?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const authSession = await getServerSession()
    if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const stripe = getStripe()
    const { intakeId: bodyIntakeId, patientEmail, addMembership } = await req.json()

    if (!STRIPE_PRICES.intake) {
      return NextResponse.json(
        { error: 'Stripe intake price not configured. Run: npx tsx scripts/seed-stripe.ts' },
        { status: 500 }
      )
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    let intakeId: string = bodyIntakeId
    let patientId: string | null = null

    if (bodyIntakeId) {
      // ── Legacy flow: intake already exists ───────────────────────────────
      const intake = await db.query.intakes.findFirst({
        where: eq(intakes.id, bodyIntakeId),
      })

      patientId = intake?.patient_id || null

      if (authSession.role === 'patient' && authSession.patientId !== patientId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // ── New flow: payment-first, no intake yet ────────────────────────────
      // Resolve patient from session
      patientId = authSession.patientId || null
      if (!patientId) {
        return NextResponse.json({ error: 'Patient record not found' }, { status: 400 })
      }

      // Resolve the active provider (single-provider MVP)
      const providerRow = await db.query.providers.findFirst({
        where: eq(providers.is_active, true),
      })

      // Create a draft intake linked to the patient so the webhook can update it
      const [newIntake] = await db
        .insert(intakes)
        .values({
          patient_id: patientId,
          provider_id: providerRow?.id ?? null,
          status: 'draft',
          answers: {},
        })
        .returning({ id: intakes.id })

      intakeId = newIntake.id
    }

    // Determine patient email from answers or parameter
    let email: string | undefined = patientEmail || undefined
    if (!email && bodyIntakeId) {
      const intake = await db.query.intakes.findFirst({
        where: eq(intakes.id, intakeId),
        columns: { answers: true },
      })
      email = (intake?.answers as any)?.email || undefined
    }

    // Get or create Stripe customer ID
    let customerId: string | undefined
    if (patientId) {
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.patient_id, patientId),
          isNotNull(subscriptions.stripe_customer_id)
        ),
      })
      if (subscription?.stripe_customer_id) {
        customerId = subscription.stripe_customer_id
      }
    }

    // Build line items
    const lineItems: { price: string; quantity: number }[] = [
      { price: STRIPE_PRICES.intake, quantity: 1 },
    ]
    if (addMembership && STRIPE_PRICES.membership) {
      lineItems.push({ price: STRIPE_PRICES.membership, quantity: 1 })
    }

    // Determine success URL:
    // - New flow (no bodyIntakeId): go straight to the intake form
    // - Legacy flow: go to payment-success page
    const successUrl = bodyIntakeId
      ? `${origin}/intake/payment-success?session_id={CHECKOUT_SESSION_ID}&intake_id=${intakeId}${addMembership ? '&membership=active' : ''}`
      : `${origin}/intake`

    const cancelUrl = bodyIntakeId
      ? `${origin}/intake/payment?intake_id=${intakeId}&canceled=true`
      : `${origin}/get-started?canceled=true`

    const session = await stripe.checkout.sessions.create({
      mode: addMembership ? 'subscription' : 'payment',
      ...(customerId ? { customer: customerId } : { customer_email: email }),
      line_items: lineItems,
      metadata: {
        intakeId,
        patientId: patientId || '',
        type: addMembership ? 'intake_and_membership' : 'intake',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
