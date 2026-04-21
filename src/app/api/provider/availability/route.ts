import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { provider_availability } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

/**
 * GET /api/provider/availability
 * Returns all availability slots for the authenticated provider.
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const slots = await db
    .select({
      id: provider_availability.id,
      day_of_week: provider_availability.day_of_week,
      start_time: provider_availability.start_time,
      end_time: provider_availability.end_time,
      is_active: provider_availability.is_active,
    })
    .from(provider_availability)
    .where(eq(provider_availability.provider_id, session.providerId))
    .orderBy(asc(provider_availability.day_of_week))

  return NextResponse.json({ slots })
}

/**
 * POST /api/provider/availability
 * Inserts a new availability slot for the authenticated provider.
 * Body: { day_of_week, start_time, end_time, is_active }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { day_of_week, start_time, end_time, is_active } = body

  if (day_of_week === undefined || !start_time || !end_time) {
    return NextResponse.json({ error: 'day_of_week, start_time, and end_time are required' }, { status: 400 })
  }

  const [slot] = await db
    .insert(provider_availability)
    .values({
      provider_id: session.providerId,
      day_of_week,
      start_time,
      end_time,
      is_active: is_active ?? true,
    })
    .returning({
      id: provider_availability.id,
      day_of_week: provider_availability.day_of_week,
      start_time: provider_availability.start_time,
      end_time: provider_availability.end_time,
      is_active: provider_availability.is_active,
    })

  return NextResponse.json({ slot }, { status: 201 })
}
