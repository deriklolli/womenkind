import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/refill-requests?patientId=xxx  — patient's own requests
 * GET /api/refill-requests?providerId=xxx — provider's queue
 * GET /api/refill-requests?providerId=xxx&status=pending — filtered
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const patientId = req.nextUrl.searchParams.get('patientId')
    const providerId = req.nextUrl.searchParams.get('providerId')
    const status = req.nextUrl.searchParams.get('status')

    let query = supabase
      .from('refill_requests')
      .select(`
        *,
        prescriptions(medication_name, dosage, frequency),
        patients(
          id,
          profiles(first_name, last_name, email)
        )
      `)
      .order('created_at', { ascending: false })

    if (patientId) query = query.eq('patient_id', patientId)
    if (providerId) query = query.eq('provider_id', providerId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ refillRequests: data })
  } catch (err: any) {
    console.error('Failed to fetch refill requests:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/refill-requests
 * Patient submits a new refill request.
 * Body: { prescriptionId, patientId, providerId, patientNote? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const { prescriptionId, patientId, providerId, patientNote } = await req.json()

    if (!prescriptionId || !patientId || !providerId) {
      return NextResponse.json(
        { error: 'prescriptionId, patientId, and providerId are required' },
        { status: 400 }
      )
    }

    // Check for existing pending request for this prescription
    const { data: existing } = await supabase
      .from('refill_requests')
      .select('id')
      .eq('prescription_id', prescriptionId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'A pending refill request already exists for this prescription', existingId: existing.id },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('refill_requests')
      .insert({
        prescription_id: prescriptionId,
        patient_id: patientId,
        provider_id: providerId,
        patient_note: patientNote || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ refillRequest: data })
  } catch (err: any) {
    console.error('Failed to create refill request:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/refill-requests
 * Provider approves or denies a refill request.
 * Body: { requestId, status: 'approved' | 'denied', providerNote? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const { requestId, status, providerNote } = await req.json()

    if (!requestId || !status) {
      return NextResponse.json({ error: 'requestId and status are required' }, { status: 400 })
    }

    if (!['approved', 'denied'].includes(status)) {
      return NextResponse.json({ error: 'status must be approved or denied' }, { status: 400 })
    }

    // Update the refill request
    const { data: request, error: updateError } = await supabase
      .from('refill_requests')
      .update({
        status,
        provider_note: providerNote || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*, prescriptions(id, medication_name, quantity_dispensed, doses_per_day, refills, refills_used, last_filled_at)')
      .single()

    if (updateError) throw updateError

    // If approved, update the prescription
    if (status === 'approved' && request.prescriptions) {
      const rx = request.prescriptions
      const newRefillsUsed = (rx.refills_used || 0) + 1
      const now = new Date()
      const daysSupply = Math.ceil((rx.quantity_dispensed || 30) / (rx.doses_per_day || 1))
      const newRunsOutAt = new Date(now.getTime() + daysSupply * 24 * 60 * 60 * 1000)

      await supabase
        .from('prescriptions')
        .update({
          refills_used: newRefillsUsed,
          last_filled_at: now.toISOString(),
          runs_out_at: newRunsOutAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', rx.id)
    }

    return NextResponse.json({ refillRequest: request })
  } catch (err: any) {
    console.error('Failed to update refill request:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
