import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { createTask } from '@/lib/taskEngine'
import { db } from '@/lib/db'
import { prescription_changes, prescriptions, patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const CADENCE_TYPES = new Set(['started', 'dose_increased', 'dose_decreased', 'formulation_changed'])

interface CadenceTask {
  daysOffset: number
  role: 'rn' | 'md'
  priority: 'yellow' | 'orange' | 'blue'
  titleFn: (med: string) => string
}

const CADENCE: CadenceTask[] = [
  { daysOffset: 4,   role: 'rn', priority: 'yellow', titleFn: m => `Confirm patient understood plan, obtained ${m}, no urgent side effects` },
  { daysOffset: 28,  role: 'rn', priority: 'yellow', titleFn: m => `4-week early check-in — ${m}` },
  { daysOffset: 56,  role: 'rn', priority: 'blue',   titleFn: m => `8-week trend review — ${m}` },
  { daysOffset: 84,  role: 'md', priority: 'orange', titleFn: m => `12-week meaningful response review — ${m}` },
  { daysOffset: 365, role: 'md', priority: 'blue',   titleFn: m => `Annual benefit/risk review — ${m}` },
]

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; rxId: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const { change_type, new_dosage, reason } = await req.json()

  if (!change_type) {
    return NextResponse.json({ error: 'change_type is required' }, { status: 400 })
  }

  const rx = await db.query.prescriptions.findFirst({
    where: eq(prescriptions.id, params.rxId),
    columns: { id: true, medication_name: true, dosage: true, status: true },
  })
  if (!rx) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })

  // Insert the change record
  const [change] = await db.insert(prescription_changes).values({
    prescription_id: params.rxId,
    patient_id:      params.id,
    provider_id:     session!.providerId!,
    change_type,
    previous_dosage: rx.dosage ?? null,
    new_dosage:      new_dosage ?? null,
    previous_status: rx.status ?? null,
    new_status:      change_type === 'stopped' ? 'inactive' : rx.status ?? null,
    reason:          reason ?? null,
  }).returning({ id: prescription_changes.id })

  // Update last_meaningful_touch_at on patient
  await db.update(patients)
    .set({ last_meaningful_touch_at: new Date() })
    .where(eq(patients.id, params.id))

  // Create follow-up task cadence if applicable
  const scheduledTasks: Array<{ title: string; dueAt: string }> = []
  if (CADENCE_TYPES.has(change_type)) {
    const now = new Date()
    const cadenceItems = CADENCE.map(step => ({
      dueAt: addDays(now, step.daysOffset),
      title: step.titleFn(rx.medication_name),
      step,
    }))
    await Promise.all(cadenceItems.map(({ dueAt, title, step }) =>
      createTask({
        patient_id:          params.id,
        title,
        category:            'med',
        priority:            step.priority,
        source:              'med_change',
        source_ref:          change.id,
        due_at:              dueAt,
        requires_md_signoff: step.role === 'md',
      })
    ))
    scheduledTasks.push(...cadenceItems.map(({ title, dueAt }) => ({
      title,
      dueAt: dueAt.toISOString(),
    })))
  }

  return NextResponse.json({
    changeId: change.id,
    scheduledTasks,
  }, { status: 201 })
}
