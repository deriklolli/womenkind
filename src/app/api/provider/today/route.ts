import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { and, eq, inArray, notInArray, lt, count, or } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export const maxDuration = 60

export async function GET(_req: NextRequest) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const openStatuses = ['new', 'acknowledged', 'in_progress', 'waiting_patient', 'waiting_md', 'waiting_lab']

  const [
    redTasks,
    mdDecisions,
    rnEscalations,
    labsPending,
    medFollowups,
    overdueTasks,
    messagesOverSla,
    outcomesWatch,
  ] = await Promise.all([
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.priority, 'red'), inArray(tasks.status, openStatuses))
    ),
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.priority, 'orange'), eq(tasks.requires_md_signoff, true), inArray(tasks.status, openStatuses))
    ),
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.category, 'rn_escalation'), inArray(tasks.status, openStatuses))
    ),
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.category, 'lab'), inArray(tasks.status, openStatuses))
    ),
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.source, 'med_change'), inArray(tasks.status, openStatuses))
    ),
    db.select({ count: count() }).from(tasks).where(
      and(lt(tasks.due_at, new Date()), inArray(tasks.status, openStatuses))
    ),
    db.select({ count: count() }).from(tasks).where(
      and(
        eq(tasks.category, 'message'),
        inArray(tasks.priority, ['red', 'orange']),
        inArray(tasks.status, openStatuses),
      )
    ),
    db.select({ count: count() }).from(tasks).where(
      and(eq(tasks.source, 'score_drop'), inArray(tasks.status, openStatuses))
    ),
  ])

  const priorityQueue = await db.query.tasks.findMany({
    where: and(inArray(tasks.status, openStatuses)),
    orderBy: (t, { asc }) => [
      sql`CASE ${t.priority} WHEN 'red' THEN 0 WHEN 'orange' THEN 1 WHEN 'yellow' THEN 2 WHEN 'blue' THEN 3 ELSE 4 END`,
      asc(t.due_at),
    ],
    limit: 50,
  })

  return NextResponse.json({
    commandBar: {
      red:             redTasks[0].count,
      mdDecisions:     mdDecisions[0].count,
      rnEscalations:   rnEscalations[0].count,
      labsPending:     labsPending[0].count,
      medFollowups:    medFollowups[0].count,
      overdue:         overdueTasks[0].count,
      messagesOverSla: messagesOverSla[0].count,
      outcomesWatch:   outcomesWatch[0].count,
    },
    priorityQueue,
  })
}
