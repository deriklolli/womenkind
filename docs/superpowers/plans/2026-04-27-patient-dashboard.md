# Patient Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the patient dashboard right-column layout with the action-first, health-story-below structure defined in `docs/superpowers/specs/2026-04-27-patient-dashboard-design.md`. Five lifecycle states (S2–S6), one rotating hero card, supporting health-story stack below.

**Architecture:** Pure-function state-detector (`patient-dashboard-state.ts`) returns `{ state, heroAction }` from a snapshot of patient data. The page reads this and composes presentational components: `<DashboardHero>`, `<WMIStrip>`, `<SymptomTrendChart>`, domain cards (reused from `PatientOverview`), `<TimelineStrip>`. Data sources we don't have yet (weekly_checkins, recommended follow-up date, last-viewed timestamps) are stubbed with safe defaults so the rest of the page works today; real data wires in as those tables ship.

**Tech Stack:** Next.js 14 App Router, Tailwind (existing WomenKind tokens), React, Drizzle/RDS, Jest (for the state-detector unit tests only — components are verified visually via the dev server).

**Strategy:** Ship in vertical slices reviewable in the browser. Skip TDD for purely presentational components (no existing precedent in this codebase) — TDD applies to the state-detector, which is pure logic. Each task ends with a browser-preview check + commit.

---

## Task 1: State-detector module + tests

**Files:**
- Create: `src/lib/patient-dashboard-state.ts`
- Create: `src/lib/__tests__/patient-dashboard-state.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/patient-dashboard-state.test.ts`:

```ts
import { detectDashboardState } from '../patient-dashboard-state'

const baseSnapshot = {
  intake: { status: 'submitted', ai_brief: { summary: 'x' }, wmi_scores: { wmi: 70 } },
  appointments: [],
  prescriptions: [],
  messages: [],
  labs: [],
  blueprintVersionUpdatedAt: null,
  lastBlueprintViewedAt: null,
  lastLabsViewedAt: null,
  lastCheckinAt: null,
  recommendedFollowUpAt: null,
  now: new Date('2026-04-27T12:00:00Z'),
}

describe('detectDashboardState', () => {
  it('returns S2 when brief is ready and no appointments exist', () => {
    expect(detectDashboardState(baseSnapshot).state).toBe('S2')
  })

  it('returns S3 when an upcoming appointment exists', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-04-30T12:00:00Z'), ends_at: new Date('2026-04-30T13:00:00Z') }],
    })
    expect(result.state).toBe('S3')
  })

  it('returns S4 when most recent visit ended within 48h and no encounter notes finalized', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-04-26T12:00:00Z'), ends_at: new Date('2026-04-26T13:00:00Z'), encounterNoteFinalized: false }],
    })
    expect(result.state).toBe('S4')
  })

  it('returns S5 when treatment is active and nothing is overdue', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-04-20T12:00:00Z'), ends_at: new Date('2026-04-20T13:00:00Z'), encounterNoteFinalized: true }],
      lastCheckinAt: new Date('2026-04-25T12:00:00Z'),
    })
    expect(result.state).toBe('S5')
  })

  it('returns S6 when no check-in in >= 21 days and no upcoming visit', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-03-01T12:00:00Z'), ends_at: new Date('2026-03-01T13:00:00Z'), encounterNoteFinalized: true }],
      lastCheckinAt: new Date('2026-04-01T12:00:00Z'),
    })
    expect(result.state).toBe('S6')
  })

  it('S3 beats S6: upcoming visit overrides lapsed', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-04-30T12:00:00Z'), ends_at: new Date('2026-04-30T13:00:00Z') }],
      lastCheckinAt: new Date('2026-04-01T12:00:00Z'),
    })
    expect(result.state).toBe('S3')
  })
})

describe('detectDashboardState rotation (S5)', () => {
  const s5Base = {
    ...baseSnapshot,
    appointments: [{ starts_at: new Date('2026-04-20T12:00:00Z'), ends_at: new Date('2026-04-20T13:00:00Z'), encounterNoteFinalized: true }],
    lastCheckinAt: new Date('2026-04-25T12:00:00Z'),
  }

  it('default S5 hero is "log_checkin" when checkin not done this week', () => {
    const result = detectDashboardState({ ...s5Base, lastCheckinAt: new Date('2026-04-15T12:00:00Z') })
    expect(result.heroAction.kind).toBe('log_checkin')
  })

  it('refill <=3 days wins over message and follow-up', () => {
    const result = detectDashboardState({
      ...s5Base,
      prescriptions: [{ runs_out_at: new Date('2026-04-29T12:00:00Z'), medication_name: 'Estradiol' }],
      messages: [{ read_at: null, sender: 'provider' }],
      recommendedFollowUpAt: new Date('2026-04-20T12:00:00Z'),
    })
    expect(result.heroAction.kind).toBe('refill_due')
  })

  it('overdue follow-up wins over unread message', () => {
    const result = detectDashboardState({
      ...s5Base,
      messages: [{ read_at: null, sender: 'provider' }],
      recommendedFollowUpAt: new Date('2026-04-20T12:00:00Z'),
    })
    expect(result.heroAction.kind).toBe('followup_overdue')
  })

  it('all caught up returns "all_caught_up"', () => {
    const result = detectDashboardState(s5Base)
    expect(result.heroAction.kind).toBe('all_caught_up')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- patient-dashboard-state
```
Expected: all tests fail with "Cannot find module '../patient-dashboard-state'"

