# Build 17 — Patient Cockpit + Medication Change Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the patient profile "Overview & Trends" tab to "Cockpit" and replace its content with a compact score strip, since-last-review diff panel, open tasks, domain cards, and a medication timeline accordion that includes a record-change flow auto-scheduling 5 follow-up tasks.

**Architecture:** All new UI lives inside the existing `src/app/provider/patient/[id]/page.tsx` overview tab block — no new pages. Three new API routes handle the diff query, plan save, and medication change + task creation. Three new components (`PlanEditor`, `DiffPanel`, `MedChangeModal`) are self-contained with clear props. Medication change tasks are created via the existing `createTask()` helper from Build 16.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Drizzle ORM + PostgreSQL (AWS RDS), `src/lib/taskEngine.ts` (`createTask`), `src/lib/requireStaffRole.ts` (`MD_NP` guard).

**Design reference:** `docs/superpowers/specs/2026-05-17-build-17-design.md`

---

## File Map

### Created
- `src/app/api/provider/patients/[id]/diff/route.ts` — GET: WMI delta + counts since last_md_review_at
- `src/app/api/provider/patients/[id]/plan/route.ts` — PATCH: update current_plan + next_step
- `src/app/api/provider/patients/[id]/prescriptions/[rxId]/change/route.ts` — POST: record rx change + create 5 tasks
- `src/components/provider/PlanEditor.tsx` — inline edit current_plan + next_step, saves on blur
- `src/components/provider/DiffPanel.tsx` — since-last-review color chips
- `src/components/provider/MedChangeModal.tsx` — medication change form + task cadence confirmation

### Modified
- `src/app/api/provider/patients/[id]/route.ts` — add currentPlan, nextStep, lastMdReviewAt to response
- `src/app/api/provider/tasks/[id]/route.ts` — set patients.last_md_review_at when MD closes requires_md_signoff task
- `src/app/provider/patient/[id]/page.tsx` — rename tab to Cockpit, replace overview content with new layout

---

## Task 1: Run DB migration

The schema (`src/lib/db/schema.ts`) and migration endpoint (`src/app/api/debug/migrate-build17/route.ts`) are already written from prior planning. The migration just needs to run against prod RDS.

- [ ] **Step 1: Deploy current main to prod**

```bash
git push origin main
```

Wait for Vercel deploy (~2 min). Verify https://womenkind.vercel.app is live.

- [ ] **Step 2: Get CRON_SECRET and run migration**

```bash
vercel env pull .env.prod.tmp --environment=production && grep CRON_SECRET .env.prod.tmp
```

Copy the secret value. Then:

```bash
curl -s -X POST https://womenkind.vercel.app/api/debug/migrate-build17 \
  -H "x-migration-secret: <CRON_SECRET_VALUE>" \
  -H "Content-Type: application/json"
rm .env.prod.tmp
```

Expected: `{"ok":true,"message":"Build 17 migration complete"}`

If you get `column already exists` errors — those are safe, `IF NOT EXISTS` handles them. Still a success.

- [ ] **Step 3: Commit note**

```bash
git commit --allow-empty -m "chore: Build 17 DB migration run on prod"
```

---

## Task 2: Extend GET /api/provider/patients/[id] — add cockpit fields

**Files:**
- Modify: `src/app/api/provider/patients/[id]/route.ts`

- [ ] **Step 1: Add columns to the patients query**

Read `src/app/api/provider/patients/[id]/route.ts`.

In the `db.query.patients.findFirst` call, the `columns` block currently has `id`, `profile_id`, `date_of_birth`, `phone`, `state`. Add three more:

```ts
columns: {
  id: true,
  profile_id: true,
  date_of_birth: true,
  phone: true,
  state: true,
  last_md_review_at: true,
  current_plan: true,
  next_step: true,
},
```

- [ ] **Step 2: Add fields to the JSON response**

Find the `return NextResponse.json({...})` at the bottom. Add three new keys after `latestEncounterNote`:

