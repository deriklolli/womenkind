import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { intakes, subscriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const row = await db.query.intakes.findFirst({
    where: eq(intakes.id, params.id),
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let isMember = false
  if (row.patient_id) {
    const sub = await db.query.subscriptions.findFirst({
      where: (s, { and, eq: eqOp }) =>
        and(eqOp(s.patient_id, row.patient_id!), eqOp(s.plan_type, 'membership'), eqOp(s.status, 'active')),
    })
    isMember = !!sub
  }

  return NextResponse.json({ intake: row, isMember })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.provider_notes !== undefined) updates.provider_notes = body.provider_notes
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'reviewed') updates.reviewed_at = new Date()
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  await db.update(intakes).set(updates).where(eq(intakes.id, params.id))
  return NextResponse.json({ ok: true })
}
