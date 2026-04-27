import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id param required' }, { status: 400 })

  const intake = await db.query.intakes.findFirst({
    where: eq(intakes.id, id),
    columns: { id: true, status: true, submitted_at: true },
  })

  if (!intake) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (intake.status !== 'draft' || intake.submitted_at !== null) {
    return NextResponse.json({ error: 'refusing to delete non-draft or submitted intake' }, { status: 400 })
  }

  await db.delete(intakes).where(and(eq(intakes.id, id), eq(intakes.status, 'draft')))
  return NextResponse.json({ deleted: id })
}
