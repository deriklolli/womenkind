import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, CAN_ESCALATE } from '@/lib/requireStaffRole'
import { createTask, writeAuditEvent } from '@/lib/taskEngine'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, CAN_ESCALATE)
  if (roleError) return roleError

  const {
    patient_id, situation, background, assessment, recommendation,
    priority, backup_owner_staff_id,
  } = await req.json().catch(() => ({}))

  if (!patient_id || !situation || !priority || !backup_owner_staff_id) {
    return NextResponse.json(
      { error: 'patient_id, situation, priority, backup_owner_staff_id are required' },
      { status: 400 },
    )
  }
  if (!['orange', 'red'].includes(priority)) {
    return NextResponse.json({ error: 'SBAR priority must be orange or red' }, { status: 400 })
  }

  const bodyParts = [
    `S: ${situation}`,
    background     ? `B: ${background}` : null,
    assessment     ? `A: ${assessment}` : null,
    recommendation ? `R: ${recommendation}` : null,
  ].filter(Boolean).join('\n\n')

  const taskId = await createTask({
    patient_id,
    title: `SBAR escalation — ${priority === 'red' ? 'URGENT' : 'urgent'}`,
    body: bodyParts,
    category: 'rn_escalation',
    priority,
    source: 'rn_note',
    backup_owner_staff_id,
    requires_md_signoff: true,
  })

  await writeAuditEvent({
    user_id: session!.userId,
    staff_id: session!.providerId ?? undefined,
    patient_id,
    action: 'SBAR_SUBMITTED',
    resource_type: 'task',
    resource_id: taskId,
    metadata: { priority },
  })

  return NextResponse.json({ taskId }, { status: 201 })
}
