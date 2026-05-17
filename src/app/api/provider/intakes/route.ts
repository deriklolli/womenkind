import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, ALL_STAFF } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { inArray, desc } from 'drizzle-orm'

export async function GET() {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, ALL_STAFF)
  if (roleError) return roleError

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
