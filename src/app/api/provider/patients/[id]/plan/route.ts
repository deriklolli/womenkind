import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const { current_plan, next_step } = await req.json()

  const updates: Record<string, unknown> = {}
  if (current_plan !== undefined) updates.current_plan = current_plan || null
  if (next_step !== undefined) updates.next_step = next_step || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await db
    .update(patients)
    .set(updates as Partial<typeof patients.$inferInsert>)
    .where(eq(patients.id, params.id))

  return NextResponse.json({ ok: true })
}
