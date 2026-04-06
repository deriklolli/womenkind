import { NextRequest, NextResponse } from 'next/server'
import { getOuraConnection } from '@/lib/oura'

/**
 * GET /api/wearables/status?patientId=xxx
 * Returns connection status for a patient's wearable devices.
 */
export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get('patientId')
    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    const connection = await getOuraConnection(patientId)

    if (!connection) {
      return NextResponse.json({ connected: false, provider: null })
    }

    return NextResponse.json({
      connected: true,
      provider: 'oura',
      connectedAt: connection.connected_at,
      lastSyncedAt: connection.last_synced_at,
    })
  } catch (err: any) {
    console.error('Wearable status error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
