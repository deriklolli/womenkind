import { NextRequest, NextResponse } from 'next/server'
import { disconnectCalendar } from '@/lib/google-calendar'

/**
 * POST /api/auth/google/disconnect
 * Disconnects a provider's Google Calendar integration.
 */
export async function POST(req: NextRequest) {
  try {
    const { providerId } = await req.json()
    if (!providerId) {
      return NextResponse.json({ error: 'providerId required' }, { status: 400 })
    }

    await disconnectCalendar(providerId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Calendar disconnect error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
