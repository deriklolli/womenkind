import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { wearable_metrics } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/wearables/metrics?patientId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&metricType=sleep_score
 * Returns wearable metrics for a patient, sorted by date ascending.
 * metricType is optional — omit to get all types.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = req.nextUrl.searchParams.get('patientId')
    const startDate = req.nextUrl.searchParams.get('startDate')
    const endDate = req.nextUrl.searchParams.get('endDate')
    const metricType = req.nextUrl.searchParams.get('metricType')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    if (session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conditions = [eq(wearable_metrics.patient_id, patientId)]
    if (startDate) conditions.push(gte(wearable_metrics.metric_date, startDate))
    if (endDate) conditions.push(lte(wearable_metrics.metric_date, endDate))
    if (metricType) conditions.push(eq(wearable_metrics.metric_type, metricType))

    const data = await db
      .select({
        metric_date: wearable_metrics.metric_date,
        metric_type: wearable_metrics.metric_type,
        value: wearable_metrics.value,
        synced_at: wearable_metrics.synced_at,
      })
      .from(wearable_metrics)
      .where(and(...conditions))
      .orderBy(wearable_metrics.metric_date)

    return NextResponse.json({ metrics: data })
  } catch (err: any) {
    console.error('Wearable metrics error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
