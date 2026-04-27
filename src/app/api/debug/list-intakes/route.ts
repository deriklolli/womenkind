import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId param required' }, { status: 400 })

  const rows = await db.query.intakes.findMany({
    where: eq(intakes.patient_id, patientId),
    orderBy: [desc(intakes.created_at)],
    columns: {
      id: true,
      status: true,
      submitted_at: true,
      created_at: true,
      answers: true,
    },
  })

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      submitted_at: r.submitted_at,
      created_at: r.created_at,
      answer_count: Object.keys((r.answers as Record<string, unknown>) ?? {}).length,
      answer_keys: Object.keys((r.answers as Record<string, unknown>) ?? {}),
    }))
  )
}
