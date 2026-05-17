import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, ALL_STAFF } from '@/lib/requireStaffRole'
import { createTask, writeAuditEvent } from '@/lib/taskEngine'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, ALL_STAFF)
  if (roleError) return roleError

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, params.id) })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { contact_method, notes } = await req.json().catch(() => ({}))

  const newAttempts = (task.contact_attempts ?? 0) + 1

  await db.update(tasks)
    .set({
      contact_attempts:     newAttempts,
      last_contact_attempt: new Date(),
      updated_at:           new Date(),
    })
    .where(eq(tasks.id, params.id))

  await writeAuditEvent({
    user_id: session!.userId,
    staff_id: session!.providerId ?? undefined,
    patient_id: task.patient_id,
    action: 'CONTACT_ATTEMPTED',
    resource_type: 'task',
    resource_id: params.id,
    metadata: { attempt: newAttempts, contact_method, notes },
  })

  if (newAttempts >= 3) {
    const escalationId = await createTask({
      patient_id: task.patient_id,
      title: `Unable to reach patient — escalation after ${newAttempts} attempts`,
      body: `Original task: ${task.title}. Last method: ${contact_method ?? 'unspecified'}`,
      category: 'unable_to_reach',
      priority: 'orange',
      source: 'unable_to_reach',
      source_ref: task.id,
      requires_md_signoff: false,
    })
    return NextResponse.json({ attempts: newAttempts, escalationTaskId: escalationId })
  }

  return NextResponse.json({ attempts: newAttempts })
}
