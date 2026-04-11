import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { getServerSession } from '@/lib/getServerSession'
import { logPhiAccess } from '@/lib/phi-audit'

/**
 * GET /api/prescriptions?patientId=xxx
 * Returns active prescriptions for a patient with days remaining calculated.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const patientId = req.nextUrl.searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .order('runs_out_at', { ascending: true })

    if (error) throw error

    const now = new Date()
    const prescriptions = (data || []).map((rx) => {
      const runsOutAt = new Date(rx.runs_out_at)
      const daysRemaining = Math.max(0, Math.ceil((runsOutAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      const refillsRemaining = (rx.refills || 0) - (rx.refills_used || 0)

      return {
        id: rx.id,
        medicationName: rx.medication_name,
        dosage: rx.dosage,
        frequency: rx.frequency,
        quantityDispensed: rx.quantity_dispensed,
        refillsAuthorized: rx.refills || 0,
        refillsUsed: rx.refills_used || 0,
        refillsRemaining,
        prescribedAt: rx.prescribed_at,
        lastFilledAt: rx.last_filled_at,
        runsOutAt: rx.runs_out_at,
        daysRemaining,
        needsRefillSoon: daysRemaining <= 10,
        status: rx.status,
      }
    })

    logPhiAccess({ patientId, recordType: 'prescription', action: 'read', route: '/api/prescriptions', req })
    return NextResponse.json({ prescriptions })
  } catch (err: any) {
    console.error('Failed to fetch prescriptions:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
