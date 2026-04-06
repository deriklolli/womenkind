import { NextRequest, NextResponse } from 'next/server'
import { getOuraConnection, syncOuraData } from '@/lib/oura'

/**
 * POST /api/wearables/sync
 * Triggers a data sync for a patient's connected wearable.
 * Body: { patientId, days?: number }
 * Default: syncs last 7 days. Pass days=30 for a deeper pull.
 */
export async function POST(req: NextRequest) {
  try {
    const { patientId, days = 7 } = await req.json()
    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const connection = await getOuraConnection(patientId)
    if (!connection) {
      return NextResponse.json({ error: 'No active Oura connection' }, { status: 404 })
    }

    const result = await syncOuraData(connection.id, patientId, days)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Wearable sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
