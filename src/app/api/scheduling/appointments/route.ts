import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/scheduling/appointments?providerId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * GET /api/scheduling/appointments?patientId=xxx
 *
 * Returns appointments for a provider (date range) or patient.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const providerId = req.nextUrl.searchParams.get('providerId')
    const patientId = req.nextUrl.searchParams.get('patientId')
    const startDate = req.nextUrl.searchParams.get('startDate')
    const endDate = req.nextUrl.searchParams.get('endDate')
    const status = req.nextUrl.searchParams.get('status')

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Patients can only query their own appointments; providers can query any
    if (patientId && session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (providerId && session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let query = supabase
      .from('appointments')
      .select(`
        *,
        appointment_types(name, duration_minutes, price_cents, color),
        patients(
          id,
          profiles(first_name, last_name, email),
          subscriptions(status, plan_type)
        )
      `)
      .order('starts_at', { ascending: true })

    if (providerId) {
      query = query.eq('provider_id', providerId)
    }

    if (patientId) {
      query = query.eq('patient_id', patientId)
    }

    if (startDate) {
      query = query.gte('starts_at', `${startDate}T00:00:00`)
    }

    if (endDate) {
      query = query.lte('starts_at', `${endDate}T23:59:59`)
    }

    if (status) {
      query = query.eq('status', status)
    } else {
      // By default, exclude canceled
      query = query.neq('status', 'canceled')
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ appointments: data })
  } catch (err: any) {
    console.error('Failed to fetch appointments:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/scheduling/appointments
 * Update an appointment (mark complete, add notes, etc.)
 *
 * Body: { appointmentId, status?, providerNotes? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    const supabase = getServiceSupabase()
    const { appointmentId, status, providerNotes } = await req.json()

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (status) {
      updates.status = status
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString()
      }
      if (status === 'canceled') {
        updates.canceled_at = new Date().toISOString()
      }
    }

    if (providerNotes !== undefined) {
      updates.provider_notes = providerNotes
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', appointmentId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ appointment: data })
  } catch (err: any) {
    console.error('Failed to update appointment:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
