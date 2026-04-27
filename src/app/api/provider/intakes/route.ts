import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { inArray, desc } from 'drizzle-orm'

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await db.query.intakes.findMany({
    where: inArray(intakes.status, ['submitted', 'reviewed', 'care_plan_sent']),
    orderBy: [desc(intakes.submitted_at)],
    columns: {
      id: true,
      status: true,
      answers: true,
      submitted_at: true,
      ai_brief: true,
      patient_id: true,
    },
    with: {
      patients: {
        columns: {},
        with: {
          subscriptions: {
            columns: { status: true, plan_type: true },
          },
        },
      },
    },
  })

  return NextResponse.json({ intakes: rows })
}