```ts
return NextResponse.json({
  patient,
  intakes: intakesRows,
  visits: visitsRows,
  providerVisits: visitsRows.filter(v => v.source !== 'daily'),
  liveWmi,
  subscriptions: subscriptionsRows,
  prescriptions: prescriptionsRows,
  labOrders: labOrdersRows,
  providerNotes: providerNotesRows,
  encounterNotesCount,
  latestEncounterNote: latestEncounterNote ?? null,
  currentPlan: patient.current_plan ?? null,
  nextStep: patient.next_step ?? null,
  lastMdReviewAt: patient.last_md_review_at ?? null,
})
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/provider/patients/
git commit -m "feat: add currentPlan, nextStep, lastMdReviewAt to patient API response"
```

---

## Task 3: Hook last_md_review_at into task close

**Files:**
- Modify: `src/app/api/provider/tasks/[id]/route.ts`

When an MD or NP closes a `requires_md_signoff` task, write the current timestamp to `patients.last_md_review_at`.

- [ ] **Step 1: Read the file**

Read `src/app/api/provider/tasks/[id]/route.ts`. Find the block that handles `newStatus === 'closed'`. It contains `updates.closed_at = new Date()` and `updates.closed_by = session!.providerId`.

- [ ] **Step 2: Add the hook**

After the `updates.closed_at` and `updates.closed_by` lines, still inside the `if (newStatus === 'closed')` block, add:

```ts
// If MD/NP closes a requires_md_signoff task, record the review date on the patient
if (task.requires_md_signoff) {
  await db.update(patients)
    .set({ last_md_review_at: new Date() })
    .where(eq(patients.id, task.patient_id))
}
```