- [ ] **Step 3: Implement the state-detector**

Create `src/lib/patient-dashboard-state.ts`:

```ts
export type DashboardState = 'S2' | 'S3' | 'S4' | 'S5' | 'S6'

export type HeroAction =
  | { kind: 'book_consult' }
  | { kind: 'prep_visit'; appointment: AppointmentLike; minutesUntilStart: number }
  | { kind: 'join_video'; appointment: AppointmentLike }
  | { kind: 'awaiting_plan' }
  | { kind: 'log_checkin' }
  | { kind: 'refill_due'; prescription: PrescriptionLike }
  | { kind: 'followup_overdue'; recommendedAt: Date }
  | { kind: 'unread_message'; message: MessageLike }
  | { kind: 'new_labs'; lab: LabLike }
  | { kind: 'followup_recommended'; recommendedAt: Date }
  | { kind: 'care_plan_updated' }
  | { kind: 'all_caught_up' }
  | { kind: 'reengagement' }

export interface AppointmentLike {
  starts_at: Date | string
  ends_at: Date | string
  encounterNoteFinalized?: boolean
  daily_room_url?: string | null
}
export interface PrescriptionLike {
  runs_out_at: Date | string | null
  medication_name: string
}
export interface MessageLike {
  read_at: Date | string | null
  sender: 'provider' | 'patient'
}
export interface LabLike {
  posted_at: Date | string
}

export interface DashboardSnapshot {
  intake: { status: string; ai_brief: unknown | null; wmi_scores?: { wmi?: number } | null } | null
  appointments: AppointmentLike[]
  prescriptions: PrescriptionLike[]
  messages: MessageLike[]
  labs: LabLike[]
  blueprintVersionUpdatedAt: Date | string | null
  lastBlueprintViewedAt: Date | string | null
  lastLabsViewedAt: Date | string | null
  lastCheckinAt: Date | string | null
  recommendedFollowUpAt: Date | string | null
  now: Date
}

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null
  return v instanceof Date ? v : new Date(v)
}

const startOfWeek = (d: Date): Date => {
  const day = d.getUTCDay()
  const diff = (day + 6) % 7
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - diff)
  return start
}

export function detectDashboardState(s: DashboardSnapshot): { state: DashboardState; heroAction: HeroAction } {
  const now = s.now
  const upcoming = s.appointments
    .map(a => ({ ...a, _start: toDate(a.starts_at)!, _end: toDate(a.ends_at)! }))
    .filter(a => a._start.getTime() > now.getTime())
    .sort((a, b) => a._start.getTime() - b._start.getTime())[0]

  const recentlyEnded = s.appointments
    .map(a => ({ ...a, _end: toDate(a.ends_at)! }))
    .filter(a => a._end.getTime() <= now.getTime() && (now.getTime() - a._end.getTime()) <= 48 * 60 * 60 * 1000)
    .sort((a, b) => b._end.getTime() - a._end.getTime())[0]

  const lastCheckin = toDate(s.lastCheckinAt)
  const daysSinceCheckin = lastCheckin ? (now.getTime() - lastCheckin.getTime()) / (24 * 60 * 60 * 1000) : Infinity
  const isLapsed = daysSinceCheckin >= 21

  const hasFinalizedVisit = s.appointments.some(a => a.encounterNoteFinalized && toDate(a.ends_at)!.getTime() <= now.getTime())
  const briefReady = !!s.intake?.ai_brief

  // State precedence: S3 > S6 > S4 > S2 > S5
  if (upcoming) {
    const minutesUntilStart = (upcoming._start.getTime() - now.getTime()) / 60000
    if (minutesUntilStart <= 15 && upcoming.daily_room_url) {
      return { state: 'S3', heroAction: { kind: 'join_video', appointment: upcoming } }
    }
    return { state: 'S3', heroAction: { kind: 'prep_visit', appointment: upcoming, minutesUntilStart } }
  }

  if (isLapsed && hasFinalizedVisit) {
    return { state: 'S6', heroAction: { kind: 'reengagement' } }
  }

  if (recentlyEnded && !recentlyEnded.encounterNoteFinalized) {
    return { state: 'S4', heroAction: { kind: 'awaiting_plan' } }
  }

  if (briefReady && !hasFinalizedVisit) {
    return { state: 'S2', heroAction: { kind: 'book_consult' } }
  }

  // S5 — rotation
  return { state: 'S5', heroAction: pickS5Hero(s, now) }
}

function pickS5Hero(s: DashboardSnapshot, now: Date): HeroAction {
  // 1. Refill <= 3 days
  const refill = s.prescriptions
    .map(p => ({ ...p, _runsOut: toDate(p.runs_out_at) }))
    .filter(p => p._runsOut && (p._runsOut!.getTime() - now.getTime()) <= 3 * 24 * 60 * 60 * 1000 && (p._runsOut!.getTime() - now.getTime()) > 0)
    .sort((a, b) => a._runsOut!.getTime() - b._runsOut!.getTime())[0]
  if (refill) return { kind: 'refill_due', prescription: refill }

  // 2. Follow-up overdue
  const recAt = toDate(s.recommendedFollowUpAt)
  if (recAt && recAt.getTime() < now.getTime()) {
    return { kind: 'followup_overdue', recommendedAt: recAt }
  }

  // 3. Unread message from provider
  const unread = s.messages.find(m => !m.read_at && m.sender === 'provider')
  if (unread) return { kind: 'unread_message', message: unread }

  // 4. New labs since last view
  const lastLabsView = toDate(s.lastLabsViewedAt)
  const newLab = s.labs
    .map(l => ({ ...l, _posted: toDate(l.posted_at)! }))
    .filter(l => !lastLabsView || l._posted.getTime() > lastLabsView.getTime())
    .sort((a, b) => b._posted.getTime() - a._posted.getTime())[0]
  if (newLab) return { kind: 'new_labs', lab: newLab }

  // 5. Recommended follow-up (not yet overdue)
  if (recAt) return { kind: 'followup_recommended', recommendedAt: recAt }

  // 6. Care plan updated
  const planUpdated = toDate(s.blueprintVersionUpdatedAt)
  const lastPlanView = toDate(s.lastBlueprintViewedAt)
  if (planUpdated && (!lastPlanView || planUpdated.getTime() > lastPlanView.getTime())) {
    return { kind: 'care_plan_updated' }
  }

  // Default: log this week's check-in if not done
  const lastCheckin = toDate(s.lastCheckinAt)
  const weekStart = startOfWeek(now)
  if (!lastCheckin || lastCheckin.getTime() < weekStart.getTime()) {
    return { kind: 'log_checkin' }
  }

  return { kind: 'all_caught_up' }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- patient-dashboard-state
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/patient-dashboard-state.ts src/lib/__tests__/patient-dashboard-state.test.ts
git commit -m "Add patient dashboard state detector"
```

