import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, CLINICAL_STAFF } from '@/lib/requireStaffRole'
import { createTask, writeAuditEvent } from '@/lib/taskEngine'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type Disposition =
  | 'fyi'
  | 'patient_contacted'
  | 'needs_md_review'
  | 'same_day_md_review'
  | 'unable_to_reach'
  | 'resolved_by_protocol'
  | 'service_issue'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, CLINICAL_STAFF)
  if (roleError) return roleError

  const body = await req.json().catch(() => ({})) as {
    patient_id?: string
    note?: string
    disposition?: Disposition
    task_id?: string
    backup_owner_staff_id?: string
    protocol_name?: string
    closeout_what_was_done?: string
  }

  const { patient_id, note, disposition, task_id, backup_owner_staff_id, protocol_name, closeout_what_was_done } = body

  if (!patient_id || !note || !disposition) {
    return NextResponse.json({ error: 'patient_id, note, and disposition are required' }, { status: 400 })
  }

  let resultTaskId: string | undefined

  switch (disposition) {
    case 'fyi':
      break

    case 'patient_contacted':
      resultTaskId = await createTask({
        patient_id, title: 'Follow-up: patient contacted',
        body: note, category: 'clinical', priority: 'yellow', source: 'rn_note',
      })
      break

    case 'needs_md_review':
      if (!backup_owner_staff_id) {
        return NextResponse.json({ error: 'backup_owner_staff_id required for MD review tasks' }, { status: 400 })
      }
      resultTaskId = await createTask({
        patient_id, title: 'RN escalation — needs MD review',
        body: note, category: 'rn_escalation', priority: 'orange',
        source: 'rn_note', backup_owner_staff_id, requires_md_signoff: true,
      })
      break

    case 'same_day_md_review':
      if (!backup_owner_staff_id) {
        return NextResponse.json({ error: 'backup_owner_staff_id required for same-day MD review' }, { status: 400 })
      }
      resultTaskId = await createTask({
        patient_id, title: 'URGENT: same-day MD review required',
        body: note, category: 'rn_escalation', priority: 'red',
        source: 'rn_note', backup_owner_staff_id, requires_md_signoff: true,
        due_at: new Date(),
      })
      break

    case 'unable_to_reach':
      resultTaskId = await createTask({
        patient_id, title: 'Unable to reach patient',
        body: note, category: 'unable_to_reach', priority: 'orange', source: 'unable_to_reach',
      })
      break

    case 'resolved_by_protocol':
      if (!protocol_name || !closeout_what_was_done) {
        return NextResponse.json(
          { error: 'protocol_name and closeout_what_was_done required for resolved_by_protocol' },
          { status: 400 },
        )
      }
      if (task_id) {
        await db.update(tasks).set({
          status:                  'closed',
          closed_at:               new Date(),
          closed_by:               session!.providerId,
          closeout_what_was_done,
          closeout_plan:           `Resolved per protocol: ${protocol_name}`,
          closeout_no_followup_reason: 'Protocol resolution — no further follow-up needed',
          updated_at:              new Date(),
        }).where(eq(tasks.id, task_id))
      }
      break

    case 'service_issue':
      resultTaskId = await createTask({
        patient_id, title: 'Service issue reported by RN',
        body: note, category: 'service', priority: 'blue', source: 'rn_note',
      })
      break

    default:
      return NextResponse.json({ error: `Unknown disposition: ${disposition}` }, { status: 400 })
  }

  await writeAuditEvent({
    user_id: session!.userId,
    staff_id: session!.providerId ?? undefined,
    patient_id,
    action: 'RN_NOTE_CREATED',
    resource_type: 'rn_note',
    metadata: { disposition, task_id, resultTaskId },
  })

  return NextResponse.json({ disposition, taskId: resultTaskId ?? null }, { status: 201 })
}
