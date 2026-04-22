import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { and, eq, gte, desc } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/provider/recent-cancellations?providerId=xxx
 *
 * Returns appointments canceled by a patient in the last 72 hours,
 * for surfacing a "recently canceled" alert on the provider dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session || session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const providerId = req.nextUrl.searchParams.get('providerId')
    if (!providerId) {
      return NextResponse.json({ error: 'providerId required' }, { status: 400 })
    }

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000)

    const data = await db.query.appointments.findMany({
      where: and(
        eq(appointments.provider_id, providerId),
        eq(appointments.status, 'canceled'),
        eq(appointments.canceled_by, 'patient'),
        gte(appointments.canceled_at, cutoff),
      ),
      with: {
        appointment_types: true,
        patients: { with: { profiles: true } },
      },
      orderBy: [desc(appointments.canceled_at)],
      limit: 10,
    })

    return NextResponse.json({ appointments: data })
  } catch (err: any) {
    console.error('Failed to fetch recent cancellations:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
