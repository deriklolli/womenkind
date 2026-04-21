import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { patients, profiles, subscriptions } from '@/lib/db/schema'
import { eq, isNotNull, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so the patient can
 * update their payment method, view invoices, or cancel.
 *
 * Body: { patientId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const stripe = getStripe()
    const { patientId } = await req.json()

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    if (session.role === 'patient' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Look up the Stripe customer ID from subscriptions
    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.patient_id, patientId),
        isNotNull(subscriptions.stripe_customer_id)
      ),
    })

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this patient' },
        { status: 404 }
      )
    }

    const customerId = subscription.stripe_customer_id

    // Verify the customer exists in Stripe — if it's a demo ID, create a real one
    let resolvedCustomerId = customerId
    try {
      await stripe.customers.retrieve(customerId)
    } catch {
      // Customer doesn't exist in Stripe — create one and update the DB
      const patient = await db.query.patients.findFirst({
        where: eq(patients.id, patientId),
        with: { profiles: true },
      })

      const p = patient?.profiles
      const customer = await stripe.customers.create({
        email: p?.email || undefined,
        name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : undefined,
        metadata: { patientId },
      })

      resolvedCustomerId = customer.id

      // Update the subscription record with the real Stripe customer ID
      await db
        .update(subscriptions)
        .set({ stripe_customer_id: resolvedCustomerId })
        .where(
          and(
            eq(subscriptions.patient_id, patientId),
            eq(subscriptions.stripe_customer_id, customerId)
          )
        )
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.billingPortal.sessions.create({
      customer: resolvedCustomerId,
      return_url: `${origin}/patient/dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe portal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
