import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * GET /api/wearables/metrics?patientId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&metricType=sleep_score
 * Returns wearable metrics for a patient, sorted by date ascending.
 * metricType is optional — omit to get all types.
 */
export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get('patientId')
    const startDate = req.nextUrl.searchParams.get('startDate')
    const endDate = req.nextUrl.searchParams.get('endDate')
    const metricType = req.nextUrl.searchParams.get('metricType')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const supabase = getSupabase()
    let query = supabase
      .from('wearable_metrics')
      .select('metric_date, metric_type, value, synced_at')
      .eq('patient_id', patientId)
      .order('metric_date', { ascending: true })

    if (startDate) query = query.gte('metric_date', startDate)
    if (endDate) query = query.lte('metric_date', endDate)
    if (metricType) query = query.eq('metric_type', metricType)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ metrics: data || [] })
  } catch (err: any) {
    console.error('Wearable metrics error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
