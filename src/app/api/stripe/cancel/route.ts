import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase-server'

/**
 * POST /api/stripe/cancel
 *
 * Cancels a patient's membership subscription at the end of the current
 * billing period. Updates the local subscription record to 'canceled'.
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

    // Look up subscription
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('id, stripe_customer_id, stripe_subscription_id, status')
      .eq('patient_id', patientId)
      .eq('plan_type', 'membership')
      .eq('status', 'active')
      .single()

    if (error || !subscription) {
      return NextResponse.json(
        { error: 'No active membership found' },
        { status: 404 }
      )
    }

    // If there's a real Stripe subscription, cancel it at period end
    if (subscription.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        })
      } catch (stripeErr: any) {
        console.error('Stripe cancel error:', stripeErr.message)
        // Continue to update local record even if Stripe fails
        // (e.g., demo subscriptions without real Stripe IDs)
      }
    }

    // Update the local subscription status
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('id', subscription.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Cancel membership error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
