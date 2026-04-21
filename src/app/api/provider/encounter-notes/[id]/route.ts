import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { encounter_notes } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * PATCH /api/provider/encounter-notes/[id]
 *
 * Update SOAP fields on a draft encounter note, or sign it (status → 'signed').
 * Body: partial EncounterNote fields, or { status: 'signed' }
 *
 * Only the owning provider may update. Signed notes cannot be edited again
 * (only signing is allowed on draft notes).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Verify ownership — only the provider who owns the note may modify it
  const existing = await db.query.encounter_notes.findFirst({
    where: and(
      eq(encounter_notes.id, id),
      eq(encounter_notes.provider_id, session.providerId)
    ),
    columns: { id: true, status: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 })
  }

  const body = await req.json()

  // Only allow updating SOAP fields and status (sign action)
  const allowed = ['chief_complaint', 'hpi', 'ros', 'assessment', 'plan', 'status'] as const
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  await db
    .update(encounter_notes)
    .set(updates as Partial<typeof encounter_notes.$inferInsert>)
    .where(
      and(
        eq(encounter_notes.id, id),
        eq(encounter_notes.provider_id, session.providerId)
      )
    )

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/provider/encounter-notes/[id]
 *
 * Delete an encounter note. Only the owning provider may delete,
 * and only notes that are not yet signed.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Verify ownership and that note is not signed
  const existing = await db.query.encounter_notes.findFirst({
    where: and(
      eq(encounter_notes.id, id),
      eq(encounter_notes.provider_id, session.providerId)
    ),
    columns: { id: true, status: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 })
  }

  if (existing.status === 'signed') {
    return NextResponse.json({ error: 'Signed notes cannot be deleted' }, { status: 403 })
  }

  await db
    .delete(encounter_notes)
    .where(
      and(
        eq(encounter_notes.id, id),
        eq(encounter_notes.provider_id, session.providerId)
      )
    )

  return NextResponse.json({ success: true })
}
