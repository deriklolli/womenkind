import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase-server'

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
    const stripe = getStripe()
    const supabase = getServiceSupabase()
    const { patientId } = await req.json()

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    // Look up the Stripe customer ID from subscriptions
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('patient_id', patientId)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single()

    if (error || !subscription?.stripe_customer_id) {
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
      const { data: profile } = await supabase
        .from('patients')
        .select('profiles ( first_name, last_name, email )')
        .eq('id', patientId)
        .single()

      const p = (profile as any)?.profiles
      const customer = await stripe.customers.create({
        email: p?.email || undefined,
        name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : undefined,
        metadata: { patientId },
      })

      resolvedCustomerId = customer.id

      // Update the subscription record with the real Stripe customer ID
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: resolvedCustomerId })
        .eq('patient_id', patientId)
        .eq('stripe_customer_id', customerId)
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
