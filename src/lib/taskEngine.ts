import { db } from '@/lib/db'
import { tasks, audit_events } from '@/lib/db/schema'
import { and, eq, notInArray } from 'drizzle-orm'

export type TaskCategory =
  | 'clinical' | 'lab' | 'med' | 'message'
  | 'rn_escalation' | 'service' | 'admin' | 'unable_to_reach'

export type TaskPriority = 'red' | 'orange' | 'yellow' | 'blue' | 'gray'

export type TaskStatus =
  | 'new' | 'acknowledged' | 'in_progress'
  | 'waiting_patient' | 'waiting_md' | 'waiting_lab'
  | 'resolved' | 'closed'

export type TaskSource =
  | 'patient_message' | 'lab_result' | 'score_drop' | 'refill_window'
  | 'missed_checkin' | 'post_visit' | 'ai_brief' | 'manual'
  | 'med_change' | 'unable_to_reach' | 'rn_note'

export interface CreateTaskInput {
  patient_id: string
  title: string
  body?: string
  category: TaskCategory
  priority: TaskPriority
  owner_staff_id?: string
  backup_owner_staff_id?: string
  source: TaskSource
  source_ref?: string
  message_category?: string
  due_at?: Date
  requires_md_signoff?: boolean
}

/** Returns true if an open task already exists with this patient+source+source_ref (dedup for cron tasks). */
export async function deduplicateTaskCheck(
  patient_id: string,
  source: TaskSource,
  source_ref: string,
): Promise<boolean> {
  const existing = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.patient_id, patient_id),
      eq(tasks.source, source),
      eq(tasks.source_ref, source_ref),
      notInArray(tasks.status, ['resolved', 'closed']),
    ),
    columns: { id: true },
  })
  return !!existing
}

/** Create a task. Returns the new task id. */
export async function createTask(input: CreateTaskInput): Promise<string> {
  const [row] = await db.insert(tasks).values({
    patient_id:            input.patient_id,
    title:                 input.title,
    body:                  input.body ?? null,
    category:              input.category,
    priority:              input.priority,
    owner_staff_id:        input.owner_staff_id ?? null,
    backup_owner_staff_id: input.backup_owner_staff_id ?? null,
    source:                input.source,
    source_ref:            input.source_ref ?? null,
    message_category:      input.message_category ?? null,
    due_at:                input.due_at ?? null,
    requires_md_signoff:   input.requires_md_signoff ?? false,
    updated_at:            new Date(),
  }).returning({ id: tasks.id })
  return row.id
}

/** Write an audit event. Errors are logged but not thrown (fire-and-forget safe). */
export async function writeAuditEvent(params: {
  user_id: string
  staff_id?: string
  patient_id?: string
  action: string
  resource_type: string
  resource_id?: string
  metadata?: Record<string, unknown>
  ip?: string
  user_agent?: string
}): Promise<void> {
  try {
    await db.insert(audit_events).values({
      user_id:       params.user_id,
      staff_id:      params.staff_id ?? null,
      patient_id:    params.patient_id ?? null,
      action:        params.action,
      resource_type: params.resource_type,
      resource_id:   params.resource_id ?? null,
      metadata:      params.metadata ?? null,
      ip:            params.ip ?? null,
      user_agent:    params.user_agent ?? null,
    })
  } catch (err) {
    console.error('writeAuditEvent error:', err)
  }
}
