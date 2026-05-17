# Build 17 — Patient Cockpit + Medication Change Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Clinical Tasks card to the provider dashboard home, a full `/provider/tasks` queue page, a per-patient cockpit at `/provider/patients/[id]/cockpit`, and a medication change tracker that auto-schedules the 5-touchpoint follow-up cadence.

**Architecture:** All data lives in AWS RDS via Drizzle ORM. New `prescription_changes` table and 4 new columns on `patients`. A debug endpoint runs the DB migration (RDS is only reachable from Vercel network). UI follows the existing WomenKind design language: cream background, white rounded-card cards, aubergine typography, violet accents.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM + PostgreSQL (AWS RDS), TypeScript, Tailwind CSS, Supabase Auth.

**Design spec:** `docs/superpowers/specs/2026-05-17-build-17-design.md`

**Prerequisite:** Build 16 must be live (`tasks` table, `taskEngine.ts`, `requireStaffRole.ts`, `TaskQueue` component, `TaskCloseModal` component all exist).

---

## File Map

### Created
- `src/lib/db/migrations/0002_build17.sql` — raw SQL for DB migration
- `src/app/api/debug/migrate-build17/route.ts` — migration endpoint (CRON_SECRET protected)
- `src/app/api/provider/patients/[id]/plan/route.ts` — PATCH current_plan + next_step
- `src/app/api/provider/patients/[id]/diff/route.ts` — GET diff since last_md_review_at
- `src/app/api/provider/patients/[id]/cockpit/route.ts` — GET full cockpit payload
- `src/app/api/provider/patients/[id]/prescriptions/[rxId]/change/route.ts` — POST rx change + task cadence
- `src/components/provider/PlanEditor.tsx` — inline editable plan + next_step, auto-save on blur
- `src/components/provider/DiffPanel.tsx` — "Since last MD review" summary
- `src/components/provider/MedChangeModal.tsx` — record prescription change, confirm 5 tasks
- `src/app/provider/tasks/page.tsx` — full task queue grouped by priority
- `src/app/provider/patients/[id]/cockpit/page.tsx` — patient cockpit single-column scroll

### Modified
- `src/lib/db/schema.ts` — add 4 columns to patients; add prescription_changes table
- `src/app/api/provider/tasks/route.ts` — add `limit` param + `open` filter
- `src/app/api/provider/tasks/[id]/route.ts` — on MD close of requires_md_signoff task → set last_md_review_at
- `src/components/provider/DashboardHome.tsx` — add Clinical Tasks card below existing 2×2 grid
- `src/components/provider/ProviderNav.tsx` — add Tasks tab
- `src/components/provider/PatientOverview.tsx` — add "Open Cockpit" link
- `src/components/provider/PrescriptionsPanel.tsx` — add "Record change" button per row → MedChangeModal

---

