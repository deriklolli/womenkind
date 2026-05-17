import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients, tasks, prescription_changes, visits } from '@/lib/db/schema'
import { and, eq, notInArray, sql, asc, desc } from 'drizzle-orm'

export const maxDuration = 60

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, params.id),
    columns: {
      id: true,
      current_plan: true,
      next_step: true,
      last_md_review_at: true,
      last_meaningful_touch_at: true,
    },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const [activeTasks, rxHistory, recentVisits] = await Promise.all([
    db.query.tasks.findMany({
      where: and(
        eq(tasks.patient_id, params.id),
        notInArray(tasks.status, ['resolved', 'closed']),
      ),
      orderBy: (t, { asc }) => [
        sql`CASE ${t.priority} WHEN 'red' THEN 0 WHEN 'orange' THEN 1 WHEN 'yellow' THEN 2 WHEN 'blue' THEN 3 ELSE 4 END`,
        asc(t.due_at),
      ],
    }),
    db.query.prescription_changes.findMany({
      where: eq(prescription_changes.patient_id, params.id),
      orderBy: (r, { desc }) => [desc(r.created_at)],
      limit: 20,
    }),
    db.query.visits.findMany({
      where: eq(visits.patient_id, params.id),
      orderBy: (v, { desc }) => [desc(v.visit_date)],
      limit: 10,
      columns: { visit_date: true, source: true, visit_type: true },
    }),
  ])

  return NextResponse.json({
    patient,
    liveWmi: null,
    activeTasks,
    rxHistory,
    recentVisits,
  })
}