`patients` is already imported from `@/lib/db/schema` in this file. `db`, `eq` are already imported.

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/provider/tasks/[id]/route.ts"
git commit -m "feat: set patients.last_md_review_at when MD closes requires_md_signoff task"
```

---

## Task 4: GET /api/provider/patients/[id]/diff

**Files:**
- Create: `src/app/api/provider/patients/[id]/diff/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "src/app/api/provider/patients/[id]/diff"
```

- [ ] **Step 2: Create the route**

Create `src/app/api/provider/patients/[id]/diff/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients, visits, lab_orders, provider_notes } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { computeLiveWMI } from '@/lib/wmi-scoring'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const patientId = params.id

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    columns: { last_md_review_at: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const since = patient.last_md_review_at

  if (!since) {
    return NextResponse.json({ since: null, wmiDelta: null, wmiNow: null, wmiBefore: null, newLabs: 0, latestLabName: null, rnNotes: 0, newMessages: 0 })
  }

  const allVisits = await db.query.visits.findMany({
    where: eq(visits.patient_id, patientId),
    columns: { symptom_scores: true, visit_date: true, source: true },
    orderBy: (v, { desc }) => [desc(v.visit_date)],
  })

  const visitsBefore = allVisits.filter(v => new Date(v.visit_date) <= since)
  const visitsAfter  = allVisits.filter(v => new Date(v.visit_date) > since)
  const wmiNow    = visitsAfter.length  > 0 ? computeLiveWMI(visitsAfter  as any) : null
  const wmiBefore = visitsBefore.length > 0 ? computeLiveWMI(visitsBefore as any) : null
  const wmiDelta  = wmiNow != null && wmiBefore != null ? Math.round(wmiNow - wmiBefore) : null

  const [labRows, rnNoteRows] = await Promise.all([
    db.query.lab_orders.findMany({
      where: and(eq(lab_orders.patient_id, patientId), gt(lab_orders.created_at, since)),
      columns: { id: true, tests: true },
    }),
    db.query.provider_notes.findMany({
      where: and(eq(provider_notes.patient_id, patientId), gt(provider_notes.created_at, since)),
      columns: { id: true },
    }),
  ])

  return NextResponse.json({
    since: since.toISOString(),
    wmiDelta,
    wmiNow,
    wmiBefore,
    newLabs: labRows.length,
    latestLabName: (labRows[0]?.tests as { name?: string }[] | null)?.[0]?.name ?? null,
    rnNotes: rnNoteRows.length,
    newMessages: 0,
  })
}
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/provider/patients/[id]/diff/"
git commit -m "feat: add GET /api/provider/patients/[id]/diff for cockpit since-last-review panel"
```

---

## Task 5: PATCH /api/provider/patients/[id]/plan

**Files:**
- Create: `src/app/api/provider/patients/[id]/plan/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "src/app/api/provider/patients/[id]/plan"
```

- [ ] **Step 2: Create the route**

Create `src/app/api/provider/patients/[id]/plan/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const body = await req.json() as { current_plan?: string | null; next_step?: string | null }

  const updates: { current_plan?: string | null; next_step?: string | null } = {}
  if ('current_plan' in body) updates.current_plan = body.current_plan ?? null
  if ('next_step'    in body) updates.next_step    = body.next_step    ?? null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await db.update(patients).set(updates).where(eq(patients.id, params.id))

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/provider/patients/[id]/plan/"
git commit -m "feat: add PATCH /api/provider/patients/[id]/plan for cockpit inline editing"
```

---

## Task 6: POST /api/provider/patients/[id]/prescriptions/[rxId]/change

**Files:**
- Create: `src/app/api/provider/patients/[id]/prescriptions/[rxId]/change/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "src/app/api/provider/patients/[id]/prescriptions/[rxId]/change"
```

- [ ] **Step 2: Create the route**

Create `src/app/api/provider/patients/[id]/prescriptions/[rxId]/change/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { createTask } from '@/lib/taskEngine'
import { db } from '@/lib/db'
import { prescription_changes, prescriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type ChangeType = 'started' | 'dose_increased' | 'dose_decreased' | 'stopped' | 'formulation_changed' | 'refill_authorized'

const CADENCE_TYPES: ChangeType[] = ['started', 'dose_increased', 'dose_decreased', 'formulation_changed']

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

  const { change_type, new_dosage, previous_dosage, reason } = await req.json() as {
    change_type: ChangeType
    new_dosage?: string
    previous_dosage?: string
    reason?: string
  }

  if (!change_type) {
    return NextResponse.json({ error: 'change_type is required' }, { status: 400 })
  }

  const rx = await db.query.prescriptions.findFirst({
    where: eq(prescriptions.id, params.rxId),
    columns: { id: true, patient_id: true, medication_name: true, dosage: true },
  })
  if (!rx || rx.patient_id !== params.id) {
    return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
  }

  const [change] = await db.insert(prescription_changes).values({
    prescription_id:  params.rxId,
    patient_id:       params.id,
    provider_id:      session!.providerId!,
    change_type,
    previous_dosage:  previous_dosage ?? rx.dosage ?? null,
    new_dosage:       new_dosage ?? null,
    reason:           reason ?? null,
  }).returning({ id: prescription_changes.id })

  const scheduledTasks: { title: string; dueAt: string }[] = []

  if (CADENCE_TYPES.includes(change_type)) {
    const medName = rx.medication_name
    const now = new Date()

    const cadence = [
      { days: 4,   priority: 'yellow' as const, title: `Day-4 check-in — ${medName}: confirm received medication, no urgent side effects`, requiresMd: false },
      { days: 28,  priority: 'yellow' as const, title: `4-week check-in — ${medName}`,                                                    requiresMd: false },
      { days: 56,  priority: 'blue'   as const, title: `8-week trend review — ${medName}`,                                                requiresMd: false },
      { days: 84,  priority: 'orange' as const, title: `12-week response review — ${medName}`,                                            requiresMd: true  },
      { days: 365, priority: 'blue'   as const, title: `Annual benefit/risk review — ${medName}`,                                         requiresMd: true  },
    ]

    for (const step of cadence) {
      const dueAt = addDays(now, step.days)
      await createTask({
        patient_id:          params.id,
        title:               step.title,
        category:            'med',
        priority:            step.priority,
        source:              'med_change',
        source_ref:          change.id,
        due_at:              dueAt,
        requires_md_signoff: step.requiresMd,
      })
      scheduledTasks.push({ title: step.title, dueAt: dueAt.toISOString() })
    }
  }

  return NextResponse.json({ ok: true, changeId: change.id, scheduledTasks }, { status: 201 })
}
```

- [ ] **Step 3: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/provider/patients/[id]/prescriptions/"
git commit -m "feat: add POST prescriptions/[rxId]/change — record med change and auto-schedule 5 tasks"
```

---

## Task 7: PlanEditor component