## Task 1: Schema — Drizzle + SQL migration

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/migrations/0002_build17.sql`
- Create: `src/app/api/debug/migrate-build17/route.ts`

- [ ] **Step 1: Add 4 columns to patients table in schema.ts**

In `src/lib/db/schema.ts`, replace the patients table definition (currently lines 20–30):

```ts
export const patients = pgTable('patients', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  profile_id:              uuid('profile_id').notNull().references(() => profiles.id),
  date_of_birth:           text('date_of_birth'),
  state:                   text('state'),
  phone:                   text('phone'),
  is_active:               boolean('is_active').notNull().default(true),
  onboarding_status:       text('onboarding_status').notNull().default('active'),
  membership_plan:         text('membership_plan'),
  last_md_review_at:       timestamp('last_md_review_at', { withTimezone: true }),
  last_meaningful_touch_at: timestamp('last_meaningful_touch_at', { withTimezone: true }),
  current_plan:            text('current_plan'),
  next_step:               text('next_step'),
  created_at:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 2: Add prescription_changes table to schema.ts**

After the `prescriptionNotes` table definition (around line 182), add:

```ts
// ── Prescription Changes ──────────────────────────────────────────────────────
export const prescription_changes = pgTable('prescription_changes', {
  id:               uuid('id').primaryKey().defaultRandom(),
  prescription_id:  uuid('prescription_id').notNull().references(() => prescriptions.id),
  patient_id:       uuid('patient_id').notNull().references(() => patients.id),
  provider_id:      uuid('provider_id').notNull().references(() => providers.id),
  change_type:      text('change_type').notNull(),
  previous_dosage:  text('previous_dosage'),
  new_dosage:       text('new_dosage'),
  previous_status:  text('previous_status'),
  new_status:       text('new_status'),
  reason:           text('reason'),
  created_at:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 3: Write the SQL migration file**

Create `src/lib/db/migrations/0002_build17.sql`:

```sql
-- Build 17: Patient Cockpit + Medication Change Tracker

-- 1. Add plan/review columns to patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS last_md_review_at        timestamp WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_meaningful_touch_at timestamp WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_plan             text,
  ADD COLUMN IF NOT EXISTS next_step                text;

-- 2. Prescription changes table
CREATE TABLE IF NOT EXISTS prescription_changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id  uuid NOT NULL REFERENCES prescriptions(id),
  patient_id       uuid NOT NULL REFERENCES patients(id),
  provider_id      uuid NOT NULL REFERENCES providers(id),
  change_type      text NOT NULL,
  previous_dosage  text,
  new_dosage       text,
  previous_status  text,
  new_status       text,
  reason           text,
  created_at       timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rx_changes_patient_id_idx ON prescription_changes(patient_id);
CREATE INDEX IF NOT EXISTS rx_changes_prescription_id_idx ON prescription_changes(prescription_id);
```

- [ ] **Step 4: Create the debug migration endpoint**

Create `src/app/api/debug/migrate-build17/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await db.execute(sql`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS last_md_review_at        timestamp WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS last_meaningful_touch_at timestamp WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS current_plan             text,
        ADD COLUMN IF NOT EXISTS next_step                text;
    `)

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS prescription_changes (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id  uuid NOT NULL REFERENCES prescriptions(id),
        patient_id       uuid NOT NULL REFERENCES patients(id),
        provider_id      uuid NOT NULL REFERENCES providers(id),
        change_type      text NOT NULL,
        previous_dosage  text,
        new_dosage       text,
        previous_status  text,
        new_status       text,
        reason           text,
        created_at       timestamp WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS rx_changes_patient_id_idx ON prescription_changes(patient_id);
      CREATE INDEX IF NOT EXISTS rx_changes_prescription_id_idx ON prescription_changes(prescription_id);
    `)

    return NextResponse.json({ ok: true, message: 'Build 17 migration complete' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/0002_build17.sql src/app/api/debug/migrate-build17/route.ts
git commit -m "feat: add patients plan columns + prescription_changes table (Build 17 schema)"
```

---

## Task 2: Extend GET /api/provider/tasks — limit + open filter

**Files:**
- Modify: `src/app/api/provider/tasks/route.ts`

- [ ] **Step 1: Add limit param and open filter to GET handler**

In `src/app/api/provider/tasks/route.ts`, replace the section from `const rows = await db.query.tasks.findMany` to the end of the GET function:

```ts
  // open=true → exclude resolved/closed (for DashboardHome top-8 fetch)
  const openOnly = searchParams.get('open') === 'true'
  if (openOnly) {
    conditions.push(notInArray(tasks.status, ['resolved', 'closed']))
  }

  const limitParam = searchParams.get('limit')
  const limitNum = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 200

  const whereClause = conditions.length > 0 ? and(...(conditions as [SQL, ...SQL[]])) : undefined

  const rows = await db.query.tasks.findMany({
    where: whereClause,
    orderBy: [
      // Sort by priority: red first, then orange, yellow, blue, gray
      sql`CASE priority WHEN 'red' THEN 0 WHEN 'orange' THEN 1 WHEN 'yellow' THEN 2 WHEN 'blue' THEN 3 ELSE 4 END`,
      desc(tasks.updated_at),
    ],
    limit: limitNum,
  })

  return NextResponse.json({ tasks: rows })
```

Also add `sql` to the import line at the top (it's already imported via drizzle-orm — verify it's there, add if missing):

```ts
import { and, eq, inArray, notInArray, desc, or, SQL, sql } from 'drizzle-orm'
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/provider/tasks/route.ts
git commit -m "feat: add limit + open filter params to GET /api/provider/tasks"
```

---

## Task 3: Modify PATCH /api/provider/tasks/[id] — set last_md_review_at on close

**Files:**
- Modify: `src/app/api/provider/tasks/[id]/route.ts`

- [ ] **Step 1: Add patients import and last_md_review_at update on close**

At the top of `src/app/api/provider/tasks/[id]/route.ts`, update the schema import to include `patients`:

```ts
import { tasks, providers, patients } from '@/lib/db/schema'
```

Inside the `if (newStatus === 'closed')` block, after the existing close-out field checks and before the final `updates.status = newStatus` line, add:

```ts
      // If MD/NP closes a requires_md_signoff task, record the review date on the patient
      if (task.requires_md_signoff) {
        await db.update(patients)
          .set({ last_md_review_at: new Date(), last_meaningful_touch_at: new Date() })
          .where(eq(patients.id, task.patient_id))
      } else {
        await db.update(patients)
          .set({ last_meaningful_touch_at: new Date() })
          .where(eq(patients.id, task.patient_id))
      }
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/provider/tasks/[id]/route.ts
git commit -m "feat: set last_md_review_at on patient when MD closes signoff task"
```

---

## Task 4: PATCH /api/provider/patients/[id]/plan

**Files:**
- Create: `src/app/api/provider/patients/[id]/plan/route.ts`

- [ ] **Step 1: Create the route**

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

  const { current_plan, next_step } = await req.json()

  const updates: Record<string, unknown> = {}
  if (current_plan !== undefined) updates.current_plan = current_plan || null
  if (next_step !== undefined) updates.next_step = next_step || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await db.update(patients).set(updates).where(eq(patients.id, params.id))

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/provider/patients/[id]/plan/route.ts
git commit -m "feat: add PATCH /api/provider/patients/[id]/plan"
```

---

## Task 5: GET /api/provider/patients/[id]/diff

**Files:**
- Create: `src/app/api/provider/patients/[id]/diff/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients, visits, prescription_changes, messages } from '@/lib/db/schema'
import { and, eq, gte, count } from 'drizzle-orm'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, params.id),
    columns: { last_md_review_at: true, current_plan: true, next_step: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const since = patient.last_md_review_at ?? new Date(0)

  const [wmiVisits, rxChanges, msgCount, rnNotes] = await Promise.all([
    // Recent daily check-ins for WMI delta
    db.query.visits.findMany({
      where: and(eq(visits.patient_id, params.id), gte(visits.created_at, since)),
      columns: { overall_score: true, visit_date: true, source: true },
      orderBy: (v, { desc }) => [desc(v.visit_date)],
      limit: 20,
    }),
    // Prescription changes since last review
    db.query.prescription_changes.findMany({
      where: and(
        eq(prescription_changes.patient_id, params.id),
        gte(prescription_changes.created_at, since),
      ),
      orderBy: (r, { desc }) => [desc(r.created_at)],
    }),
    // Message count since last review
    db.select({ count: count() })
      .from(messages)
      .where(and(eq(messages.patient_id, params.id), gte(messages.created_at, since))),
    // RN notes (visits with source='rn_note')
    db.query.visits.findMany({
      where: and(
        eq(visits.patient_id, params.id),
        eq(visits.source, 'rn_note' as any),
        gte(visits.created_at, since),
      ),
      columns: { visit_date: true, notes: true },
      limit: 5,
    }),
  ])

  // Compute WMI delta: compare earliest vs latest overall_score since review
  const scores = wmiVisits
    .filter(v => v.overall_score != null)
    .map(v => v.overall_score as number)
  const wmiDelta = scores.length >= 2
    ? { from: scores[scores.length - 1], to: scores[0], delta: scores[0] - scores[scores.length - 1] }
    : scores.length === 1
    ? { from: null, to: scores[0], delta: null }
    : null

  return NextResponse.json({
    since: patient.last_md_review_at,
    wmiDelta,
    rxChanges,
    messageCount: msgCount[0]?.count ?? 0,
    rnNotes,
  })
}
```

Note: `messages` table — check the actual table name in `schema.ts`. If it's `thread_messages` or similar, use the correct import. Look for it: `grep -n "messages\|thread_messages" src/lib/db/schema.ts`.

- [ ] **Step 2: Verify messages table name in schema**

```bash
grep -n "^export const.*message\|^export const.*thread" src/lib/db/schema.ts
```

Use the correct table name for the messages count query. If the table has no `patient_id` column, set `messageCount: 0` and skip that join for now.

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/provider/patients/[id]/diff/route.ts
git commit -m "feat: add GET /api/provider/patients/[id]/diff"
```

