import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { provider_availability } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * PATCH /api/provider/availability/[id]
 * Updates a single field on a provider availability slot.
 * Body: { field: 'start_time' | 'end_time' | 'is_active', value: string | boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { field, value } = body

  const allowed = ['start_time', 'end_time', 'is_active']
  if (!field || !allowed.includes(field)) {
    return NextResponse.json({ error: `field must be one of: ${allowed.join(', ')}` }, { status: 400 })
  }

  const [updated] = await db
    .update(provider_availability)
    .set({ [field]: value })
    .where(
      and(
        eq(provider_availability.id, params.id),
        eq(provider_availability.provider_id, session.providerId)
      )
    )
    .returning({
      id: provider_availability.id,
      day_of_week: provider_availability.day_of_week,
      start_time: provider_availability.start_time,
      end_time: provider_availability.end_time,
      is_active: provider_availability.is_active,
    })

  if (!updated) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  }

  return NextResponse.json({ slot: updated })
}

/**
 * DELETE /api/provider/availability/[id]
 * Deletes a provider availability slot.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [deleted] = await db
    .delete(provider_availability)
    .where(
      and(
        eq(provider_availability.id, params.id),
        eq(provider_availability.provider_id, session.providerId)
      )
    )
    .returning({ id: provider_availability.id })

  if (!deleted) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
