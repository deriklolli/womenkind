import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'
import { isSlotAvailable, getDayOfWeek } from '@/lib/scheduling'
import { createCalendarEvent } from '@/lib/google-calendar'

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
    const supabase = getServiceSupabase()
    const { patientId, providerId, appointmentTypeId, startsAt, patientNotes } = await req.json()

    if (!patientId || !providerId || !appointmentTypeId || !startsAt) {
      return NextResponse.json(
        { error: 'patientId, providerId, appointmentTypeId, and startsAt are required' },
        { status: 400 }
      )
    }

    // 1. Get appointment type details
    const { data: appointmentType, error: typeError } = await supabase
      .from('appointment_types')
      .select('*')
      .eq('id', appointmentTypeId)
      .single()

    if (typeError || !appointmentType) {
      return NextResponse.json({ error: 'Appointment type not found' }, { status: 404 })
    }

    // 2. Compute ends_at from duration
    const endsAt = new Date(
      new Date(startsAt).getTime() + appointmentType.duration_minutes * 60 * 1000
    ).toISOString()

    // 3. Verify the slot is still available (prevent double-booking)
    const date = startsAt.split('T')[0]
    const dayOfWeek = getDayOfWeek(date)

    const { data: availability } = await supabase
      .from('provider_availability')
      .select('start_time, end_time')
      .eq('provider_id', providerId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)

    const { data: bookedAppointments } = await supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('provider_id', providerId)
      .neq('status', 'canceled')
      .gte('starts_at', `${date}T00:00:00`)
      .lte('starts_at', `${date}T23:59:59`)

    const windows = availability?.map(a => ({ start_time: a.start_time, end_time: a.end_time })) || []
    const bookedSlots = bookedAppointments?.map(a => ({ starts_at: a.starts_at, ends_at: a.ends_at })) || []

    if (!isSlotAvailable({ startsAt, endsAt, availabilityWindows: windows, bookedSlots, date })) {
      return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 })
    }

    // 4. Check membership status
    const { data: membership } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('patient_id', patientId)
      .eq('plan_type', 'membership')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const isMember = !!membership

    // 5. Get patient info for Stripe / calendar
    const { data: patient } = await supabase
      .from('patients')
      .select('id, profiles(first_name, last_name, email)')
      .eq('id', patientId)
      .single()

    const profile = (patient as any)?.profiles
    const patientName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Patient'
    const patientEmail = profile?.email

    if (isMember) {
      // 6a. Member: book directly
      const { data: appointment, error: insertError } = await supabase
        .from('appointments')
        .insert({
          provider_id: providerId,
          patient_id: patientId,
          appointment_type_id: appointmentTypeId,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'confirmed',
          is_paid: true,
          amount_cents: 0,
          patient_notes: patientNotes || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Create Google Calendar event
      const calendarEventId = await createCalendarEvent({
        providerId,
        summary: `${appointmentType.name} — ${patientName}`,
        description: patientNotes || `${appointmentType.name} with ${patientName}`,
        startTime: startsAt,
        endTime: endsAt,
        patientEmail,
      })

      // Update appointment with calendar event ID
      await supabase
        .from('appointments')
        .update({ google_calendar_event_id: calendarEventId })
        .eq('id', appointment.id)

      return NextResponse.json({
        appointment,
        status: 'confirmed',
        message: 'Appointment booked successfully',
      })
    } else {
      // 6b. Non-member: create pending appointment + Stripe checkout
      const { data: appointment, error: insertError } = await supabase
        .from('appointments')
        .insert({
          provider_id: providerId,
          patient_id: patientId,
          appointment_type_id: appointmentTypeId,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'pending_payment',
          is_paid: false,
          amount_cents: appointmentType.price_cents,
          patient_notes: patientNotes || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Create Stripe Checkout session
      const stripe = getStripe()
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      // Check for existing Stripe customer
      let customerId: string | undefined
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('patient_id', patientId)
        .not('stripe_customer_id', 'is', null)
        .limit(1)
        .maybeSingle()

      if (existingSub?.stripe_customer_id) {
        customerId = existingSub.stripe_customer_id
      }

      const session = await stripe.checkout.sessions.create({
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
      await supabase
        .from('appointments')
        .update({ stripe_session_id: session.id })
        .eq('id', appointment.id)

      return NextResponse.json({
        appointment,
        status: 'pending_payment',
        checkoutUrl: session.url,
      })
    }
  } catch (err: any) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
