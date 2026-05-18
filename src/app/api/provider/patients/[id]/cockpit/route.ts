import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients, tasks, prescription_changes, visits, intakes } from '@/lib/db/schema'
import { and, eq, ne, notInArray, sql, asc, desc } from 'drizzle-orm'
import { computeLiveWMI } from '@/lib/wmi-scoring'

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

  const [activeTasks, rxHistory] = await Promise.all([
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
  ])

  // Compute live WMI from the most recent daily check-ins
  const [dailyCheckIns] = await Promise.all([
    db.query.visits.findMany({
      where: and(
        eq(visits.patient_id, params.id),
        eq(visits.source, 'daily' as any),
      ),
      orderBy: (v, { desc }) => [desc(v.visit_date)],
      limit: 7,
      columns: { symptom_scores: true, visit_date: true, source: true },
    }),
  ])

  const checkInsForWmi = dailyCheckIns.map(v => ({
    symptom_scores: v.symptom_scores as Record<string, number> | null,
    visit_date: v.visit_date,
    source: v.source,
  }))
  const liveWmi = dailyCheckIns.length > 0 ? computeLiveWMI(checkInsForWmi) : null

  // Fall back to intake WMI when no check-ins exist yet
  let intakeWmi: number | null = null
  if (liveWmi == null) {
    const latestIntake = await db.query.intakes.findFirst({
      where: and(eq(intakes.patient_id, params.id), ne(intakes.status, 'draft')),
      columns: { wmi_scores: true },
      orderBy: [desc(intakes.submitted_at)],
    })
    intakeWmi = (latestIntake?.wmi_scores as any)?.wmi ?? null
  }

  return NextResponse.json({
    patient,
    liveWmi: liveWmi ?? intakeWmi,
    activeTasks,
    rxHistory,
  })
}
