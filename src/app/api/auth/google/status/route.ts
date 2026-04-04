import { NextRequest, NextResponse } from 'next/server'
import { getCalendarConnectionInfo } from '@/lib/google-calendar'

/**
 * GET /api/auth/google/status?providerId=xxx
 * Returns the current Google Calendar connection status for a provider.
 */
export async function GET(req: NextRequest) {
  try {
    const providerId = req.nextUrl.searchParams.get('providerId')
    if (!providerId) {
      return NextResponse.json({ error: 'providerId required' }, { status: 400 })
    }

    const connection = await getCalendarConnectionInfo(providerId)

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      email: connection.google_email,
      timezone: connection.timezone,
      lastSynced: connection.synced_at,
      connectedAt: connection.created_at,
    })
  } catch (err: any) {
    console.error('Calendar status error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