**Files:**
- Create: `src/components/provider/PlanEditor.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/provider/PlanEditor.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'

interface Props {
  patientId: string
  currentPlan: string | null
  nextStep: string | null
  lastMdReviewAt: string | null
}

export default function PlanEditor({ patientId, currentPlan: initialPlan, nextStep: initialNext, lastMdReviewAt }: Props) {
  const [plan, setPlan]        = useState(initialPlan ?? '')
  const [next, setNext]        = useState(initialNext ?? '')
  const [savedField, setSaved] = useState<'plan' | 'next' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = async (field: 'plan' | 'next', value: string) => {
    const body = field === 'plan' ? { current_plan: value } : { next_step: value }
    try {
      await fetch(`/api/provider/patients/${patientId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setSaved(field)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setSaved(null), 2000)
    } catch {}
  }

  const reviewAgo = lastMdReviewAt
    ? (() => {
        const days = Math.floor((Date.now() - new Date(lastMdReviewAt).getTime()) / 86400000)
        if (days === 0) return 'today'
        if (days === 1) return '1 day ago'
        return `${days} days ago`
      })()
    : null

  return (
    <div className="col-span-2 grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">Current Plan</p>
        <textarea
          value={plan}
          onChange={e => setPlan(e.target.value)}
          onBlur={() => save('plan', plan)}
          placeholder="Click to add treatment plan…"
          rows={3}
          className="w-full text-sm font-sans text-aubergine bg-transparent resize-none outline-none border border-transparent rounded-lg px-2 py-1 hover:border-aubergine/10 focus:border-aubergine/20 focus:bg-white transition-colors placeholder:text-aubergine/20"
        />
        {savedField === 'plan' && <p className="text-xs font-sans text-emerald-500 mt-0.5">Saved</p>}
      </div>

      <div>
        <p className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">Next Step</p>
        <textarea
          value={next}
          onChange={e => setNext(e.target.value)}
          onBlur={() => save('next', next)}
          placeholder="No current action needed…"
          rows={3}
          className="w-full text-sm font-sans text-aubergine bg-transparent resize-none outline-none border border-transparent rounded-lg px-2 py-1 hover:border-aubergine/10 focus:border-aubergine/20 focus:bg-white transition-colors placeholder:text-aubergine/20"
        />
        {savedField === 'next' && <p className="text-xs font-sans text-emerald-500 mt-0.5">Saved</p>}
        {reviewAgo && (
          <p className="text-xs font-sans text-aubergine/30 mt-0.5">Last MD review: {reviewAgo}</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/provider/PlanEditor.tsx
git commit -m "feat: add PlanEditor component — inline current_plan + next_step, saves on blur"
```

---

## Task 8: DiffPanel component

**Files:**
- Create: `src/components/provider/DiffPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/provider/DiffPanel.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

interface DiffData {
  since: string | null
  wmiDelta: number | null
  wmiNow: number | null
  wmiBefore: number | null
  newLabs: number
  latestLabName: string | null
  rnNotes: number
  newMessages: number
}

interface Props {
  patientId: string
}

export default function DiffPanel({ patientId }: Props) {
  const [diff, setDiff]       = useState<DiffData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/provider/patients/${patientId}/diff`)
      .then(r => r.json())
      .then(setDiff)
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) {
    return (
      <div className="bg-white rounded-card border border-aubergine/5 px-5 py-4">
        <div className="h-3 bg-aubergine/5 rounded animate-pulse w-40" />
      </div>
    )
  }
  if (!diff) return null

  const sinceLabel = diff.since
    ? (() => {
        const days = Math.floor((Date.now() - new Date(diff.since).getTime()) / 86400000)
        if (days === 0) return 'today'
        if (days === 1) return '1 day ago'
        return `${days} days ago`
      })()
    : null

  const hasAny = diff.wmiDelta != null || diff.newLabs > 0 || diff.rnNotes > 0 || diff.newMessages > 0

  return (
    <div className="bg-white rounded-card border border-aubergine/5 px-5 py-4">
      <p className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-3">
        {sinceLabel ? `Since Last MD Review (${sinceLabel})` : 'No MD Review Recorded Yet'}
      </p>

      {!hasAny ? (
        <p className="text-sm font-sans text-aubergine/30">
          {sinceLabel
            ? `No changes since review on ${new Date(diff.since!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
            : 'Record a review by closing an MD sign-off task for this patient.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {diff.wmiDelta != null && (
            <div className={`rounded-lg px-3 py-2 text-xs font-sans ${diff.wmiDelta < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <span className="font-semibold">WMI {diff.wmiDelta > 0 ? '+' : ''}{diff.wmiDelta} pts</span>
              {diff.wmiBefore != null && diff.wmiNow != null && (
                <span className="ml-1 opacity-70">{diff.wmiBefore} → {diff.wmiNow}</span>
              )}
            </div>
          )}
          {diff.newLabs > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs font-sans bg-amber-50 text-amber-700">
              <span className="font-semibold">{diff.newLabs} new lab{diff.newLabs > 1 ? 's' : ''}</span>
              {diff.latestLabName && <span className="ml-1 opacity-70">{diff.latestLabName}</span>}
            </div>
          )}
          {diff.rnNotes > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs font-sans bg-violet/10 text-violet">
              <span className="font-semibold">{diff.rnNotes} RN note{diff.rnNotes > 1 ? 's' : ''}</span>
            </div>
          )}
          {diff.newMessages > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs font-sans bg-blue-50 text-blue-700">
              <span className="font-semibold">{diff.newMessages} message{diff.newMessages > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/provider/DiffPanel.tsx
git commit -m "feat: add DiffPanel — since-last-review color chip summary"
```

---

## Task 9: MedChangeModal component

**Files:**
- Create: `src/components/provider/MedChangeModal.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/provider/MedChangeModal.tsx`:

```tsx
'use client'

import { useState } from 'react'

interface Prescription {
  id: string
  medication_name: string
  dosage: string
  status: string
}

interface ScheduledTask {
  title: string
  dueAt: string
}

interface Props {
  patientId: string
  prescriptions: Prescription[]
  onClose: () => void
  onSuccess: () => void
}

type ChangeType = 'started' | 'dose_increased' | 'dose_decreased' | 'stopped' | 'formulation_changed'

const CHANGE_TYPES: { key: ChangeType; label: string }[] = [
  { key: 'started',             label: 'Started' },
  { key: 'dose_increased',      label: 'Dose increased' },
  { key: 'dose_decreased',      label: 'Dose decreased' },
  { key: 'stopped',             label: 'Stopped' },
  { key: 'formulation_changed', label: 'Formulation changed' },
]

const CREATES_TASKS: ChangeType[] = ['started', 'dose_increased', 'dose_decreased', 'formulation_changed']

export default function MedChangeModal({ patientId, prescriptions, onClose, onSuccess }: Props) {
  const active = prescriptions.filter(rx => rx.status === 'active')
  const [rxId, setRxId]             = useState(active[0]?.id ?? '')
  const [changeType, setChangeType] = useState<ChangeType>('dose_increased')
  const [newDosage, setNewDosage]   = useState('')
  const [reason, setReason]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [scheduled, setScheduled]   = useState<ScheduledTask[] | null>(null)

  const willCreateTasks = CREATES_TASKS.includes(changeType)

  async function handleSubmit() {
    if (!rxId) { setError('Select a medication.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/provider/patients/${patientId}/prescriptions/${rxId}/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_type: changeType, new_dosage: newDosage || undefined, reason: reason || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to record change')
      }
      const data = await res.json()
      setScheduled(data.scheduledTasks ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Confirmation screen
  if (scheduled !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-card shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
          <h2 className="text-lg font-sans font-semibold text-aubergine">Change recorded</h2>
          {scheduled.length > 0 && (
            <>
              <p className="text-sm font-sans text-aubergine/60">{scheduled.length} follow-up tasks scheduled:</p>
              <ul className="space-y-2">
                {scheduled.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-sans text-aubergine/70">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet/40 flex-shrink-0" />
                    <span>
                      {t.title}
                      <span className="ml-1 text-aubergine/40">
                        — {new Date(t.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            onClick={() => { onSuccess(); onClose() }}
            className="w-full py-2.5 text-sm font-sans font-semibold bg-aubergine text-white rounded-pill hover:bg-aubergine/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-card shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-sans font-semibold text-aubergine">Record Medication Change</h2>

        {active.length === 0 ? (
          <p className="text-sm font-sans text-aubergine/50">No active prescriptions for this patient.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">Medication</label>
              <select
                value={rxId}
                onChange={e => setRxId(e.target.value)}
                className="w-full border border-aubergine/15 rounded-lg px-3 py-2 text-sm font-sans text-aubergine"
              >
                {active.map(rx => (
                  <option key={rx.id} value={rx.id}>{rx.medication_name} — {rx.dosage}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-2">Change Type</label>
              <div className="flex flex-wrap gap-2">
                {CHANGE_TYPES.map(ct => (
                  <button
                    key={ct.key}
                    onClick={() => setChangeType(ct.key)}
                    className={`px-3 py-1.5 rounded-pill text-xs font-sans font-medium transition-colors ${
                      changeType === ct.key
                        ? 'bg-aubergine text-white'
                        : 'bg-aubergine/5 text-aubergine/60 hover:bg-aubergine/10'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {changeType !== 'stopped' && (
              <div>
                <label className="block text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">New Dosage</label>
                <input
                  value={newDosage}
                  onChange={e => setNewDosage(e.target.value)}
                  placeholder="e.g. 0.075mg patch"
                  className="w-full border border-aubergine/15 rounded-lg px-3 py-2 text-sm font-sans text-aubergine placeholder:text-aubergine/20"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">Reason</label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Optional"
                className="w-full border border-aubergine/15 rounded-lg px-3 py-2 text-sm font-sans text-aubergine placeholder:text-aubergine/20"
              />
            </div>

            {willCreateTasks && (
              <div className="bg-violet/5 border border-violet/15 rounded-lg px-4 py-3 text-xs font-sans text-violet">
                ✓ Will schedule: Day 4 · Week 4 · Week 8 · 12-week MD review · Annual review
              </div>
            )}

            {error && <p className="text-sm font-sans text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 text-sm font-sans text-aubergine/50 hover:text-aubergine transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 text-sm font-sans font-semibold bg-aubergine text-white rounded-pill hover:bg-aubergine/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Confirm Change'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/provider/MedChangeModal.tsx
git commit -m "feat: add MedChangeModal — rx change form with task cadence confirmation screen"
```

---

## Task 10: Rework patient profile — Cockpit tab

**Files:**
- Modify: `src/app/provider/patient/[id]/page.tsx`

This is the main assembly task. Rename the tab, add state, load cockpit data, and replace the overview tab content block.

- [ ] **Step 1: Add imports**

Read `src/app/provider/patient/[id]/page.tsx`. At the top with the other imports, add:

```tsx
import PlanEditor from '@/components/provider/PlanEditor'
import DiffPanel from '@/components/provider/DiffPanel'
import MedChangeModal from '@/components/provider/MedChangeModal'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
```

- [ ] **Step 2: Add state variables**

In the component body, after the existing `useState` declarations, add:

```tsx
const [currentPlan, setCurrentPlan]       = useState<string | null>(null)
const [nextStep, setNextStep]             = useState<string | null>(null)
const [lastMdReviewAt, setLastMdReviewAt] = useState<string | null>(null)
const [patientTasks, setPatientTasks]     = useState<Task[]>([])
const [medChangeOpen, setMedChangeOpen]   = useState(false)
const [accordionOpen, setAccordionOpen]   = useState({ trend: false, meds: false })
```

- [ ] **Step 3: Load cockpit fields from API**

Inside `loadPatientData`, after the existing `setLiveWmi(data.liveWmi ?? null)` line, add:

```tsx
setCurrentPlan(data.currentPlan ?? null)
setNextStep(data.nextStep ?? null)
setLastMdReviewAt(data.lastMdReviewAt ?? null)
```

- [ ] **Step 4: Fetch open tasks for this patient**

Still inside `loadPatientData`, after the message thread count fetch block, add:

```tsx
try {
  const taskRes = await fetch(`/api/provider/tasks?patientId=${patientId}`)
  const taskData = await taskRes.json()
  if (fetchGenRef.current !== gen) return
  const open = (taskData.tasks ?? []).filter((t: Task) => !['resolved', 'closed'].includes(t.status))
  setPatientTasks(open)
} catch {}
```

- [ ] **Step 5: Rename the tab**

Find the `TABS` array. Change:

```tsx
{ key: 'overview', label: 'Overview & Trends' },
```

to:

```tsx
{ key: 'overview', label: 'Cockpit' },
```

- [ ] **Step 6: Replace the overview tab content block**

Find and replace the entire `{activeTab === 'overview' && (...)}` block with:

```tsx
{activeTab === 'overview' && (
  <div className="space-y-4">

    {/* Top strip: compact score + plan editor */}
    <div className="bg-white rounded-card border border-aubergine/5 px-6 py-5">
      <div className="flex gap-6 items-start">
        {/* Compact score */}
        <div className="text-center pr-6 border-r border-aubergine/8 flex-shrink-0 min-w-[72px]">
          <p className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">WK Score</p>
          <p className="font-serif font-normal text-4xl text-aubergine leading-none">
            {liveWmi != null ? Math.round(liveWmi) : '—'}
          </p>
        </div>
        {/* Plan + next step editors */}
        <PlanEditor
          patientId={patientId}
          currentPlan={currentPlan}
          nextStep={nextStep}
          lastMdReviewAt={lastMdReviewAt}
        />
      </div>
    </div>

    {/* Since last MD review */}
    <DiffPanel patientId={patientId} />

    {/* Open tasks */}
    <div className="bg-white rounded-card border border-aubergine/5">
      <div className="px-6 py-4 border-b border-aubergine/5">
        <p className="text-sm font-sans font-semibold text-aubergine">
          Open Tasks
          {patientTasks.length > 0 && (
            <span className="ml-1.5 text-aubergine/40 font-normal">({patientTasks.length})</span>
          )}
        </p>
      </div>
      <TaskQueue
        tasks={patientTasks}
        onAcknowledge={async (taskId) => {
          await fetch(`/api/provider/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'acknowledged' }),
          })
          setPatientTasks(q => q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t))
        }}
      />
    </div>

    {/* Compact domain cards — last check-in scores */}
    {(() => {
      const latest = visits.find(v => v.symptom_scores && Object.keys(v.symptom_scores).length > 0)
      if (!latest) return null
      const scores = latest.symptom_scores as Record<string, number>
      const domains = [
        { key: 'vasomotor', label: 'Vasomotor', unit: 'episodes' },
        { key: 'sleep',     label: 'Sleep',     unit: 'hrs' },
        { key: 'energy',    label: 'Energy',    unit: '/10' },
        { key: 'mood',      label: 'Mood',      unit: '/10' },
      ]
      return (
        <div className="grid grid-cols-4 gap-3">
          {domains.map(d => (
            <div key={d.key} className="bg-white rounded-card border border-aubergine/5 px-4 py-3 text-center">
              <p className="text-xs font-sans text-aubergine/40 mb-1">{d.label}</p>
              <p className="font-serif font-normal text-2xl text-aubergine leading-none">
                {scores[d.key] != null ? scores[d.key] : '—'}
              </p>
              <p className="text-xs font-sans text-aubergine/30 mt-0.5">{d.unit}</p>
            </div>
          ))}
        </div>
      )
    })()}

    {/* Trend chart accordion */}
    <div className="bg-white rounded-card border border-aubergine/5 overflow-hidden">
      <button
        onClick={() => setAccordionOpen(s => ({ ...s, trend: !s.trend }))}
        className="w-full px-6 py-4 flex items-center justify-between text-sm font-sans font-semibold text-aubergine hover:bg-aubergine/[0.02] transition-colors"
      >
        <span>Symptom Trend</span>
        <span className="text-aubergine/30 text-xs">{accordionOpen.trend ? '▾' : '▸'}</span>
      </button>
      {accordionOpen.trend && (
        <div className="px-6 pb-6">
          <PatientOverview
            view="provider"
            visits={visits}
            prescriptions={prescriptions}
            latestIntake={latestIntake}
            liveWmi={liveWmi}
            hideScoreHeader
          />
        </div>
      )}
    </div>

    {/* Medication timeline accordion */}
    <div className="bg-white rounded-card border border-aubergine/5 overflow-hidden">
      <button
        onClick={() => setAccordionOpen(s => ({ ...s, meds: !s.meds }))}
        className="w-full px-6 py-4 flex items-center justify-between text-sm font-sans font-semibold text-aubergine hover:bg-aubergine/[0.02] transition-colors"
      >
        <span>Medication Timeline</span>
        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          {accordionOpen.meds && (
            <button
              onClick={() => setMedChangeOpen(true)}
              className="text-xs font-sans font-semibold text-violet hover:text-aubergine transition-colors bg-violet/5 px-3 py-1 rounded-pill"
            >
              + Record Change
            </button>
          )}
          <span className="text-aubergine/30 text-xs pointer-events-none">{accordionOpen.meds ? '▾' : '▸'}</span>
        </div>
      </button>
      {accordionOpen.meds && (
        <div className="px-6 pb-4">
          {prescriptions.length === 0 ? (
            <p className="text-sm font-sans text-aubergine/30 py-2">No prescriptions on file.</p>
          ) : (
            <div className="divide-y divide-aubergine/5">
              {prescriptions.map(rx => (
                <div key={rx.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-semibold text-aubergine truncate">{rx.medication_name}</p>
                    <p className="text-xs font-sans text-aubergine/40">{rx.dosage} · {rx.frequency}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-sans px-2.5 py-0.5 rounded-pill border ${
                    rx.status === 'active'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-aubergine/5 text-aubergine/40 border-aubergine/10'
                  }`}>
                    {rx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Med change modal */}
    {medChangeOpen && (
      <MedChangeModal
        patientId={patientId}
        prescriptions={prescriptions}
        onClose={() => setMedChangeOpen(false)}
        onSuccess={() => { setMedChangeOpen(false); reloadPrescriptions() }}
      />
    )}

  </div>
)}
```

- [ ] **Step 7: Verify tsc**

```bash
npx tsc --noEmit
```

Common issues to fix:
- `PatientOverview` with `hideScoreHeader` — this prop already exists in the component; if tsc complains the prop isn't in the type, check `src/components/provider/PatientOverview.tsx` around line 60 for `hideScoreHeader?: boolean` in the props interface.
- `Task` import — `src/components/staff/TaskQueue.tsx` exports `Task` as a named export; verify the import is `import { TaskQueue, Task } from '@/components/staff/TaskQueue'`.

- [ ] **Step 8: Test locally**

```bash
npm run dev
```

Open `http://localhost:3000/provider/patient/fx-p-1`. Verify in dev (fixtures bypass):
- Tab bar shows "Cockpit" as first tab (active by default)
- Score renders as a small number, not a full banner
- DiffPanel renders with "No MD review recorded yet" message (fixtures have no last_md_review_at)
- Task section shows zero state "No open tasks" or fixture tasks if any
- Domain cards render 4-column grid with scores from fixture visits
- Trend accordion expands to show PatientOverview (without score banner)
- Medication timeline accordion shows fixture prescriptions list
- "+ Record Change" button appears only when med timeline is open
- Clicking "+ Record Change" opens MedChangeModal
- All other tabs (Intake, Biometrics, Prescriptions, Labs, Visit Timeline, Notes, Messages) still render correctly

- [ ] **Step 9: Commit**

```bash
git add src/app/provider/patient/ src/components/provider/
git commit -m "feat: Build 17 — Cockpit tab with compact score, diff panel, tasks, domain cards, med timeline"
```

---

## Task 11: Deploy and verify on prod

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

Wait for Vercel deploy (~2 min).

- [ ] **Step 2: Verify on prod**

Open `https://womenkind.vercel.app/provider`. Log in as `josephurbanmd@gmail.com` / `password123`. Navigate to any patient.

- [ ] Cockpit tab is first and active by default
- [ ] Score shows compact (not full banner)
- [ ] PlanEditor: type in Current Plan field, click away → "Saved" appears → reload page → text persists
- [ ] DiffPanel loads without error
- [ ] Medication timeline accordion opens and shows prescriptions
- [ ] `+ Record Change` button appears, opens MedChangeModal
- [ ] Submit a `dose_increased` change → confirmation screen shows 5 scheduled tasks with dates
- [ ] All other 7 tabs still work

- [ ] **Step 3: Final tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