---

## Task 6: GET /api/provider/patients/[id]/cockpit

**Files:**
- Create: `src/app/api/provider/patients/[id]/cockpit/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients, tasks, prescription_changes, profiles } from '@/lib/db/schema'
import { and, eq, notInArray } from 'drizzle-orm'
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
    with: { profiles: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const [activeTasks, rxHistory, recentVisits] = await Promise.all([
    db.query.tasks.findMany({
      where: and(
        eq(tasks.patient_id, params.id),
        notInArray(tasks.status, ['resolved', 'closed']),
      ),
      orderBy: (t, { sql, asc }) => [
        sql`CASE priority WHEN 'red' THEN 0 WHEN 'orange' THEN 1 WHEN 'yellow' THEN 2 WHEN 'blue' THEN 3 ELSE 4 END`,
        asc(t.due_at),
      ],
    }),
    db.query.prescription_changes.findMany({
      where: eq(prescription_changes.patient_id, params.id),
      orderBy: (r, { desc }) => [desc(r.created_at)],
      limit: 20,
    }),
    db.query.visits.findMany({
      where: eq((await import('@/lib/db/schema')).visits.patient_id, params.id),
      orderBy: (v, { desc }) => [desc(v.visit_date)],
      limit: 10,
      columns: { visit_date: true, source: true, overall_score: true, visit_type: true },
    }),
  ])

  // Compute live WMI from recent check-ins
  const checkinScores = recentVisits
    .filter(v => v.source === 'daily' && v.overall_score != null)
    .map(v => v.overall_score as number)
  const liveWmi = checkinScores.length > 0
    ? Math.round(checkinScores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(checkinScores.length, 3))
    : null

  return NextResponse.json({
    patient: {
      id: patient.id,
      current_plan: patient.current_plan,
      next_step: patient.next_step,
      last_md_review_at: patient.last_md_review_at,
      last_meaningful_touch_at: patient.last_meaningful_touch_at,
    },
    liveWmi,
    activeTasks,
    rxHistory,
  })
}
```

Note: The `with: { profiles: true }` requires a relation defined in schema. If `patients` doesn't have a `profiles` relation set up in Drizzle's `relations()`, replace with a separate query:
```ts
const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, patient.profile_id) })
```

Also fix the `recentVisits` query — the `await import` pattern is wrong. Import `visits` at the top:
```ts
import { patients, tasks, prescription_changes, profiles, visits } from '@/lib/db/schema'
```
Then use `eq(visits.patient_id, params.id)` directly.

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Fix any type errors (import issues, missing fields). The key fields are: `patient.current_plan`, `patient.next_step`, `patient.last_md_review_at`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/provider/patients/[id]/cockpit/route.ts
git commit -m "feat: add GET /api/provider/patients/[id]/cockpit"
```

---

## Task 7: POST /api/provider/patients/[id]/prescriptions/[rxId]/change

**Files:**
- Create: `src/app/api/provider/patients/[id]/prescriptions/[rxId]/change/route.ts`

- [ ] **Step 1: Create the route**

```ts
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
    previous_dosage: rx.dosage,
    new_dosage:      new_dosage ?? null,
    previous_status: rx.status,
    new_status:      new_dosage ? rx.status : change_type === 'stopped' ? 'inactive' : rx.status,
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
    for (const step of CADENCE) {
      const dueAt = addDays(now, step.daysOffset)
      const title = step.titleFn(rx.medication_name)
      await createTask({
        patient_id:          params.id,
        title,
        category:            'med',
        priority:            step.priority,
        source:              'med_change',
        source_ref:          change.id,
        due_at:              dueAt,
        requires_md_signoff: step.role === 'md',
      })
      scheduledTasks.push({ title, dueAt: dueAt.toISOString() })
    }
  }

  return NextResponse.json({
    changeId: change.id,
    scheduledTasks,
  }, { status: 201 })
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/provider/patients/[id]/prescriptions/[rxId]/change/route.ts"
git commit -m "feat: add POST rx change endpoint with 5-task cadence creation"
```

---

## Task 8: PlanEditor component

**Files:**
- Create: `src/components/provider/PlanEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, useRef } from 'react'

interface Props {
  patientId: string
  initialPlan: string | null
  initialNextStep: string | null
}

