import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, ALL_STAFF } from '@/lib/requireStaffRole'
import { createTask, writeAuditEvent } from '@/lib/taskEngine'
import type { TaskPriority } from '@/lib/taskEngine'
import { db } from '@/lib/db'
import { tasks, providers } from '@/lib/db/schema'
import { and, eq, inArray, notInArray, desc, or, SQL } from 'drizzle-orm'

const MESSAGE_CATEGORY_DEFAULTS: Record<string, { priority: TaskPriority; ownerRole: string }> = {
  red_flag:        { priority: 'red',    ownerRole: 'md' },
  clinical_update: { priority: 'orange', ownerRole: 'rn' },
  side_effect:     { priority: 'orange', ownerRole: 'rn' },
  dose_question:   { priority: 'orange', ownerRole: 'md' },
  adherence:       { priority: 'yellow', ownerRole: 'rn' },
  pharmacy:        { priority: 'yellow', ownerRole: 'admin' },
  frustration:     { priority: 'yellow', ownerRole: 'concierge' },
  life_event:      { priority: 'gray',   ownerRole: 'rn' },
}

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, ALL_STAFF)
  if (roleError) return roleError

  const { searchParams } = new URL(req.url)
  const patientId    = searchParams.get('patientId')
  const status       = searchParams.get('status')
  const priority     = searchParams.get('priority')
  const category     = searchParams.get('category')
  const assignedToMe = searchParams.get('assignedToMe') === 'true'
  const queue        = searchParams.get('queue') // 'md' | 'rn' | 'admin'

  const conditions: SQL[] = []

  if (patientId)    conditions.push(eq(tasks.patient_id, patientId))
  if (status)       conditions.push(eq(tasks.status, status))
  if (priority)     conditions.push(eq(tasks.priority, priority))
  if (category)     conditions.push(eq(tasks.category, category))
  if (assignedToMe && session!.providerId) {
    conditions.push(eq(tasks.owner_staff_id, session!.providerId))
  }

  if (queue === 'rn') {
    conditions.push(inArray(tasks.priority, ['orange', 'yellow']))
    conditions.push(notInArray(tasks.status, ['resolved', 'closed']))
  } else if (queue === 'admin') {
    conditions.push(inArray(tasks.category, ['service', 'admin', 'unable_to_reach']))
    conditions.push(notInArray(tasks.status, ['resolved', 'closed']))
  } else if (queue === 'md') {
    const mdFilter = or(
      eq(tasks.priority, 'red'),
      and(eq(tasks.priority, 'orange'), eq(tasks.requires_md_signoff, true)),
    )
    if (mdFilter) conditions.push(mdFilter)
    conditions.push(notInArray(tasks.status, ['resolved', 'closed']))
  }

  const whereClause = conditions.length > 0 ? and(...(conditions as [SQL, ...SQL[]])) : undefined

  const rows = await db.query.tasks.findMany({
    where: whereClause,
    orderBy: [desc(tasks.updated_at)],
    limit: 200,
  })

  return NextResponse.json({ tasks: rows })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, ALL_STAFF)
  if (roleError) return roleError

  const body = await req.json()
  const {
    patient_id, title, body: taskBody, category, priority, source, source_ref,
    owner_staff_id, backup_owner_staff_id, message_category, due_at, requires_md_signoff,
  } = body

  if (!patient_id || !title || !category || !priority || !source) {
    return NextResponse.json(
      { error: 'patient_id, title, category, priority, source are required' },
      { status: 400 },
    )
  }

  if ((priority === 'red' || priority === 'orange') && !backup_owner_staff_id) {
    return NextResponse.json(
      { error: 'backup_owner_staff_id required for red and orange tasks' },
      { status: 400 },
    )
  }

  let resolvedOwner: string | undefined = owner_staff_id
  if (source === 'patient_message' && message_category && !resolvedOwner) {
    const defaults = MESSAGE_CATEGORY_DEFAULTS[message_category]
    if (defaults) {
      const defaultOwner = await db.query.providers.findFirst({
        where: and(eq(providers.role, defaults.ownerRole), eq(providers.is_active, true)),
        columns: { id: true },
      })
      resolvedOwner = defaultOwner?.id
    }
  }

  const taskId = await createTask({
    patient_id, title, body: taskBody, category, priority: priority as TaskPriority,
    owner_staff_id: resolvedOwner, backup_owner_staff_id, source, source_ref,
    message_category, due_at: due_at ? new Date(due_at) : undefined,
    requires_md_signoff: requires_md_signoff ?? false,
  })

  await writeAuditEvent({
    user_id: session!.userId,
    staff_id: session!.providerId ?? undefined,
    patient_id,
    action: 'TASK_CREATED',
    resource_type: 'task',
    resource_id: taskId,
    metadata: { category, priority, source },
  })

  return NextResponse.json({ taskId }, { status: 201 })
}
