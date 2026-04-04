import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { cancelCalendarEvent } from '@/lib/google-calendar'

/**
 * POST /api/scheduling/cancel
 *
 * Cancel an appointment. Updates status and optionally cancels Google Calendar event.
 *
 * Body: { appointmentId, reason? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const { appointmentId, reason } = await req.json()

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    // Get the appointment
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()

    if (fetchError || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (appointment.status === 'canceled') {
      return NextResponse.json({ error: 'Appointment is already canceled' }, { status: 400 })
    }

    // Cancel the appointment
    const { data: updated, error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        provider_notes: reason
          ? `${appointment.provider_notes ? appointment.provider_notes + '\n' : ''}Cancellation reason: ${reason}`
          : appointment.provider_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .select()
      .single()

    if (updateError) throw updateError

    // Cancel Google Calendar event if one exists
    if (appointment.google_calendar_event_id) {
      await cancelCalendarEvent(appointment.provider_id, appointment.google_calendar_event_id)
    }

    return NextResponse.json({ appointment: updated, status: 'canceled' })
  } catch (err: any) {
    console.error('Cancel error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