export function PlanEditor({ patientId, initialPlan, initialNextStep }: Props) {
  const [plan, setPlan] = useState(initialPlan ?? '')
  const [nextStep, setNextStep] = useState(initialNextStep ?? '')
  const [savedPlan, setSavedPlan] = useState(false)
  const [savedNextStep, setSavedNextStep] = useState(false)
  const [error, setError] = useState('')

  async function save(field: 'plan' | 'nextStep') {
    try {
      const body = field === 'plan'
        ? { current_plan: plan || null }
        : { next_step: nextStep || null }
      const res = await fetch(`/api/provider/patients/${patientId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Save failed')
      if (field === 'plan') { setSavedPlan(true); setTimeout(() => setSavedPlan(false), 2000) }
      else { setSavedNextStep(true); setTimeout(() => setSavedNextStep(false), 2000) }
    } catch {
      setError('Failed to save')
      setTimeout(() => setError(''), 3000)
    }
  }

  return (
    <div className="space-y-3">
      {/* Current Plan */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-aubergine/40">Current Plan</span>
          {savedPlan && <span className="text-xs text-emerald-600">Saved</span>}
        </div>
        <textarea
          value={plan}
          onChange={e => setPlan(e.target.value)}
          onBlur={() => save('plan')}
          placeholder="Enter treatment plan..."
          rows={3}
          className="w-full text-sm text-aubergine border border-aubergine/10 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white"
        />
      </div>

      {/* Next Step */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-aubergine/40">Next Step</span>
          {savedNextStep && <span className="text-xs text-emerald-600">Saved</span>}
        </div>
        <input
          type="text"
          value={nextStep}
          onChange={e => setNextStep(e.target.value)}
          onBlur={() => save('nextStep')}
          placeholder="No current action needed"
          className="w-full text-sm text-aubergine border border-aubergine/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/provider/PlanEditor.tsx
git commit -m "feat: add PlanEditor component with auto-save on blur"
```

---

## Task 9: DiffPanel component

**Files:**
- Create: `src/components/provider/DiffPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

interface RxChange {
  id: string
  change_type: string
  previous_dosage: string | null
  new_dosage: string | null
  created_at: string
}

interface RnNote {
  visit_date: string
  notes: string | null
}

interface DiffData {
  since: string | null
  wmiDelta: { from: number | null; to: number; delta: number | null } | null
  rxChanges: RxChange[]
  messageCount: number
  rnNotes: RnNote[]
}

interface Props {
  diff: DiffData
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  started:              'Started',
  dose_increased:       'Dose increased',
  dose_decreased:       'Dose decreased',
  stopped:              'Stopped',
  refill_authorized:    'Refill authorized',
  formulation_changed:  'Formulation changed',
}

export function DiffPanel({ diff }: Props) {
  if (!diff.since) {
    return (
      <div className="text-sm text-aubergine/40 italic px-1">
        No prior MD review recorded — showing all history.
      </div>
    )
  }

  const hasAnything = diff.wmiDelta || diff.rxChanges.length > 0 || diff.messageCount > 0 || diff.rnNotes.length > 0

  if (!hasAnything) {
    return (
      <div className="text-sm text-aubergine/40 italic px-1">
        No changes since last MD review on {formatDate(diff.since)}.
      </div>
    )
  }

  return (
    <div className="divide-y divide-aubergine/5">
      {diff.wmiDelta && (
        <div className="flex items-baseline gap-3 py-2.5">
          <span className="text-xs font-semibold text-aubergine/40 w-24 flex-shrink-0">WMI</span>
          <span className="text-sm text-aubergine">
            {diff.wmiDelta.from != null ? `${diff.wmiDelta.from} → ` : ''}{diff.wmiDelta.to}
            {diff.wmiDelta.delta != null && (
              <span className={`ml-2 text-xs font-semibold ${diff.wmiDelta.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {diff.wmiDelta.delta >= 0 ? `↑ ${diff.wmiDelta.delta}` : `↓ ${Math.abs(diff.wmiDelta.delta)}`}
              </span>
            )}
          </span>
        </div>
      )}

      {diff.rxChanges.length > 0 && (
        <div className="flex items-baseline gap-3 py-2.5">
          <span className="text-xs font-semibold text-aubergine/40 w-24 flex-shrink-0">Rx Changes</span>
          <div className="text-sm text-aubergine space-y-0.5">
            {diff.rxChanges.map(c => (
              <div key={c.id}>
                {CHANGE_TYPE_LABELS[c.change_type] ?? c.change_type}
                {c.new_dosage ? ` → ${c.new_dosage}` : ''}
                <span className="text-aubergine/40 ml-1">({formatDate(c.created_at)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.messageCount > 0 && (
        <div className="flex items-baseline gap-3 py-2.5">
          <span className="text-xs font-semibold text-aubergine/40 w-24 flex-shrink-0">Messages</span>
          <span className="text-sm text-aubergine">{diff.messageCount} new</span>
        </div>
      )}

      {diff.rnNotes.length > 0 && (
        <div className="flex items-baseline gap-3 py-2.5">
          <span className="text-xs font-semibold text-aubergine/40 w-24 flex-shrink-0">RN Notes</span>
          <div className="text-sm text-aubergine space-y-0.5">
            {diff.rnNotes.map((n, i) => (
              <div key={i} className="truncate">
                {n.notes ? `${n.notes.slice(0, 80)}${n.notes.length > 80 ? '…' : ''}` : 'Note recorded'}
                <span className="text-aubergine/40 ml-1">({formatDate(n.visit_date)})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/provider/DiffPanel.tsx
git commit -m "feat: add DiffPanel component"
```

---

## Task 10: MedChangeModal component

**Files:**
- Create: `src/components/provider/MedChangeModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  prescriptionId: string
  medicationName: string
  currentDosage: string
  onClose: () => void
  onSuccess: () => void
}

const CHANGE_TYPES = [
  { value: 'started',             label: 'Started' },
  { value: 'dose_increased',      label: 'Dose increased' },
  { value: 'dose_decreased',      label: 'Dose decreased' },
  { value: 'stopped',             label: 'Stopped' },
  { value: 'formulation_changed', label: 'Formulation changed' },
  { value: 'refill_authorized',   label: 'Refill authorized' },
]

const CADENCE_TYPES = new Set(['started', 'dose_increased', 'dose_decreased', 'formulation_changed'])

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function MedChangeModal({
  patientId, prescriptionId, medicationName, currentDosage, onClose, onSuccess,
}: Props) {
  const [changeType, setChangeType] = useState('')
  const [newDosage, setNewDosage] = useState(currentDosage)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ scheduledTasks: Array<{ title: string; dueAt: string }> } | null>(null)

  const showsCadence = CADENCE_TYPES.has(changeType)

  async function handleSubmit() {
    if (!changeType) { setError('Select a change type.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(
        `/api/provider/patients/${patientId}/prescriptions/${prescriptionId}/change`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ change_type: changeType, new_dosage: newDosage || undefined, reason: reason || undefined }),
        },
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to record change')
      }
      const data = await res.json()
      setResult(data)
      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-aubergine">Change recorded</h2>
          {result.scheduledTasks.length > 0 && (
            <>
              <p className="text-sm text-aubergine/60">{result.scheduledTasks.length} follow-up tasks scheduled:</p>
              <ul className="space-y-1">
                {result.scheduledTasks.map((t, i) => (
                  <li key={i} className="text-xs text-aubergine/70 flex gap-2">
                    <span className="text-aubergine/30">·</span>
                    <span className="flex-1">{t.title}</span>
                    <span className="text-aubergine/40 flex-shrink-0">{new Date(t.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            onClick={onClose}
            className="w-full py-2 text-sm bg-aubergine text-white rounded-lg hover:bg-aubergine/90"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-aubergine">Record medication change</h2>
        <p className="text-sm text-aubergine/50">{medicationName}</p>

        <div>
          <label className="block text-xs font-semibold text-aubergine/50 mb-1">Change type *</label>
          <select
            value={changeType}
            onChange={e => setChangeType(e.target.value)}
            className="w-full border border-aubergine/10 rounded-lg px-3 py-2 text-sm text-aubergine focus:outline-none focus:ring-2 focus:ring-violet/30"
          >
            <option value="">Select...</option>
            {CHANGE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {changeType !== 'stopped' && (
          <div>
            <label className="block text-xs font-semibold text-aubergine/50 mb-1">New dosage</label>
            <input
              value={newDosage}
              onChange={e => setNewDosage(e.target.value)}
              className="w-full border border-aubergine/10 rounded-lg px-3 py-2 text-sm text-aubergine focus:outline-none focus:ring-2 focus:ring-violet/30"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-aubergine/50 mb-1">Reason (optional)</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. inadequate response, side effect..."
            className="w-full border border-aubergine/10 rounded-lg px-3 py-2 text-sm text-aubergine focus:outline-none focus:ring-2 focus:ring-violet/30"
          />
        </div>

        {showsCadence && changeType && (
          <div className="bg-violet/5 rounded-lg px-3 py-2 text-xs text-aubergine/60 space-y-0.5">
            <p className="font-semibold text-aubergine/50 mb-1">5 follow-up tasks will be scheduled:</p>
            <p>· Confirm patient obtained med — {addDays(4)}</p>
            <p>· 4-week check-in — {addDays(28)}</p>
            <p>· 8-week trend review — {addDays(56)}</p>
            <p>· 12-week response review — {addDays(84)}</p>
            <p>· Annual benefit/risk — {addDays(365)}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-aubergine/60 hover:text-aubergine">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !changeType}
            className="px-4 py-2 text-sm bg-aubergine text-white rounded-lg hover:bg-aubergine/90 disabled:opacity-50"
          >
            {submitting ? 'Recording...' : 'Record change'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/provider/MedChangeModal.tsx
git commit -m "feat: add MedChangeModal with 5-task cadence preview and confirmation"
```

---

## Task 11: DashboardHome — Clinical Tasks card

**Files:**
- Modify: `src/components/provider/DashboardHome.tsx`

- [ ] **Step 1: Add task state and fetch to DashboardHome**

At the top of the component, add task-related state after the existing state declarations:

```ts
const [clinicalTasks, setClinicalTasks] = useState<any[]>([])
const [taskCloseTarget, setTaskCloseTarget] = useState<any | null>(null)
```

Inside the `Promise.all` in the second `useEffect`, add a tasks fetch (the one that already fetches appointments, intakes, messages, etc.). Replace the existing `Promise.all` call with:

```ts
    Promise.all([
      safeFetch(`/api/scheduling/appointments?providerId=${providerId}&startDate=${today}&endDate=${today}`),
      safeFetch('/api/provider/intakes'),
      safeFetch(`/api/messages?providerId=${providerId}`),
      safeFetch(`/api/refill-requests?providerId=${providerId}&status=pending`),
      safeFetch(`/api/provider/recent-cancellations?providerId=${providerId}`),
      safeFetch('/api/provider/tasks?open=true&limit=8'),
    ]).then(([apptData, intakeData, msgData, refillData, cancelData, taskData]) => {
```

Then after the existing `setLoading(false)` line, add:

```ts
      setClinicalTasks(taskData?.tasks ?? [])
```

- [ ] **Step 2: Add imports for TaskQueue, TaskCloseModal, and useRouter**

At the top of `DashboardHome.tsx`, add:

```ts
import { useRouter } from 'next/navigation'
import { TaskQueue } from '@/components/staff/TaskQueue'
import { TaskCloseModal } from '@/components/staff/TaskCloseModal'
```

Inside the component body, add the router hook and a `staffRole` state. Staff role is fetched from `/api/auth/me` (built in Build 16 as part of ProviderNav session fetch — verify this endpoint returns `{ staffRole }`):

```ts
const router = useRouter()
const [staffRole, setStaffRole] = useState('md')

useEffect(() => {
  fetch('/api/auth/me')
    .then(r => r.json())
    .then(data => { if (data?.staffRole) setStaffRole(data.staffRole) })
    .catch(() => {})
}, [])
```

If `/api/auth/me` does not exist yet, create `src/app/api/auth/me/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    userId: session.userId,
    providerId: session.providerId,
    staffRole: session.staffRole,
    role: session.role,
  })
}
```

- [ ] **Step 3: Add Clinical Tasks card below the existing grid**

In the JSX, after the `{/* Recent Cancellations */}` block (around line 458), add:

```tsx
        {/* Clinical Tasks */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-aubergine/5">
            <div className="flex items-center gap-2">
              <h2 className="font-sans font-semibold text-base text-aubergine">Clinical Tasks</h2>
              {clinicalTasks.length > 0 && (
                <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {clinicalTasks.length}
                </span>
              )}
            </div>
            <button
              onClick={() => router.push('/provider/tasks')}
              className="text-xs font-sans text-violet hover:text-aubergine/60 transition-colors"
            >
              View all →
            </button>
          </div>
          <div className="px-6 py-4">
            <TaskQueue
              tasks={clinicalTasks}
              onAcknowledge={async (taskId) => {
                await fetch(`/api/provider/tasks/${taskId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'acknowledged' }),
                })
                setClinicalTasks(q => q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t))
              }}
              onClose={setTaskCloseTarget}
            />
          </div>
        </div>

        {taskCloseTarget && (
          <TaskCloseModal
            task={taskCloseTarget}
            staffRole={staffRole}
            onClose={() => setTaskCloseTarget(null)}
            onSubmit={async (closeout) => {
              const res = await fetch(`/api/provider/tasks/${taskCloseTarget.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'closed', ...closeout }),
              })
              if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error ?? 'Failed to close task')
              }
              setClinicalTasks(q => q.filter(t => t.id !== taskCloseTarget.id))
              setTaskCloseTarget(null)
            }}
          />
        )}
```

- [ ] **Step 4: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/provider/DashboardHome.tsx
git commit -m "feat: add Clinical Tasks card to DashboardHome"
```

---

## Task 12: ProviderNav — Tasks tab

**Files:**
- Modify: `src/components/provider/ProviderNav.tsx`

- [ ] **Step 1: Add Tasks tab between Today and Patients**

In `ProviderNav.tsx`, in the tab bar JSX (in the `{!isLogin && ...}` section), add a new tab after the MD Today / RN Queue / Admin Queue role-conditional tabs and before the Patients button:

```tsx
              {/* Tasks — all staff */}
              <a
                href="/provider/tasks"
                className={`relative px-5 py-3.5 text-sm font-sans font-medium border-b-2 transition-all flex items-center gap-2 ${
                  pathname === '/provider/tasks'
                    ? 'border-violet text-violet'
                    : 'border-transparent text-aubergine/40 hover:text-aubergine/60'
                }`}
              >
                Tasks
                {(taskCounts.md + taskCounts.rn) > 0 && (
                  <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-pill font-medium">
                    {(taskCounts.md + taskCounts.rn) > 9 ? '9+' : taskCounts.md + taskCounts.rn}
                  </span>
                )}
              </a>
```

The `taskCounts` state and polling were added to ProviderNav in Build 16. Verify they exist:

```bash
grep -n "taskCounts\|setTaskCounts" src/components/provider/ProviderNav.tsx | head -10
```

If `taskCounts` exists (from Build 16), the tab above just works. If it doesn't exist yet, add this state and poll to ProviderNav:

```ts
const [taskCounts, setTaskCounts] = useState({ md: 0, rn: 0 })
useEffect(() => {
  async function fetchCounts() {
    const [mdRes, rnRes] = await Promise.all([
      fetch('/api/provider/tasks?open=true&queue=md'),
      fetch('/api/provider/tasks?open=true&queue=rn'),
    ])
    const [mdData, rnData] = await Promise.all([mdRes.json(), rnRes.json()])
    setTaskCounts({ md: mdData.tasks?.length ?? 0, rn: rnData.tasks?.length ?? 0 })
  }
  fetchCounts()
  const interval = setInterval(fetchCounts, 60_000)
  return () => clearInterval(interval)
}, [])
```

The badge uses `md + rn` count as a proxy for total urgent+MD-decision tasks.

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/provider/ProviderNav.tsx
git commit -m "feat: add Tasks tab to ProviderNav"
```

---

## Task 13: /provider/tasks page

**Files:**
- Create: `src/app/provider/tasks/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
import { TaskCloseModal } from '@/components/staff/TaskCloseModal'

interface Section {
  key: string
  label: string
  dotColor: string
  tasks: Task[]
  expanded: boolean
}

function buildSections(tasks: Task[]): Section[] {
  const urgent   = tasks.filter(t => t.priority === 'red')
  const mdReview = tasks.filter(t => t.priority === 'orange')
  const lower    = tasks.filter(t => t.priority === 'yellow' || t.priority === 'blue' || t.priority === 'gray')
  return [
    { key: 'urgent',   label: 'Urgent',        dotColor: '#dc2626', tasks: urgent,   expanded: true },
    { key: 'md',       label: 'MD Decisions',  dotColor: '#f97316', tasks: mdReview, expanded: true },
    { key: 'lower',    label: 'Lower Priority', dotColor: '#eab308', tasks: lower,   expanded: true },
  ]
}

export default function TasksPage() {
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [closeTask, setCloseTask] = useState<Task | null>(null)
  const [staffRole, setStaffRole] = useState('md')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    urgent: true, md: true, lower: true,
  })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d?.staffRole) setStaffRole(d.staffRole) }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/provider/tasks?open=true')
      .then(r => r.json())
      .then(data => {
        const tasks: Task[] = data.tasks ?? []
        setAllTasks(tasks)
        setSections(buildSections(tasks))
      })
      .finally(() => setLoading(false))
  }, [])

  function acknowledge(taskId: string) {
    fetch(`/api/provider/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    })
    setAllTasks(q => {
      const updated = q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t)
      setSections(buildSections(updated))
      return updated
    })
  }

  async function handleClose(closeout: any) {
    if (!closeTask) return
    const res = await fetch(`/api/provider/tasks/${closeTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed', ...closeout }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to close task')
    }
    setAllTasks(q => {
      const updated = q.filter(t => t.id !== closeTask.id)
      setSections(buildSections(updated))
      return updated
    })
    setCloseTask(null)
  }

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif font-normal text-3xl text-aubergine tracking-tight">Clinical Tasks</h1>
            <p className="text-sm font-sans text-aubergine/40 mt-1">{allTasks.length} open</p>
          </div>
        </div>

        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.key}>
              <button
                onClick={() => setExpandedSections(s => ({ ...s, [section.key]: !s[section.key] }))}
                className="flex items-center gap-2 mb-3 group w-full text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.dotColor }} />
                <span className="text-xs font-semibold uppercase tracking-wide text-aubergine/50 group-hover:text-aubergine/70 transition-colors">
                  {section.label}
                </span>
                <span className="text-xs text-aubergine/30 font-sans">{section.tasks.length}</span>
                <span className="text-xs text-aubergine/25 ml-auto">
                  {expandedSections[section.key] ? '▾' : '▸'}
                </span>
              </button>

              {expandedSections[section.key] && (
                section.tasks.length === 0 ? (
                  <p className="text-sm text-aubergine/30 italic pl-4 pb-2">None</p>
                ) : (
                  <TaskQueue
                    tasks={section.tasks}
                    onAcknowledge={acknowledge}
                    onClose={setCloseTask}
                  />
                )
              )}
            </div>
          ))}
        </div>

        {allTasks.length === 0 && (
          <div className="text-center py-20">
            <p className="text-aubergine/30 font-sans text-sm">No open tasks — queue is clear.</p>
          </div>
        )}
      </div>

      {closeTask && (
        <TaskCloseModal
          task={closeTask}
          staffRole={staffRole}
          onClose={() => setCloseTask(null)}
          onSubmit={handleClose}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/provider/tasks/page.tsx
git commit -m "feat: add /provider/tasks full queue page grouped by priority"
```

---

## Task 14: Patient Cockpit page

**Files:**
- Create: `src/app/provider/patients/[id]/cockpit/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
import { TaskCloseModal } from '@/components/staff/TaskCloseModal'
import { DiffPanel } from '@/components/provider/DiffPanel'
import { PlanEditor } from '@/components/provider/PlanEditor'
import { MedChangeModal } from '@/components/provider/MedChangeModal'

interface CockpitData {
  patient: {
    id: string
    current_plan: string | null
    next_step: string | null
    last_md_review_at: string | null
    last_meaningful_touch_at: string | null
  }
  liveWmi: number | null
  activeTasks: Task[]
  rxHistory: Array<{
    id: string
    change_type: string
    previous_dosage: string | null
    new_dosage: string | null
    reason: string | null
    created_at: string
    prescription_id: string
  }>
}

interface DiffData {
  since: string | null
  wmiDelta: { from: number | null; to: number; delta: number | null } | null
  rxChanges: any[]
  messageCount: number
  rnNotes: any[]
}

interface AccordionSection {
  key: string
  label: string
  count?: number
}

const ACCORDION_SECTIONS: AccordionSection[] = [
  { key: 'medications', label: 'Medication Timeline' },
  { key: 'trend',       label: 'Symptom Trend' },
  { key: 'labs',        label: 'Labs' },
  { key: 'messages',    label: 'Messages' },
  { key: 'visits',      label: 'Visit & Encounter Notes' },
]

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const CHANGE_LABELS: Record<string, string> = {
  started: 'Started', dose_increased: 'Dose ↑', dose_decreased: 'Dose ↓',
  stopped: 'Stopped', refill_authorized: 'Refill', formulation_changed: 'Formulation changed',
}

export default function CockpitPage() {
  const params = useParams()
  const patientId = params.id as string

  const [cockpit, setCockpit] = useState<CockpitData | null>(null)
  const [diff, setDiff] = useState<DiffData | null>(null)
  const [loading, setLoading] = useState(true)
  const [closeTask, setCloseTask] = useState<Task | null>(null)
  const [staffRole, setStaffRole] = useState('md')
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({})
  const [medChangeTarget, setMedChangeTarget] = useState<{ rxId: string; medName: string; dosage: string } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d?.staffRole) setStaffRole(d.staffRole) }).catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`/api/provider/patients/${patientId}/cockpit`).then(r => r.json()),
      fetch(`/api/provider/patients/${patientId}/diff`).then(r => r.json()),
    ]).then(([cockpitData, diffData]) => {
      setCockpit(cockpitData)
      setTasks(cockpitData.activeTasks ?? [])
      setDiff(diffData)
    }).finally(() => setLoading(false))
  }, [patientId])

  function toggleAccordion(key: string) {
    setOpenAccordions(s => ({ ...s, [key]: !s[key] }))
  }

  async function handleClose(closeout: any) {
    if (!closeTask) return
    const res = await fetch(`/api/provider/tasks/${closeTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed', ...closeout }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to close task')
    }
    setTasks(q => q.filter(t => t.id !== closeTask.id))
    setCloseTask(null)
    // Refresh last_md_review_at if required
    fetch(`/api/provider/patients/${patientId}/cockpit`)
      .then(r => r.json())
      .then(data => setCockpit(data))
  }

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
    </div>
  )
  if (!cockpit) return <div className="p-8 text-aubergine/40">Patient not found.</div>

  const wmiDelta = diff?.wmiDelta
  const hasReview = !!cockpit.patient.last_md_review_at

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Patient strip */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <a
                href={`/provider/patient/${patientId}`}
                className="text-xs font-sans text-violet hover:underline"
              >
                ← Back to chart
              </a>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-sans text-aubergine/40 bg-aubergine/5 px-2.5 py-1 rounded-pill">
                Last MD review: {formatDate(cockpit.patient.last_md_review_at)}
              </span>
              {wmiDelta && wmiDelta.delta != null && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-pill ${
                  wmiDelta.delta >= 0
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  WMI {wmiDelta.delta >= 0 ? `↑ ${wmiDelta.delta}` : `↓ ${Math.abs(wmiDelta.delta)}`}
                </span>
              )}
            </div>
          </div>

          <PlanEditor
            patientId={patientId}
            initialPlan={cockpit.patient.current_plan}
            initialNextStep={cockpit.patient.next_step}
          />
        </div>

        {/* Since last MD review */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5">
          <div className="px-6 pt-5 pb-3 border-b border-aubergine/5">
            <h2 className="font-sans font-semibold text-base text-aubergine">
              Since last MD review
              {hasReview && (
                <span className="text-xs font-normal text-aubergine/40 ml-2">
                  {formatDate(cockpit.patient.last_md_review_at)}
                </span>
              )}
            </h2>
          </div>
          <div className="px-6 py-4">
            {diff ? <DiffPanel diff={diff} /> : <p className="text-sm text-aubergine/40">Loading...</p>}
          </div>
        </div>

        {/* Active tasks */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5">
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-aubergine/5">
            <h2 className="font-sans font-semibold text-base text-aubergine">
              Active Tasks
              {tasks.length > 0 && (
                <span className="ml-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {tasks.length}
                </span>
              )}
            </h2>
          </div>
          <div className="px-6 py-4">
            <TaskQueue
              tasks={tasks}
              onAcknowledge={async (taskId) => {
                await fetch(`/api/provider/tasks/${taskId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'acknowledged' }),
                })
                setTasks(q => q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t))
              }}
              onClose={setCloseTask}
            />
          </div>
        </div>

        {/* History accordions */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5 divide-y divide-aubergine/5">
          {ACCORDION_SECTIONS.map(section => (
            <div key={section.key}>
              <button
                onClick={() => toggleAccordion(section.key)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-aubergine/2 transition-colors"
              >
                <span className="text-sm font-sans font-medium text-aubergine/70">
                  {section.key === 'medications'
                    ? `Medication Timeline (${cockpit.rxHistory.length} changes)`
                    : section.label}
                </span>
                <span className="text-xs text-aubergine/30">
                  {openAccordions[section.key] ? '▾' : '▸'}
                </span>
              </button>

              {openAccordions[section.key] && (
                <div className="px-6 pb-5">
                  {section.key === 'medications' && (
                    cockpit.rxHistory.length === 0 ? (
                      <p className="text-sm text-aubergine/30 italic">No medication changes recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {cockpit.rxHistory.map(c => (
                          <div key={c.id} className="flex items-center gap-3 text-sm">
                            <span className="text-xs font-semibold text-aubergine/40 w-20 flex-shrink-0">
                              {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-aubergine/60">
                              {CHANGE_LABELS[c.change_type] ?? c.change_type}
                              {c.new_dosage ? ` → ${c.new_dosage}` : ''}
                            </span>
                            <button
                              onClick={() => setMedChangeTarget({
                                rxId: c.prescription_id,
                                medName: 'Medication',
                                dosage: c.new_dosage ?? '',
                              })}
                              className="ml-auto text-xs text-violet hover:underline"
                            >
                              + Record change
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                  {section.key !== 'medications' && (
                    <p className="text-sm text-aubergine/30 italic">
                      Open the full patient chart to view {section.label.toLowerCase()}.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

      {closeTask && (
        <TaskCloseModal
          task={closeTask}
          staffRole={staffRole}
          onClose={() => setCloseTask(null)}
          onSubmit={handleClose}
        />
      )}

      {medChangeTarget && (
        <MedChangeModal
          patientId={patientId}
          prescriptionId={medChangeTarget.rxId}
          medicationName={medChangeTarget.medName}
          currentDosage={medChangeTarget.dosage}
          onClose={() => setMedChangeTarget(null)}
          onSuccess={() => {
            fetch(`/api/provider/patients/${patientId}/cockpit`)
              .then(r => r.json())
              .then(data => setCockpit(data))
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/provider/patients/[id]/cockpit/page.tsx"
git commit -m "feat: add patient cockpit page (single-column scroll)"
```

---

## Task 15: Wire MedChangeModal into PrescriptionsPanel

**Files:**
- Modify: `src/components/provider/PrescriptionsPanel.tsx`

- [ ] **Step 1: Add MedChangeModal import and state**

At the top of `PrescriptionsPanel.tsx`, add:

```ts
import { MedChangeModal } from '@/components/provider/MedChangeModal'
```

Inside the `PrescriptionsPanel` component, add state:

```ts
const [medChangeTarget, setMedChangeTarget] = useState<{
  rxId: string; medName: string; dosage: string
} | null>(null)
```

- [ ] **Step 2: Add "Record change" button to each prescription row**

In the JSX where each prescription is rendered (inside the `prescriptions.map(...)` block), add a "Record change" button after the existing prescription name/status display. Find the section that renders each prescription row and add:

```tsx
<button
  onClick={() => setMedChangeTarget({
    rxId: rx.id,
    medName: rx.medication_name,
    dosage: rx.dosage,
  })}
  className="text-xs text-violet hover:underline font-medium mt-1"
>
  Record change
</button>
```

- [ ] **Step 3: Render MedChangeModal at the bottom of the component return**

At the end of the component's JSX, before the final closing tag, add:

```tsx
{medChangeTarget && (
  <MedChangeModal
    patientId={patientId}
    prescriptionId={medChangeTarget.rxId}
    medicationName={medChangeTarget.medName}
    currentDosage={medChangeTarget.dosage}
    onClose={() => setMedChangeTarget(null)}
    onSuccess={() => {
      setMedChangeTarget(null)
      onPrescriptionSent()
    }}
  />
)}
```

- [ ] **Step 4: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/provider/PrescriptionsPanel.tsx
git commit -m "feat: add Record change button to PrescriptionsPanel"
```

---

## Task 16: Add "Open Cockpit" link to PatientOverview

**Files:**
- Modify: `src/components/provider/PatientOverview.tsx`

- [ ] **Step 1: Find where the patient ID is available in PatientOverview**

```bash
grep -n "patientId\|patient\.id\|cockpit" src/components/provider/PatientOverview.tsx | head -20
```

- [ ] **Step 2: Add "Open Cockpit" link**

PatientOverview receives a `patientId` prop (or derives it from the intake/visit data). Find the component's header section — near the patient name or the top of the card — and add:

```tsx
{patientId && (
  <a
    href={`/provider/patients/${patientId}/cockpit`}
    className="text-xs font-sans font-semibold text-violet hover:text-aubergine/60 transition-colors flex items-center gap-1"
  >
    Open Cockpit →
  </a>
)}
```

Place it in the header row where the patient name appears, right-aligned, similar to other "View all →" links in the codebase.

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/provider/PatientOverview.tsx
git commit -m "feat: add Open Cockpit link to PatientOverview"
```

---

## Task 17: Run DB migration + final verification

- [ ] **Step 1: Deploy to Vercel**

```bash
git push origin main
```

Wait for Vercel auto-deploy to complete (check https://vercel.com/dashboard or `vercel ls`).

- [ ] **Step 2: Run migration via debug endpoint**

```bash
curl -s -X POST https://www.womenkindhealth.com/api/debug/migrate-build17 \
  -H "x-migration-secret: $CRON_SECRET" | jq .
```

Expected: `{ "ok": true, "message": "Build 17 migration complete" }`

- [ ] **Step 3: Run tsc one final time**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke test the Clinical Tasks card**

Hit `GET /api/provider/tasks?open=true&limit=8` — verify it returns tasks sorted red first.

If the `tasks` table has the test task from Build 16, it should appear. Otherwise create one:

```bash
curl -s -X POST https://www.womenkindhealth.com/api/provider/tasks \
  -H "Content-Type: application/json" \
  -H "x-migration-secret: $CRON_SECRET" \
  -d '{
    "patient_id": "<any-patient-uuid>",
    "title": "Build 17 smoke test task",
    "category": "clinical",
    "priority": "orange",
    "source": "manual"
  }' | jq .
```

- [ ] **Step 5: Verify prescription_changes table exists**

```bash
curl -s -X POST https://www.womenkindhealth.com/api/debug/migrate-build17 \
  -H "x-migration-secret: $CRON_SECRET" | jq .
```

Re-running is safe (all `IF NOT EXISTS`). Should return `ok: true` again.

---

## Final Verification Checklist

- [ ] Clinical Tasks card appears on dashboard home, shows top 8 tasks priority-ordered
- [ ] Acknowledge button updates status without modal
- [ ] Close button opens TaskCloseModal, task removed on success
- [ ] "View all →" navigates to `/provider/tasks`
- [ ] `/provider/tasks` shows Urgent / MD Decisions / Lower Priority sections
- [ ] Tasks tab in ProviderNav navigates to `/provider/tasks`
- [ ] "Open Cockpit" link on PatientOverview navigates to `/provider/patients/[id]/cockpit`
- [ ] Cockpit loads: patient strip, diff panel, active tasks, history accordions
- [ ] PlanEditor saves current plan on blur, shows "Saved" confirmation
- [ ] DiffPanel shows "No prior MD review" when `last_md_review_at` is null
- [ ] Closing a `requires_md_signoff` task sets `last_md_review_at` (verify with diff panel refresh)
- [ ] "Record change" button in PrescriptionsPanel opens MedChangeModal
- [ ] "+ Record change" in cockpit med timeline opens MedChangeModal
- [ ] Submitting `started` change type creates 5 tasks (verify in `/provider/tasks`)
- [ ] Submitting `stopped` change type creates 0 tasks
- [ ] Confirmation screen lists all scheduled task titles + dates
- [ ] `tsc --noEmit` passes with no errors
