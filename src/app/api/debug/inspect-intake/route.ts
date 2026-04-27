import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id param required' }, { status: 400 })

  const intake = await db.query.intakes.findFirst({
    where: eq(intakes.id, id),
  })

  if (!intake) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const answers = (intake.answers as Record<string, unknown>) ?? {}
  return NextResponse.json({
    id: intake.id,
    status: intake.status,
    submitted_at: intake.submitted_at,
    answer_keys: Object.keys(answers),
    answer_count: Object.keys(answers).length,
    answers,
    has_ai_brief: !!intake.ai_brief,
  })
}
