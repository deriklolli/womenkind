import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, ALL_STAFF, MD_NP } from '@/lib/requireStaffRole'
import { writeAuditEvent } from '@/lib/taskEngine'
import { db } from '@/lib/db'
import { tasks, providers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const TRANSITIONS: Record<string, string[]> = {
  new:             ['acknowledged', 'in_progress'],
  acknowledged:    ['in_progress', 'waiting_patient', 'waiting_md', 'waiting_lab'],
  in_progress:     ['waiting_patient', 'waiting_md', 'waiting_lab', 'resolved'],
  waiting_patient: ['in_progress', 'resolved'],
  waiting_md:      ['in_progress', 'resolved'],
  waiting_lab:     ['in_progress', 'resolved'],
  resolved:        ['closed'],
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, ALL_STAFF)
  if (roleError) return roleError

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, params.id),
  })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const body = await req.json()
  const { status: newStatus, ...rest } = body

  const updates: Record<string, unknown> = { ...rest, updated_at: new Date() }

  if (newStatus && newStatus !== task.status) {
    const allowed = TRANSITIONS[task.status] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid transition: ${task.status} → ${newStatus}` },
        { status: 400 },
      )
    }

    if (newStatus === 'acknowledged') {
      updates.acknowledged_at = new Date()
      updates.acknowledged_by = session!.providerId
    }

    if (newStatus === 'closed') {
      // requires_md_signoff check
      if (task.requires_md_signoff) {
        const staffer = await db.query.providers.findFirst({
          where: eq(providers.id, session!.providerId!),
          columns: { role: true },
        })
        if (!staffer || !MD_NP.includes(staffer.role as 'md' | 'np')) {
          return NextResponse.json(
            { error: 'MD or NP sign-off required to close this task' },
            { status: 403 },
          )
        }
      }

      const safetyOpen = rest.closeout_safety_open ?? task.closeout_safety_open
      if (safetyOpen) {
        return NextResponse.json(
          { error: 'Safety issue still open — cannot close task' },
          { status: 400 },
        )
      }

      const notified = rest.patient_notified ?? task.patient_notified
      if (
        !notified &&
        task.message_category &&
        task.message_category !== 'life_event' &&
        task.priority !== 'gray'
      ) {
        return NextResponse.json(
          { error: 'Patient must be notified before closing this task' },
          { status: 400 },
        )
      }

      const whatWasDone = rest.closeout_what_was_done ?? task.closeout_what_was_done
      const plan        = rest.closeout_plan ?? task.closeout_plan
      const noFollowup  = rest.closeout_no_followup_reason ?? task.closeout_no_followup_reason
      const followupTask = rest.follow_up_task_id ?? task.follow_up_task_id

      if (!whatWasDone || !plan) {
        return NextResponse.json(
          { error: 'closeout_what_was_done and closeout_plan are required to close' },
          { status: 400 },
        )
      }
      if (!followupTask && !noFollowup) {
        return NextResponse.json(
          { error: 'Either follow_up_task_id or closeout_no_followup_reason is required to close' },
          { status: 400 },
        )
      }

      updates.closed_at = new Date()
      updates.closed_by = session!.providerId
    }

    updates.status = newStatus
  }

  await db.update(tasks).set(updates).where(eq(tasks.id, params.id))

  await writeAuditEvent({
    user_id: session!.userId,
    staff_id: session!.providerId ?? undefined,
    patient_id: task.patient_id,
    action: newStatus ? `TASK_${String(newStatus).toUpperCase()}` : 'TASK_UPDATED',
    resource_type: 'task',
    resource_id: params.id,
    metadata: { previousStatus: task.status, newStatus },
  })

  const updated = await db.query.tasks.findFirst({ where: eq(tasks.id, params.id) })
  return NextResponse.json({ task: updated })
}