---

## Task 2: DashboardHero component

**Files:**
- Create: `src/components/patient/DashboardHero.tsx`

- [ ] **Step 1: Implement DashboardHero**

Create `src/components/patient/DashboardHero.tsx`:

```tsx
'use client'

import type { HeroAction } from '@/lib/patient-dashboard-state'

interface Props {
  action: HeroAction
  onPrimaryClick?: () => void
  patientFirstName?: string
}

export default function DashboardHero({ action, onPrimaryClick, patientFirstName }: Props) {
  switch (action.kind) {
    case 'book_consult':
      return (
        <HeroDark
          eyebrow="Next step"
          headline="Book your initial consultation"
          body={`${patientFirstName ? patientFirstName + ', y' : 'Y'}our intake is in. Schedule your visit with Dr. Urban to start treatment.`}
          cta="Schedule appointment"
          onClick={onPrimaryClick}
        />
      )
    case 'prep_visit': {
      const days = Math.max(0, Math.round(action.minutesUntilStart / (60 * 24)))
      const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
      return (
        <HeroLight
          eyebrow="Upcoming visit"
          headline={`Your visit is ${when}`}
          body="Take 60 seconds to log how you're feeling so Dr. Urban can prepare."
          cta="Complete pre-visit check-in"
          onClick={onPrimaryClick}
        />
      )
    }
    case 'join_video':
      return (
        <HeroLight
          eyebrow="Your visit is starting"
          headline="Join your video visit"
          body="Dr. Urban is ready when you are."
          cta="Join video call"
          onClick={onPrimaryClick}
          accent="violet"
        />
      )
    case 'awaiting_plan':
      return (
        <HeroCream
          eyebrow="After your visit"
          headline="Dr. Urban is finalizing your care plan"
          body="You'll be notified when it's ready — typically within 48 hours. No action needed right now."
        />
      )
    case 'log_checkin':
    case 'reengagement':
      return (
        <HeroDark
          eyebrow={action.kind === 'reengagement' ? 'Welcome back' : 'This week'}
          headline={action.kind === 'reengagement' ? "It's been a few weeks — how are you feeling?" : "Log this week's symptoms"}
          body="A quick 60-second check-in helps Dr. Urban tailor your treatment."
          cta="Start check-in"
          onClick={onPrimaryClick}
        />
      )
    case 'refill_due':
      return (
        <HeroBordered
          accent="amber"
          eyebrow="Prescription"
          headline={`${action.prescription.medication_name} runs out soon`}
          body="Request a refill so you don't have a gap in treatment."
          cta="Request refill"
          onClick={onPrimaryClick}
        />
      )
    case 'followup_overdue':
      return (
        <HeroBordered
          accent="red"
          eyebrow="Follow-up overdue"
          headline="Time to schedule your follow-up visit"
          body="Dr. Urban recommended a check-in by now. Let's get it on the calendar."
          cta="Schedule follow-up"
          onClick={onPrimaryClick}
        />
      )
    case 'unread_message':
      return (
        <HeroBordered
          accent="violet"
          eyebrow="From Dr. Urban"
          headline="You have a new message"
          body="Open your inbox to read and reply."
          cta="Read message"
          onClick={onPrimaryClick}
        />
      )
    case 'new_labs':
      return (
        <HeroBordered
          accent="emerald"
          eyebrow="Lab results"
          headline="New lab results are ready"
          body="Take a look at your latest results."
          cta="View labs"
          onClick={onPrimaryClick}
        />
      )
    case 'followup_recommended':
      return (
        <HeroBordered
          accent="aubergine"
          eyebrow="Follow-up"
          headline="Dr. Urban recommends a follow-up visit"
          body="When you're ready, schedule your next visit."
          cta="Schedule follow-up"
          onClick={onPrimaryClick}
        />
      )
    case 'care_plan_updated':
      return (
        <HeroBordered
          accent="violet-soft"
          eyebrow="Care plan"
          headline="Your care plan was updated"
          body="See what's new in your health blueprint."
          cta="View blueprint"
          onClick={onPrimaryClick}
        />
      )
    case 'all_caught_up':
      return (
        <HeroCream
          eyebrow="You're on track"
          headline="All caught up"
          body="Nothing to action right now. Keep up your weekly check-ins to keep your data flowing."
        />
      )
  }
}

function HeroDark(props: { eyebrow: string; headline: string; body: string; cta: string; onClick?: () => void }) {
  return (
    <section className="bg-aubergine text-white rounded-card p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-white/60 mb-2">{props.eyebrow}</div>
        <h2 className="font-serif text-3xl text-white mb-2">{props.headline}</h2>
        <p className="font-sans text-sm text-white/70 max-w-lg">{props.body}</p>
      </div>
      {props.cta && (
        <button onClick={props.onClick} className="bg-violet hover:bg-violet-dark text-white rounded-pill px-7 py-3.5 font-sans text-sm font-medium transition-colors whitespace-nowrap">
          {props.cta}
        </button>
      )}
    </section>
  )
}

function HeroLight(props: { eyebrow: string; headline: string; body: string; cta: string; onClick?: () => void; accent?: 'violet' }) {
  return (
    <section className="bg-white rounded-card shadow-sm border border-aubergine/5 p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-violet mb-2">{props.eyebrow}</div>
        <h2 className="font-serif text-3xl text-aubergine mb-2">{props.headline}</h2>
        <p className="font-sans text-sm text-aubergine/60 max-w-lg">{props.body}</p>
      </div>
      <button onClick={props.onClick} className="bg-violet hover:bg-violet-dark text-white rounded-pill px-7 py-3.5 font-sans text-sm font-medium transition-colors whitespace-nowrap">
        {props.cta}
      </button>
    </section>
  )
}

function HeroCream(props: { eyebrow: string; headline: string; body: string }) {
  return (
    <section className="bg-cream rounded-card p-7">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-aubergine/50 mb-2">{props.eyebrow}</div>
      <h2 className="font-serif text-2xl text-aubergine mb-2">{props.headline}</h2>
      <p className="font-sans text-sm text-aubergine/60 max-w-2xl">{props.body}</p>
    </section>
  )
}

function HeroBordered(props: { accent: 'amber' | 'red' | 'violet' | 'emerald' | 'aubergine' | 'violet-soft'; eyebrow: string; headline: string; body: string; cta: string; onClick?: () => void }) {
  const borderClass = {
    amber: 'border-l-amber-600',
    red: 'border-l-red-600',
    violet: 'border-l-violet',
    emerald: 'border-l-emerald-600',
    aubergine: 'border-l-aubergine/30',
    'violet-soft': 'border-l-violet/40',
  }[props.accent]
  return (
    <section className={`bg-white rounded-card shadow-sm border border-aubergine/5 border-l-4 ${borderClass} p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5`}>
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-aubergine/50 mb-2">{props.eyebrow}</div>
        <h2 className="font-serif text-2xl text-aubergine mb-2">{props.headline}</h2>
        <p className="font-sans text-sm text-aubergine/60 max-w-lg">{props.body}</p>
      </div>
      <button onClick={props.onClick} className="bg-aubergine hover:bg-aubergine-light text-white rounded-pill px-7 py-3.5 font-sans text-sm font-medium transition-colors whitespace-nowrap">
        {props.cta}
      </button>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/patient/DashboardHero.tsx
git commit -m "Add DashboardHero component with state-driven variants"
```

---

## Task 3: WMIStrip component

**Files:**
- Create: `src/components/patient/WMIStrip.tsx`

- [ ] **Step 1: Implement WMIStrip**

```tsx
'use client'

interface Props {
  currentWMI: number | null
  baselineWMI: number | null
  label?: string | null
  lastUpdatedAt?: Date | string | null
}

function trendPhrase(current: number | null, baseline: number | null): string {
  if (current == null || baseline == null) return 'baseline'
  const delta = current - baseline
  if (delta >= 5) return `up ${delta} from intake`
  if (delta >= 1) return `up ${delta} from intake`
  if (delta <= -5) return `down ${Math.abs(delta)} — let's check in`
  if (delta <= -1) return `down ${Math.abs(delta)} from intake`
  return 'steady since intake'
}

export default function WMIStrip({ currentWMI, baselineWMI, label, lastUpdatedAt }: Props) {
  if (currentWMI == null) {
    return (
      <div className="border-b border-aubergine/5 pb-5">
        <p className="font-sans text-sm text-aubergine/50">Your WMI score will appear here once your intake is processed.</p>
      </div>
    )
  }
  return (
    <div className="border-b border-aubergine/5 pb-5 flex items-baseline gap-4 flex-wrap">
      <span className="font-serif text-5xl text-aubergine leading-none">{currentWMI}</span>
      <span className="font-serif text-xl italic text-violet">{label ?? ''}</span>
      <span className="font-sans text-sm text-aubergine/60">— {trendPhrase(currentWMI, baselineWMI)}</span>
      {lastUpdatedAt && (
        <span className="font-sans text-xs text-aubergine/40 ml-auto">
          last updated {new Date(lastUpdatedAt).toLocaleDateString()}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/patient/WMIStrip.tsx
git commit -m "Add WMIStrip component"
```

---

## Task 4: SymptomTrendChart component

**Files:**
- Create: `src/components/patient/SymptomTrendChart.tsx`

- [ ] **Step 1: Implement SymptomTrendChart**

```tsx
'use client'

const DOMAINS = [
  { key: 'vasomotor', label: 'Vasomotor', color: '#944fed' },
  { key: 'sleep', label: 'Sleep', color: '#4ECDC4' },
  { key: 'mood', label: 'Mood', color: '#F4A261' },
  { key: 'energy', label: 'Energy', color: '#E76F51' },
  { key: 'cognition', label: 'Cognition', color: '#2A9D8F' },
  { key: 'gsm', label: 'GSM', color: '#E9C46A' },
] as const

export type TrendPoint = { weekIndex: number; date: string } & Partial<Record<typeof DOMAINS[number]['key'], number>>

interface Props {
  series: TrendPoint[]
}

export default function SymptomTrendChart({ series }: Props) {
  const hasData = series.length > 1
  const width = 720
  const height = 220
  const padX = 40
  const padY = 24
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const maxWeek = Math.max(11, ...series.map(p => p.weekIndex))
  const xFor = (w: number) => padX + (w / maxWeek) * innerW
  const yFor = (v: number) => padY + (1 - v / 10) * innerH

  return (
    <div className="bg-white rounded-card shadow-sm border border-aubergine/5 p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-serif text-xl text-aubergine">Your <span className="italic text-violet">trend</span></h3>
        <div className="flex flex-wrap gap-3">
          {DOMAINS.map(d => (
            <span key={d.key} className="flex items-center gap-1.5 text-xs font-sans text-aubergine/60">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.label}
            </span>
          ))}
        </div>
      </div>
      {hasData ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {[0, 2, 4, 6, 8, 10].map(g => (
            <line key={g} x1={padX} x2={width - padX} y1={yFor(g)} y2={yFor(g)} stroke="#280f49" strokeOpacity={0.05} strokeWidth={1} />
          ))}
          {DOMAINS.map(d => {
            const pts = series.filter(p => typeof p[d.key] === 'number').map(p => ({ x: xFor(p.weekIndex), y: yFor(p[d.key] as number) }))
            if (pts.length < 2) return null
            const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
            return (
              <g key={d.key}>
                <path d={path} fill="none" stroke={d.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3.5} fill={d.color} stroke="#fff" strokeWidth={1.5} />
              </g>
            )
          })}
        </svg>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-center">
          <p className="font-sans text-sm text-aubergine/50 max-w-xs">Your trend will appear here after your first visit.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/patient/SymptomTrendChart.tsx
git commit -m "Add SymptomTrendChart component"
```

---

## Task 5: TimelineStrip component

**Files:**
- Create: `src/components/patient/TimelineStrip.tsx`

- [ ] **Step 1: Implement TimelineStrip**

```tsx
'use client'

export type TimelineMarker = {
  id: string
  label: string
  date: Date | string
  status: 'past' | 'current' | 'scheduled'
  note?: string
}

interface Props {
  markers: TimelineMarker[]
}

export default function TimelineStrip({ markers }: Props) {
  if (markers.length === 0) return null
  return (
    <div className="bg-white rounded-card shadow-sm border border-aubergine/5 p-6">
      <h3 className="font-serif text-xl text-aubergine mb-5">Your <span className="italic text-violet">journey</span></h3>
      <div className="relative flex items-center justify-between gap-2 overflow-x-auto">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-aubergine/10 -z-0" />
        {markers.map(m => {
          const styles =
            m.status === 'current'
              ? 'bg-violet text-white border-violet'
              : m.status === 'scheduled'
              ? 'bg-white text-aubergine/60 border border-dashed border-aubergine/30'
              : 'bg-white text-aubergine/50 border border-aubergine/10'
          return (
            <div key={m.id} className="relative z-10 flex flex-col items-center min-w-[110px] group">
              <div className={`px-3 py-1.5 rounded-pill text-xs font-sans font-medium ${styles}`} title={`${new Date(m.date).toLocaleDateString()}${m.note ? ' — ' + m.note : ''}`}>
                {m.label}
              </div>
              <div className="font-sans text-[10px] text-aubergine/40 mt-1.5">
                {new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/patient/TimelineStrip.tsx
git commit -m "Add TimelineStrip component"
```

---

## Task 6: Wire dashboard page to new layout

**Files:**
- Modify: `src/app/patient/dashboard/page.tsx`

- [ ] **Step 1: Read the current page**

```bash
wc -l src/app/patient/dashboard/page.tsx
```

Read the full file first. Identify:
- The main `useState` for `activeView` and any view-switching logic — KEEP this (Schedule, Refill, Messages, etc. views still need to work).
- The right-column layout block (where `<PatientOverview>`, smart banner, appointments card etc. render) — REPLACE this with the new skeleton when `activeView === 'dashboard'`.
- The data-loading `useEffect`s for appointments, prescriptions, etc. — KEEP and extend.

- [ ] **Step 2: Add data loaders for new state inputs**

Inside the dashboard page, ensure the following state exists (extend existing loaders rather than creating duplicates):

```ts
const [lastCheckinAt, setLastCheckinAt] = useState<Date | null>(null) // stub null until weekly_checkins table exists
const [recommendedFollowUpAt, setRecommendedFollowUpAt] = useState<Date | null>(null) // stub null until field exists
const [unreadMessages, setUnreadMessages] = useState<{ read_at: null; sender: 'provider' }[]>([])
const [newLabs, setNewLabs] = useState<{ posted_at: string }[]>([])
```

For data we don't yet have a source for, leave the setter unused — the snapshot will pass empty arrays / nulls and the rotation logic will simply skip those branches. The dashboard works today; new data sources slot in later without UI changes.

- [ ] **Step 3: Build snapshot + detect state**

Add near the top of the rendered dashboard view (inside the component body, after data hooks):

```tsx
import { detectDashboardState } from '@/lib/patient-dashboard-state'
import DashboardHero from '@/components/patient/DashboardHero'
import WMIStrip from '@/components/patient/WMIStrip'
import SymptomTrendChart, { type TrendPoint } from '@/components/patient/SymptomTrendChart'
import TimelineStrip, { type TimelineMarker } from '@/components/patient/TimelineStrip'

const snapshot = useMemo(() => ({
  intake: overviewIntake ? { status: overviewIntake.status, ai_brief: overviewIntake.ai_brief, wmi_scores: overviewIntake.wmi_scores } : null,
  appointments: appointments.map(a => ({
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    encounterNoteFinalized: a.encounter_note_finalized ?? false,
    daily_room_url: a.daily_room_url ?? null,
  })),
  prescriptions: prescriptions.map(p => ({ runs_out_at: p.runs_out_at, medication_name: p.medication_name })),
  messages: unreadMessages,
  labs: newLabs,
  blueprintVersionUpdatedAt: null, // stub
  lastBlueprintViewedAt: null, // stub
  lastLabsViewedAt: null, // stub
  lastCheckinAt,
  recommendedFollowUpAt,
  now: new Date(),
}), [overviewIntake, appointments, prescriptions, unreadMessages, newLabs, lastCheckinAt, recommendedFollowUpAt])

const { state, heroAction } = useMemo(() => detectDashboardState(snapshot), [snapshot])

const handleHero = useCallback(() => {
  switch (heroAction.kind) {
    case 'book_consult':
    case 'prep_visit':
    case 'followup_overdue':
    case 'followup_recommended':
      setActiveView('schedule'); break
    case 'join_video':
      if (heroAction.appointment.daily_room_url) window.open(heroAction.appointment.daily_room_url, '_blank'); break
    case 'log_checkin':
    case 'reengagement':
      setActiveView('score-tracker'); break // placeholder until check-in flow exists
    case 'refill_due':
      setActiveView('refill'); break
    case 'unread_message':
      setActiveView('messages'); break
    case 'new_labs':
      setActiveView('lab-results'); break
    case 'care_plan_updated':
      setActiveView('blueprint'); break
  }
}, [heroAction])
```

- [ ] **Step 4: Replace dashboard view JSX**

Find the block where `activeView === 'dashboard'` (or the default view) renders the right column. Replace its inner content with:

```tsx
<div className="space-y-6">
  <DashboardHero
    action={heroAction}
    onPrimaryClick={handleHero}
    patientFirstName={patientProfile?.first_name}
  />

  <WMIStrip
    currentWMI={overviewIntake?.wmi_scores?.wmi ?? null}
    baselineWMI={overviewIntake?.wmi_scores?.wmi ?? null}
    label={overviewIntake?.wmi_scores?.wmi_label ?? null}
  />

  <SymptomTrendChart series={trendSeries} />

  {/* Domain cards: reuse existing PatientOverview component for consistency */}
  <PatientOverview intake={overviewIntake} />

  <TimelineStrip markers={timelineMarkers} />
</div>
```

Where `trendSeries` and `timelineMarkers` are derived inline:

```ts
const trendSeries: TrendPoint[] = useMemo(() => {
  // Baseline (week 0) from intake wmi domain scores, normalized to 0-10 scale (higher = better)
  const baseline = overviewIntake?.wmi_scores
  const points: TrendPoint[] = []
  if (baseline) {
    points.push({
      weekIndex: 0,
      date: overviewIntake?.submitted_at ?? new Date().toISOString(),
      vasomotor: typeof baseline.vms === 'number' ? Math.round(10 - (baseline.vms / 20) * 10) : undefined,
      sleep: typeof baseline.sleep === 'number' ? Math.round(10 - (baseline.sleep / 20) * 10) : undefined,
      mood: typeof baseline.mams === 'number' ? Math.round(10 - (baseline.mams / 20) * 10) : undefined,
      energy: typeof baseline.se === 'number' ? Math.round(10 - (baseline.se / 20) * 10) : undefined,
      cognition: typeof baseline.cog === 'number' ? Math.round(10 - (baseline.cog / 20) * 10) : undefined,
      gsm: typeof baseline.gsm === 'number' ? Math.round(10 - (baseline.gsm / 20) * 10) : undefined,
    })
  }
  // Visit symptom_scores would extend this; weekly_checkins will too once they exist.
  return points
}, [overviewIntake])

const timelineMarkers: TimelineMarker[] = useMemo(() => {
  const out: TimelineMarker[] = []
  if (overviewIntake?.submitted_at) {
    out.push({ id: 'intake', label: 'Intake complete', date: overviewIntake.submitted_at, status: 'past' })
  }
  appointments
    .slice()
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .forEach((a, i) => {
      const isPast = new Date(a.ends_at).getTime() < Date.now()
      out.push({
        id: `appt-${i}`,
        label: i === 0 ? 'Initial consultation' : `Follow-up ${i}`,
        date: a.starts_at,
        status: isPast ? 'past' : 'scheduled',
      })
    })
  if (out.length > 0) {
    const lastPast = [...out].reverse().find(m => m.status === 'past')
    if (lastPast) lastPast.status = 'current'
  }
  return out
}, [overviewIntake, appointments])
```

- [ ] **Step 5: Verify with browser preview**

Start the dev server and load the patient dashboard. Verify:
- Hero card renders (S2 in dev fixture state)
- WMI strip shows score
- Trend chart shows the empty-state message
- Domain cards render via PatientOverview
- Timeline strip shows "Intake complete"

Use preview tools:
```
preview_start
preview_snapshot http://localhost:3000/patient/dashboard
preview_screenshot
preview_console_logs
```

Fix any console errors before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/app/patient/dashboard/page.tsx
git commit -m "Wire patient dashboard to new action-first layout"
```

---

## Task 7: Manual state verification

- [ ] **Step 1: Walk through all 5 states in the browser**

Using dev fixtures, verify each state renders correctly:

- **S2** — Dev fixture default (intake submitted, no appointments). Hero = "Book your initial consultation".
- **S3** — Add a future appointment to fixtures. Hero = "Your visit is in N days".
- **S4** — Set a recently-ended appointment with `encounter_note_finalized: false`. Hero = cream "Dr. Urban is finalizing your care plan".
- **S5 default** — Set finalized visit, `lastCheckinAt` last week. Hero = "Log this week's symptoms".
- **S5 refill** — Add prescription with `runs_out_at` 2 days from now. Hero = "Estradiol runs out soon".
- **S6** — Set `lastCheckinAt` to 22 days ago, no upcoming appt. Hero = re-engagement.

Take screenshots of each for the user to review.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

All tests pass (the 8 pre-existing worktree failures are unrelated).

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "Patient dashboard: typecheck + visual verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** Hero (✓ Task 2), WMI strip (✓ Task 3), trend chart (✓ Task 4), domain cards (✓ reused via PatientOverview, no rebuild needed per spec), timeline strip (✓ Task 5), state detector with precedence + rotation (✓ Task 1), empty states (✓ Tasks 3 & 4 handle null/no-data), 5 lifecycle states verified end-to-end (✓ Task 7).
- **Open data dependencies:** `weekly_checkins`, `recommended_follow_up_at`, `last_*_viewed_at`, blueprint version timestamp — all stubbed with safe nulls. Page renders correctly today; rotation slots will activate as those fields ship. Documented in spec, no schema work in this plan.
- **Type consistency:** `HeroAction` discriminated union is the single source of truth. Component prop types reference it directly.
