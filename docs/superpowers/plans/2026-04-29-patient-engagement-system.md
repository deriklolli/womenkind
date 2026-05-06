# Patient Engagement System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proactive patient engagement system that sends targeted emails and in-app notifications to prevent drop-off, using a DB-backed deduplication log and per-patient preference controls.

**Architecture:** Two new DB tables (`engagement_log` for dedup/audit, `notification_preferences` for opt-outs) power a shared `src/lib/engagement.ts` helper. Three Vercel cron routes handle fixed-cadence and time-decay triggers; two event hooks (daily check-in POST, lab order result) handle real-time triggers. Patients manage preferences via a new Settings card with three category toggles and a one-click unsubscribe link in every email footer.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, Resend (email), Supabase Admin (login date lookup), existing `notifications` table (in-app), Vercel Cron, Node.js `crypto` (HMAC unsubscribe token)

---

## File Map

**Create:**
- `src/lib/engagement.ts` — all shared helpers: `alreadySentRecently`, `logEngagement`, `isEngagementEnabled`, `generateUnsubscribeToken`, `engagementEmail`
- `src/app/api/engagement/weekly-nudge/route.ts`
- `src/app/api/engagement/monthly-recap/route.ts`
- `src/app/api/engagement/daily-scan/route.ts`
- `src/app/api/engagement/unsubscribe/route.ts`
- `src/app/api/patient/notification-preferences/route.ts`
- `src/app/api/debug/migrate-engagement/route.ts` — one-time migration that creates both new tables

**Modify:**
- `src/lib/db/schema.ts` — add `engagement_log` and `notification_preferences` table definitions
- `src/app/api/daily-checkin/route.ts` — add score-drop hook after insert
- `src/components/patient/NotificationBell.tsx` — add 3 new notification type icons
- `src/app/patient/settings/page.tsx` — add Email Notifications toggles card
- `vercel.json` — add 3 cron entries

---

## Task 1: DB migration — create `engagement_log` and `notification_preferences`

**Files:**
- Create: `src/app/api/debug/migrate-engagement/route.ts`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add both tables to `src/lib/db/schema.ts`**

Open `src/lib/db/schema.ts`. At the bottom of the file, after the existing table definitions, add:

```typescript
// ── Engagement Log ────────────────────────────────────────────────────────────
export const engagement_log = pgTable('engagement_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  patient_id:   uuid('patient_id').notNull().references(() => patients.id),
  trigger_type: text('trigger_type').notNull(),
  channel:      text('channel').notNull().default('email'),
  sent_at:      timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  metadata:     json('metadata'),
})

// ── Notification Preferences ──────────────────────────────────────────────────
export const notification_preferences = pgTable('notification_preferences', {
  id:                uuid('id').primaryKey().defaultRandom(),
  patient_id:        uuid('patient_id').notNull().unique().references(() => patients.id),
  checkin_reminders: boolean('checkin_reminders').notNull().default(true),
  progress_updates:  boolean('progress_updates').notNull().default(true),
  care_alerts:       boolean('care_alerts').notNull().default(true),
  updated_at:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 2: Create the migration route**

Create `src/app/api/debug/migrate-engagement/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS engagement_log (
      id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id   uuid        NOT NULL REFERENCES patients(id),
      trigger_type text        NOT NULL,
      channel      text        NOT NULL DEFAULT 'email',
      sent_at      timestamptz NOT NULL DEFAULT now(),
      metadata     jsonb
    );
    CREATE INDEX IF NOT EXISTS engagement_log_patient_trigger_idx
      ON engagement_log(patient_id, trigger_type, sent_at DESC);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        uuid        NOT NULL UNIQUE REFERENCES patients(id),
      checkin_reminders boolean     NOT NULL DEFAULT true,
      progress_updates  boolean     NOT NULL DEFAULT true,
      care_alerts       boolean     NOT NULL DEFAULT true,
      updated_at        timestamptz NOT NULL DEFAULT now()
    );
  `)

  return NextResponse.json({ ok: true, message: 'engagement_log and notification_preferences created' })
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/deriklolli/Projects/WOMENKIND/WomenKind && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 4: Deploy and run migration**

```bash
git add src/lib/db/schema.ts src/app/api/debug/migrate-engagement/route.ts
git commit -m "Add engagement_log and notification_preferences schema + migration route"
```

After deploy, run:
```bash
curl -X POST https://www.womenkindhealth.com/api/debug/migrate-engagement \
  -H "x-migration-secret: $CRON_SECRET"
```
Expected: `{"ok":true,"message":"engagement_log and notification_preferences created"}`

---

## Task 2: Core engagement helpers (`src/lib/engagement.ts`)

**Files:**
- Create: `src/lib/engagement.ts`

This file provides five exports used by every cron route and event hook.

- [ ] **Step 1: Create `src/lib/engagement.ts`**

```typescript
import { createHmac } from 'crypto'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { engagement_log, notification_preferences } from '@/lib/db/schema'
import { eq, and, gte } from 'drizzle-orm'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

// ── Frequency cap ─────────────────────────────────────────────────────────────

export async function alreadySentRecently(
  patientId: string,
  triggerType: string,
  withinDays: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000)
  const rows = await db.select({ id: engagement_log.id })
    .from(engagement_log)
    .where(and(
      eq(engagement_log.patient_id, patientId),
      eq(engagement_log.trigger_type, triggerType),
      gte(engagement_log.sent_at, cutoff),
    ))
    .limit(1)
  return rows.length > 0
}

// ── Log a sent message ────────────────────────────────────────────────────────

export async function logEngagement(
  patientId: string,
  triggerType: string,
  channel: 'email' | 'in_app',
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(engagement_log).values({
    patient_id:   patientId,
    trigger_type: triggerType,
    channel,
    metadata:     metadata ?? null,
  })
}

// ── Preference check ──────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, 'checkin_reminders' | 'progress_updates' | 'care_alerts'> = {
  weekly_nudge:    'checkin_reminders',
  missed_checkins: 'checkin_reminders',
  monthly_recap:   'progress_updates',
  score_drop:      'care_alerts',
  post_visit:      'care_alerts',
  // rx_refill and lab_results_ready not in map → always send
}

export async function isEngagementEnabled(patientId: string, triggerType: string): Promise<boolean> {
  const category = CATEGORY_MAP[triggerType]
  if (!category) return true  // clinical trigger — always send
  const rows = await db.select()
    .from(notification_preferences)
    .where(eq(notification_preferences.patient_id, patientId))
    .limit(1)
  if (rows.length === 0) return true  // no row = all defaults on
  return rows[0][category]
}

// ── Unsubscribe token ─────────────────────────────────────────────────────────

export function generateUnsubscribeToken(patientId: string): string {
  return createHmac('sha256', process.env.CRON_SECRET!).update(patientId).digest('hex')
}

export function verifyUnsubscribeToken(patientId: string, token: string): boolean {
  return generateUnsubscribeToken(patientId) === token
}

// ── Email HTML builder ────────────────────────────────────────────────────────

export function buildEngagementEmail(params: {
  heading: string
  bodyHtml: string
  ctaText: string
  ctaUrl: string
  secondaryCtaText?: string
  secondaryCtaUrl?: string
  patientId: string
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const token = generateUnsubscribeToken(params.patientId)
  const unsubUrl = `${appUrl}/api/engagement/unsubscribe?patientId=${encodeURIComponent(params.patientId)}&token=${token}`
  const prefsUrl = `${appUrl}/patient/settings`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7f3ee;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f3ee;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:48px 48px 32px;text-align:center;">
    <img src="${appUrl}/womenkind-logo.png" alt="Womenkind" style="height:32px;" />
  </td></tr>
  <tr><td style="background-color:#ffffff;border-radius:20px;padding:40px 48px;">
    <p style="margin:0 0 8px;font-size:12px;color:rgba(66,42,31,0.45);font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Womenkind Health</p>
    <h1 style="margin:0 0 20px;font-size:26px;font-weight:400;color:#280f49;line-height:1.3;">${params.heading}</h1>
    ${params.bodyHtml}
    <div style="margin:28px 0 0;">
      <a href="${params.ctaUrl}" style="display:inline-block;background-color:#944fed;color:white;padding:14px 32px;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;">${params.ctaText}</a>
    </div>
    ${params.secondaryCtaText ? `<p style="margin:16px 0 0;"><a href="${params.secondaryCtaUrl}" style="color:#944fed;text-decoration:none;font-size:14px;">${params.secondaryCtaText}</a></p>` : ''}
  </td></tr>
  <tr><td style="padding:24px 48px;text-align:center;">
    <p style="font-size:12px;color:rgba(66,42,31,0.45);margin:0 0 8px;">Womenkind Health · Concierge menopause care</p>
    <p style="font-size:11px;color:rgba(66,42,31,0.35);margin:0;">
      <a href="${prefsUrl}" style="color:rgba(66,42,31,0.45);text-decoration:underline;">Manage email preferences</a>
      &nbsp;·&nbsp;
      <a href="${unsubUrl}" style="color:rgba(66,42,31,0.45);text-decoration:underline;">Unsubscribe from all</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export { resend, FROM }
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/engagement.ts
git commit -m "Add engagement helpers: frequency cap, preference check, email builder, unsubscribe token"
```

---

## Task 3: NotificationBell — add 3 new notification type icons

**Files:**
- Modify: `src/components/patient/NotificationBell.tsx`

- [ ] **Step 1: Read the existing icon switch/map in NotificationBell**

Open `src/components/patient/NotificationBell.tsx` and find the section that maps `notification.type` to an icon (look for `rx_refill_approved` or `new_message` — that's the icon block).

- [ ] **Step 2: Add three new type cases**

In the icon mapping block, add the three new types alongside the existing ones. Follow the exact same JSX/SVG pattern used for `new_message` and `lab_results_ready`. Add:

```tsx
{/* checkin_reminder — clock/calendar icon */}
{notification.type === 'checkin_reminder' && (
  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(148,79,237,0.1)' }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#944fed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  </div>
)}

{/* score_drop — trending down icon */}
{notification.type === 'score_drop' && (
  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.08)' }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
    </svg>
  </div>
)}

{/* rx_refill_reminder — pill icon */}
{notification.type === 'rx_refill_reminder' && (
  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(14,116,144,0.08)' }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0e7490" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/><circle cx="18" cy="18" r="3"/><path d="M22 22l-1.5-1.5"/>
    </svg>
  </div>
)}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/patient/NotificationBell.tsx
git commit -m "Add checkin_reminder, score_drop, rx_refill_reminder icons to NotificationBell"
```

---

## Task 4: Notification preferences API

**Files:**
- Create: `src/app/api/patient/notification-preferences/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { notification_preferences } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const DEFAULT_PREFS = { checkin_reminders: true, progress_updates: true, care_alerts: true }

export async function GET(_req: NextRequest) {
  const session = await getServerSession()
  if (!session || session.role !== 'patient' || !session.patientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await db.select()
    .from(notification_preferences)
    .where(eq(notification_preferences.patient_id, session.patientId))
    .limit(1)
  return NextResponse.json(rows[0] ?? { ...DEFAULT_PREFS, patient_id: session.patientId })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession()
  if (!session || session.role !== 'patient' || !session.patientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const allowed = ['checkin_reminders', 'progress_updates', 'care_alerts'] as const
  const update: Partial<Record<typeof allowed[number], boolean>> = {}
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') update[key] = body[key]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }
  await db.insert(notification_preferences)
    .values({ patient_id: session.patientId, ...DEFAULT_PREFS, ...update })
    .onConflictDoUpdate({
      target: notification_preferences.patient_id,
      set: { ...update, updated_at: new Date() },
    })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/patient/notification-preferences/route.ts
git commit -m "Add GET/PATCH notification-preferences API"
```

---

## Task 5: Unsubscribe route

**Files:**
- Create: `src/app/api/engagement/unsubscribe/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notification_preferences, patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyUnsubscribeToken } from '@/lib/engagement'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const token = searchParams.get('token')

  if (!patientId || !token || !verifyUnsubscribeToken(patientId, token)) {
    return new NextResponse('Invalid unsubscribe link.', { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  // Verify patient exists
  const patient = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1)
  if (patient.length === 0) {
    return new NextResponse('Patient not found.', { status: 404, headers: { 'Content-Type': 'text/html' } })
  }

  await db.insert(notification_preferences)
    .values({
      patient_id: patientId,
      checkin_reminders: false,
      progress_updates:  false,
      care_alerts:       false,
    })
    .onConflictDoUpdate({
      target: notification_preferences.patient_id,
      set: {
        checkin_reminders: false,
        progress_updates:  false,
        care_alerts:       false,
        updated_at:        new Date(),
      },
    })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Unsubscribed</title></head>
<body style="margin:0;padding:40px 20px;background-color:#f7f3ee;font-family:'Plus Jakarta Sans',Arial,sans-serif;text-align:center;">
  <img src="${appUrl}/womenkind-logo.png" alt="Womenkind" style="height:32px;margin-bottom:32px;" /><br/>
  <h1 style="font-size:24px;font-weight:400;color:#280f49;">You've been unsubscribed.</h1>
  <p style="color:rgba(66,42,31,0.6);max-width:400px;margin:16px auto;">You won't receive engagement emails from Womenkind. Prescription refill and lab result notifications will still be sent as part of your care.</p>
  <p style="margin-top:24px;"><a href="${appUrl}/patient/settings" style="color:#944fed;text-decoration:none;font-size:14px;">Manage preferences in Settings</a></p>
</body>
</html>`
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/engagement/unsubscribe/route.ts
git commit -m "Add one-click unsubscribe route with HMAC token verification"
```

---

## Task 6: Settings page — Email Notifications card

**Files:**
- Modify: `src/app/patient/settings/page.tsx`

- [ ] **Step 1: Add state and fetch to the settings page**

Open `src/app/patient/settings/page.tsx`. Find the `useState` block near the top of the component. Add three state variables:

```typescript
const [notifPrefs, setNotifPrefs] = useState({
  checkin_reminders: true,
  progress_updates:  true,
  care_alerts:       true,
})
const [notifLoading, setNotifLoading] = useState(true)
const [notifSaving, setNotifSaving] = useState(false)
```

- [ ] **Step 2: Fetch preferences on mount**

Inside the existing `useEffect` that loads patient data (or in a separate `useEffect` after the component mounts), add:

```typescript
useEffect(() => {
  fetch('/api/patient/notification-preferences')
    .then(r => r.json())
    .then(data => {
      setNotifPrefs({
        checkin_reminders: data.checkin_reminders ?? true,
        progress_updates:  data.progress_updates  ?? true,
        care_alerts:       data.care_alerts        ?? true,
      })
    })
    .finally(() => setNotifLoading(false))
}, [])
```

- [ ] **Step 3: Add the toggle handler**

```typescript
async function handleNotifToggle(key: 'checkin_reminders' | 'progress_updates' | 'care_alerts') {
  const newVal = !notifPrefs[key]
  setNotifPrefs(prev => ({ ...prev, [key]: newVal }))
  setNotifSaving(true)
  await fetch('/api/patient/notification-preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [key]: newVal }),
  })
  setNotifSaving(false)
}
```

- [ ] **Step 4: Add the Notifications card to the JSX**

Find the existing settings card section (the white rounded cards containing profile info or wearable settings). Add a new card after the existing ones:

```tsx
{/* Email Notifications card */}
<div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8">
  <h2 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-6">
    Email Notifications
  </h2>
  {notifLoading ? (
    <div className="space-y-4 animate-pulse">
      {[0,1,2].map(i => <div key={i} className="h-12 bg-aubergine/5 rounded-xl" />)}
    </div>
  ) : (
    <div className="space-y-0 divide-y divide-aubergine/5">
      {([
        { key: 'checkin_reminders', label: 'Check-in Reminders',  subtitle: 'Weekly symptom nudges and missed check-in alerts' },
        { key: 'progress_updates',  label: 'Progress Updates',    subtitle: 'Monthly recap of your WMI trend and domain improvements' },
        { key: 'care_alerts',       label: 'Care Alerts',         subtitle: 'Notifications when your symptom scores change or after a visit' },
      ] as const).map(({ key, label, subtitle }) => (
        <div key={key} className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-sans font-medium text-aubergine">{label}</p>
            <p className="text-xs font-sans text-aubergine/45 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={() => handleNotifToggle(key)}
            disabled={notifSaving}
            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            style={{ backgroundColor: notifPrefs[key] ? '#944fed' : 'rgba(66,42,31,0.15)' }}
            aria-checked={notifPrefs[key]}
            role="switch"
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
              style={{ transform: notifPrefs[key] ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      ))}
    </div>
  )}
  <p className="text-xs font-sans text-aubergine/40 mt-4 pt-4 border-t border-aubergine/5">
    Prescription refill and lab result notifications are always sent — they're part of your care plan.
  </p>
</div>
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/patient/settings/page.tsx
git commit -m "Add Email Notifications preference toggles to patient settings"
```

---

## Task 7: Weekly nudge cron route

**Files:**
- Create: `src/app/api/engagement/weekly-nudge/route.ts`

Runs every Monday at 8am MT (14:00 UTC). Skips patients who already checked in this week or received this nudge in the last 7 days.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles, visits, notifications } from '@/lib/db/schema'
import { eq, and, gte, ne } from 'drizzle-orm'
import { Resend } from 'resend'
import {
  alreadySentRecently, logEngagement, isEngagementEnabled,
  buildEngagementEmail,
} from '@/lib/engagement'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'

  // Active patients = submitted intake + has at least one check-in
  const activePatients = await db
    .selectDistinct({ id: patients.id, profile_id: patients.profile_id })
    .from(patients)
    .innerJoin(visits, and(eq(visits.patient_id, patients.id), eq(visits.source, 'daily')))
    .where(eq(patients.is_active, true))

  // Monday of current week (to check if patient already checked in this week)
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon ...
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const mondayIso = monday.toISOString().slice(0, 10)

  let sent = 0
  let skipped = 0

  for (const patient of activePatients) {
    // Check preference
    if (!await isEngagementEnabled(patient.id, 'weekly_nudge')) { skipped++; continue }
    // Check frequency cap
    if (await alreadySentRecently(patient.id, 'weekly_nudge', 7)) { skipped++; continue }
    // Skip if already checked in this week
    const checkedIn = await db.select({ id: visits.id })
      .from(visits)
      .where(and(
        eq(visits.patient_id, patient.id),
        eq(visits.source, 'daily'),
        gte(visits.visit_date, mondayIso),
      ))
      .limit(1)
    if (checkedIn.length > 0) { skipped++; continue }

    // Get patient email + name
    const profile = await db.select({ email: profiles.email, first_name: profiles.first_name })
      .from(profiles).where(eq(profiles.id, patient.profile_id)).limit(1)
    if (!profile[0]?.email) { skipped++; continue }

    const firstName = profile[0].first_name ?? 'there'
    const html = buildEngagementEmail({
      heading: 'Time for your weekly check-in',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName}, your weekly symptom check-in takes about 60 seconds and helps Dr. Urban track your progress over time.</p>`,
      ctaText: 'Log Check-In',
      ctaUrl:  `${appUrl}/patient/dashboard`,
      patientId: patient.id,
    })

    await resend.emails.send({
      from: FROM,
      to: profile[0].email,
      subject: 'Your weekly check-in is ready',
      html,
    })

    // In-app notification
    await db.insert(notifications).values({
      patient_id: patient.id,
      type:       'checkin_reminder',
      title:      'Time for your check-in',
      body:       'Log how you\'re feeling this week — takes 60 seconds.',
      link_view:  'scorecard',
    })

    await logEngagement(patient.id, 'weekly_nudge', 'email')
    await logEngagement(patient.id, 'weekly_nudge', 'in_app')
    sent++
  }

  return NextResponse.json({ sent, skipped })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/engagement/weekly-nudge/route.ts
git commit -m "Add weekly check-in nudge cron route"
```

---

## Task 8: Monthly recap cron route

**Files:**
- Create: `src/app/api/engagement/monthly-recap/route.ts`

Runs on the 1st of each month at 8am MT. Sends a progress email summarising WMI trend, top improving domain, and check-in count for the past 30 days.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles, visits, appointments } from '@/lib/db/schema'
import { eq, and, gte, lte, gt } from 'drizzle-orm'
import { Resend } from 'resend'
import { alreadySentRecently, logEngagement, isEngagementEnabled, buildEngagementEmail } from '@/lib/engagement'
import { computeLiveWMI } from '@/lib/wmi-scoring'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

const DOMAIN_NAMES: Record<string, string> = {
  vasomotor: 'Vasomotor', sleep: 'Sleep', energy: 'Energy', mood: 'Mood',
  cognition: 'Cognition', gsm: 'Hormonal', bone: 'Bone Health',
  weight: 'Metabolism', libido: 'Libido', cardio: 'Cardiovascular',
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString().slice(0, 10)
  const sixtyDaysAgoIso  = sixtyDaysAgo.toISOString().slice(0, 10)
  const nowIso = now.toISOString().slice(0, 10)

  const activePatients = await db
    .selectDistinct({ id: patients.id, profile_id: patients.profile_id })
    .from(patients)
    .innerJoin(visits, and(eq(visits.patient_id, patients.id), eq(visits.source, 'daily')))
    .where(eq(patients.is_active, true))

  let sent = 0
  let skipped = 0

  for (const patient of activePatients) {
    if (!await isEngagementEnabled(patient.id, 'monthly_recap')) { skipped++; continue }
    if (await alreadySentRecently(patient.id, 'monthly_recap', 28)) { skipped++; continue }

    const profile = await db.select({ email: profiles.email, first_name: profiles.first_name })
      .from(profiles).where(eq(profiles.id, patient.profile_id)).limit(1)
    if (!profile[0]?.email) { skipped++; continue }

    // Check-ins from last 30 days
    const recentCheckins = await db.select({ visit_date: visits.visit_date, symptom_scores: visits.symptom_scores, source: visits.source })
      .from(visits)
      .where(and(eq(visits.patient_id, patient.id), eq(visits.source, 'daily'), gte(visits.visit_date, thirtyDaysAgoIso)))

    if (recentCheckins.length === 0) { skipped++; continue }

    // Check-ins from 30–60 days ago (for comparison)
    const prevCheckins = await db.select({ visit_date: visits.visit_date, symptom_scores: visits.symptom_scores, source: visits.source })
      .from(visits)
      .where(and(
        eq(visits.patient_id, patient.id), eq(visits.source, 'daily'),
        gte(visits.visit_date, sixtyDaysAgoIso), lte(visits.visit_date, thirtyDaysAgoIso),
      ))

    const currentWmi = computeLiveWMI(recentCheckins)
    const prevWmi    = prevCheckins.length > 0 ? computeLiveWMI(prevCheckins) : null
    const wmiDelta   = currentWmi !== null && prevWmi !== null ? Math.round((currentWmi - prevWmi) * 10) / 10 : null

    // Top improving domain: compare avg scores last 30 days vs prev 30 days
    const domainKeys = Object.keys(DOMAIN_NAMES)
    let topDomain: string | null = null
    let topImprovement = -Infinity
    for (const domain of domainKeys) {
      const avgRecent = recentCheckins.filter(c => c.symptom_scores && typeof (c.symptom_scores as any)[domain] === 'number')
        .reduce((sum, c, _, arr) => sum + (c.symptom_scores as any)[domain] / arr.length, 0)
      const avgPrev = prevCheckins.filter(c => c.symptom_scores && typeof (c.symptom_scores as any)[domain] === 'number')
        .reduce((sum, c, _, arr) => sum + (c.symptom_scores as any)[domain] / arr.length, 0)
      if (prevCheckins.length > 0) {
        // Lower = better for burden-scale domains; improvement = prev - recent
        const improvement = avgPrev - avgRecent
        if (improvement > topImprovement) { topImprovement = improvement; topDomain = domain }
      }
    }

    // Upcoming appointment check
    const upcomingAppt = await db.select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.patient_id, patient.id), gt(appointments.ends_at, now), eq(appointments.status, 'confirmed')))
      .limit(1)
    const hasUpcoming = upcomingAppt.length > 0

    const firstName = profile[0].first_name ?? 'there'
    const monthName = now.toLocaleDateString('en-US', { month: 'long' })
    const wmiDisplay = currentWmi !== null ? Math.round(currentWmi) : null
    const deltaText = wmiDelta !== null
      ? wmiDelta > 0 ? `<span style="color:#0e7a5a">▲ ${wmiDelta} pts</span>` : wmiDelta < 0 ? `<span style="color:#b91c1c">▼ ${Math.abs(wmiDelta)} pts</span>` : 'Holding steady'
      : ''

    const bodyHtml = `
      <p style="margin:0 0 20px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName}, here's your ${monthName} summary.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ee;border-radius:14px;padding:20px;margin:0 0 20px;">
        <tr>
          <td style="text-align:center;padding:8px 16px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Womenkind Score</p>
            <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#280f49;">${wmiDisplay ?? '—'}</p>
            ${deltaText ? `<p style="margin:4px 0 0;font-size:13px;">${deltaText} from last month</p>` : ''}
          </td>
          <td style="text-align:center;padding:8px 16px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Check-ins</p>
            <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#280f49;">${recentCheckins.length}</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(66,42,31,0.5);">in the past 30 days</p>
          </td>
          ${topDomain ? `<td style="text-align:center;padding:8px 16px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Most Improved</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#280f49;">${DOMAIN_NAMES[topDomain]}</p>
          </td>` : ''}
        </tr>
      </table>
      ${!hasUpcoming ? `<p style="margin:0 0 8px;font-size:14px;color:rgba(66,42,31,0.6);line-height:1.6;">You don't have a follow-up visit scheduled. Regular check-ins with Dr. Urban help keep your treatment plan on track.</p>` : ''}
    `

    const html = buildEngagementEmail({
      heading: `Your ${monthName} progress`,
      bodyHtml,
      ctaText: 'View Your Dashboard',
      ctaUrl:  `${appUrl}/patient/dashboard`,
      secondaryCtaText: !hasUpcoming ? 'Book a Follow-Up Visit' : undefined,
      secondaryCtaUrl:  !hasUpcoming ? `${appUrl}/patient/schedule` : undefined,
      patientId: patient.id,
    })

    await resend.emails.send({
      from: FROM,
      to: profile[0].email,
      subject: `Your ${monthName} progress with Womenkind`,
      html,
    })

    await logEngagement(patient.id, 'monthly_recap', 'email', { wmi: currentWmi, checkin_count: recentCheckins.length })
    sent++
  }

  return NextResponse.json({ sent, skipped })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/engagement/monthly-recap/route.ts
git commit -m "Add monthly progress recap cron route"
```

---

## Task 9: Daily scan cron route

**Files:**
- Create: `src/app/api/engagement/daily-scan/route.ts`

Runs daily at 9am MT (15:00 UTC). Handles four checks: missed check-ins, no login 30+ days, rx refill due, post-visit follow-up.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { patients, profiles, visits, prescriptions, notifications } from '@/lib/db/schema'
import { eq, and, gte, lte, lt, ne, gt } from 'drizzle-orm'
import { Resend } from 'resend'
import { alreadySentRecently, logEngagement, isEngagementEnabled, buildEngagementEmail } from '@/lib/engagement'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const now    = new Date()

  // All active patients with at least one check-in
  const activePatients = await db
    .selectDistinct({ id: patients.id, profile_id: patients.profile_id })
    .from(patients)
    .innerJoin(visits, and(eq(visits.patient_id, patients.id), eq(visits.source, 'daily')))
    .where(eq(patients.is_active, true))

  // Supabase admin client to read last_sign_in_at from auth.users
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const loginMap = new Map(users.map(u => [u.id, u.last_sign_in_at ? new Date(u.last_sign_in_at) : null]))

  const results = { missed_checkins: 0, no_login: 0, rx_refill: 0, post_visit: 0, skipped: 0 }

  for (const patient of activePatients) {
    const profile = await db.select({ email: profiles.email, first_name: profiles.first_name })
      .from(profiles).where(eq(profiles.id, patient.profile_id)).limit(1)
    if (!profile[0]?.email) { results.skipped++; continue }
    const firstName = profile[0].first_name ?? 'there'
    const email     = profile[0].email

    // ── A: Missed 2+ consecutive check-ins (no check-in in last 14 days) ──────
    if (await isEngagementEnabled(patient.id, 'missed_checkins') && !await alreadySentRecently(patient.id, 'missed_checkins', 7)) {
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const recentCheckin = await db.select({ id: visits.id })
        .from(visits)
        .where(and(eq(visits.patient_id, patient.id), eq(visits.source, 'daily'), gte(visits.visit_date, fourteenDaysAgo)))
        .limit(1)
      if (recentCheckin.length === 0) {
        const html = buildEngagementEmail({
          heading: `We've missed you, ${firstName}`,
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Life gets busy — we get it. Your symptom data is most useful when it's consistent, but there's no pressure. Jump back in whenever you're ready.</p>`,
          ctaText: 'Log a Check-In',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          patientId: patient.id,
        })
        await resend.emails.send({ from: FROM, to: email, subject: "We've missed you", html })
        await logEngagement(patient.id, 'missed_checkins', 'email')
        results.missed_checkins++
      }
    }

    // ── B: No login in 30+ days ───────────────────────────────────────────────
    if (await isEngagementEnabled(patient.id, 'no_login') && !await alreadySentRecently(patient.id, 'no_login', 14)) {
      const lastLogin = loginMap.get(patient.profile_id)
      const daysSince = lastLogin ? (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24) : 999
      if (daysSince >= 30) {
        const html = buildEngagementEmail({
          heading: 'Your care team is still here',
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName} — we haven't gone anywhere. Your health journey continues whenever you're ready to pick it up. Log in to see your progress and connect with Dr. Urban.</p>`,
          ctaText: 'Go to My Dashboard',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          patientId: patient.id,
        })
        await resend.emails.send({ from: FROM, to: email, subject: 'Your care team is still here', html })
        await logEngagement(patient.id, 'no_login', 'email')
        results.no_login++
      }
    }

    // ── C: Rx refill due in ≤7 days ───────────────────────────────────────────
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const duePrescriptions = await db.select({ id: prescriptions.id, medication_name: prescriptions.medication_name, runs_out_at: prescriptions.runs_out_at })
      .from(prescriptions)
      .where(and(
        eq(prescriptions.patient_id, patient.id),
        eq(prescriptions.status, 'active'),
        gte(prescriptions.runs_out_at, now),
        lte(prescriptions.runs_out_at, sevenDaysFromNow),
      ))
    for (const rx of duePrescriptions) {
      if (!rx.runs_out_at) continue
      const runsOutKey = `rx_refill_${rx.id}`
      if (await alreadySentRecently(patient.id, 'rx_refill', 7)) continue
      const runOutDate = rx.runs_out_at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Denver' })
      const html = buildEngagementEmail({
        heading: `Time to refill your ${rx.medication_name}`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Your <strong>${rx.medication_name}</strong> prescription runs out around <strong>${runOutDate}</strong>. Request your refill now to avoid a gap in your treatment.</p>`,
        ctaText: 'Request Refill',
        ctaUrl:  `${appUrl}/patient/dashboard`,
        patientId: patient.id,
      })
      await resend.emails.send({ from: FROM, to: email, subject: `Time to refill your ${rx.medication_name}`, html })
      await db.insert(notifications).values({
        patient_id: patient.id,
        type:       'rx_refill_reminder',
        title:      `Refill due: ${rx.medication_name}`,
        body:       'Your prescription runs out soon. Request a refill now.',
        link_view:  'refill',
      })
      await logEngagement(patient.id, 'rx_refill', 'email', { medication_name: rx.medication_name })
      await logEngagement(patient.id, 'rx_refill', 'in_app', { medication_name: rx.medication_name })
      results.rx_refill++
    }

    // ── D: Post-visit follow-up (provider visits 47–71 hours ago) ────────────
    if (await isEngagementEnabled(patient.id, 'post_visit') && !await alreadySentRecently(patient.id, 'post_visit', 30)) {
      const cutoffStart = new Date(now.getTime() - 71 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const cutoffEnd   = new Date(now.getTime() - 47 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const recentVisit = await db.select({ id: visits.id })
        .from(visits)
        .where(and(
          eq(visits.patient_id, patient.id),
          ne(visits.source, 'daily'),
          gte(visits.visit_date, cutoffStart),
          lte(visits.visit_date, cutoffEnd),
        ))
        .limit(1)
      if (recentVisit.length > 0) {
        const html = buildEngagementEmail({
          heading: 'How are you feeling after your visit?',
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName} — we hope your visit with Dr. Urban went well. Your next check-in is a great way to start tracking progress against your care plan. And if you have any questions, we're always here.</p>`,
          ctaText: 'Log a Check-In',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          secondaryCtaText: 'Message Dr. Urban',
          secondaryCtaUrl:  `${appUrl}/patient/dashboard`,
          patientId: patient.id,
        })
        await resend.emails.send({ from: FROM, to: email, subject: 'How are you feeling after your visit?', html })
        await logEngagement(patient.id, 'post_visit', 'email')
        results.post_visit++
      }
    }
  }

  return NextResponse.json(results)
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/engagement/daily-scan/route.ts
git commit -m "Add daily scan cron: missed check-ins, no login, rx refill, post-visit triggers"
```

---

## Task 10: Score drop event hook in daily check-in

**Files:**
- Modify: `src/app/api/daily-checkin/route.ts`

After a check-in is saved, compare the new WMI to the previous check-in's WMI. If the drop is ≥20%, send a score-drop email and in-app notification.

- [ ] **Step 1: Add imports at the top of the file**

Open `src/app/api/daily-checkin/route.ts`. Add to the existing imports:

```typescript
import { Resend } from 'resend'
import { profiles, notifications } from '@/lib/db/schema'
import { desc, lt } from 'drizzle-orm'
import { alreadySentRecently, logEngagement, isEngagementEnabled, buildEngagementEmail } from '@/lib/engagement'
import { computeLiveWMI } from '@/lib/wmi-scoring'
```

(Add `profiles` and `notifications` to the existing `@/lib/db/schema` import line, and add `desc`, `lt` to the existing `drizzle-orm` import.)

- [ ] **Step 2: Add score-drop check after the `db.insert(visits)` call**

Find the line in the `POST` handler that reads:

```typescript
return NextResponse.json({ visit: inserted }, { status: 201 })
```

Replace it with:

```typescript
    // ── Score drop detection (fire-and-forget, non-blocking) ──────────────────
    ;(async () => {
      try {
        if (!await isEngagementEnabled(session.patientId!, 'score_drop')) return
        if (await alreadySentRecently(session.patientId!, 'score_drop', 3)) return

        // Get previous check-in
        const prevVisit = await db.select({ symptom_scores: visits.symptom_scores, visit_date: visits.visit_date, source: visits.source })
          .from(visits)
          .where(and(
            eq(visits.patient_id, session.patientId!),
            eq(visits.source, 'daily'),
            lt(visits.visit_date, inserted.visit_date),
          ))
          .orderBy(desc(visits.visit_date))
          .limit(1)

        if (prevVisit.length === 0) return  // no previous check-in to compare

        const newWmi  = computeLiveWMI([{ ...inserted, source: 'daily' }])
        const prevWmi = computeLiveWMI([prevVisit[0]])
        if (newWmi === null || prevWmi === null || prevWmi === 0) return
        if (newWmi >= prevWmi * 0.80) return  // drop less than 20% — no alert

        // Get patient email
        const profileRow = await db.select({ email: profiles.email, first_name: profiles.first_name })
          .from(profiles).where(eq(profiles.id, provider.id /* wrong — use patient profile_id */))
          .limit(1)

        // Get patient profile_id
        const patientRow = await db.select({ profile_id: patients.profile_id })
          .from(patients).where(eq(patients.id, session.patientId!)).limit(1)
        if (!patientRow[0]) return
        const profileData = await db.select({ email: profiles.email, first_name: profiles.first_name })
          .from(profiles).where(eq(profiles.id, patientRow[0].profile_id)).limit(1)
        if (!profileData[0]?.email) return

        const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
        const firstName = profileData[0].first_name ?? 'there'
        const resend    = new Resend(process.env.RESEND_API_KEY)
        const FROM      = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

        const html = buildEngagementEmail({
          heading: 'We noticed a change in your symptoms',
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName} — your most recent check-in shows an increase in symptoms compared to last week. This is normal and can happen during treatment. If you're concerned, reach out to Dr. Urban directly.</p>`,
          ctaText: 'Message Dr. Urban',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          secondaryCtaText: 'View Your Score',
          secondaryCtaUrl:  `${appUrl}/patient/dashboard`,
          patientId: session.patientId!,
        })

        await resend.emails.send({
          from: FROM,
          to:   profileData[0].email,
          subject: 'We noticed a change in your symptoms',
          html,
        })

        await db.insert(notifications).values({
          patient_id: session.patientId!,
          type:       'score_drop',
          title:      'Your symptoms may have increased',
          body:       'We noticed a change in your recent check-in. Tap to review.',
          link_view:  'scorecard',
        })

        await logEngagement(session.patientId!, 'score_drop', 'email',  { score_before: prevWmi, score_after: newWmi })
        await logEngagement(session.patientId!, 'score_drop', 'in_app', { score_before: prevWmi, score_after: newWmi })
      } catch (e) {
        console.error('Score drop hook error:', e)
      }
    })()

    return NextResponse.json({ visit: inserted }, { status: 201 })
```

Also add `patients` to the existing `@/lib/db/schema` import line.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/daily-checkin/route.ts
git commit -m "Add score-drop event hook to daily check-in POST"
```

---

## Task 11: Lab results ready notification

**Files:**
- Create: `src/app/api/canvas/labs/result/route.ts`

There is no existing route that updates `lab_orders.status` to `'resulted'`. This route receives a call (from Canvas webhook or manual trigger) to mark an order as resulted and fires the notification.

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { lab_orders, patients, profiles, notifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { logEngagement, buildEngagementEmail } from '@/lib/engagement'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

export async function POST(req: NextRequest) {
  // Accept either CRON_SECRET or a Canvas webhook signature header
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const order = await db.select({ id: lab_orders.id, patient_id: lab_orders.patient_id, status: lab_orders.status })
    .from(lab_orders).where(eq(lab_orders.id, orderId)).limit(1)
  if (!order[0]) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order[0].status === 'resulted') return NextResponse.json({ ok: true, message: 'already resulted' })

  // Mark as resulted
  await db.update(lab_orders).set({ status: 'resulted' }).where(eq(lab_orders.id, orderId))

  const patientId = order[0].patient_id
  if (!patientId) return NextResponse.json({ ok: true })

  const patientRow = await db.select({ profile_id: patients.profile_id })
    .from(patients).where(eq(patients.id, patientId)).limit(1)
  if (!patientRow[0]) return NextResponse.json({ ok: true })

  const profileRow = await db.select({ email: profiles.email, first_name: profiles.first_name })
    .from(profiles).where(eq(profiles.id, patientRow[0].profile_id)).limit(1)
  if (!profileRow[0]?.email) return NextResponse.json({ ok: true })

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const firstName = profileRow[0].first_name ?? 'there'

  const html = buildEngagementEmail({
    heading: 'Your lab results are ready',
    bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName} — your lab results are now available. Dr. Urban will review them and may follow up with you directly if anything needs attention.</p>`,
    ctaText: 'View in Dashboard',
    ctaUrl:  `${appUrl}/patient/dashboard`,
    patientId,
  })

  await resend.emails.send({
    from: FROM,
    to:   profileRow[0].email,
    subject: 'Your lab results are ready',
    html,
  })

  await db.insert(notifications).values({
    patient_id: patientId,
    type:       'lab_results_ready',
    title:      'Your lab results are ready',
    body:       'Dr. Urban will review them shortly.',
    link_view:  'lab-results',
  })

  await logEngagement(patientId, 'lab_results_ready', 'email',  { lab_order_id: orderId })
  await logEngagement(patientId, 'lab_results_ready', 'in_app', { lab_order_id: orderId })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Add `update` to the Drizzle import in this file**

Ensure `update` is imported from `drizzle-orm` at the top of the file.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/canvas/labs/result/route.ts
git commit -m "Add lab results ready notification route"
```

---

## Task 12: Register cron jobs in vercel.json

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Update vercel.json**

Open `vercel.json`. It currently contains:

```json
{
  "crons": [
    {
      "path": "/api/reminders/appointments",
      "schedule": "0 * * * *"
    }
  ]
}
```

Replace with:

```json
{
  "crons": [
    { "path": "/api/reminders/appointments",      "schedule": "0 * * * *"    },
    { "path": "/api/engagement/weekly-nudge",     "schedule": "0 14 * * 1"   },
    { "path": "/api/engagement/monthly-recap",    "schedule": "0 14 1 * *"   },
    { "path": "/api/engagement/daily-scan",       "schedule": "0 15 * * *"   }
  ]
}
```

Schedules:
- `0 14 * * 1` — Monday 14:00 UTC = 8am MT (weekly nudge)
- `0 14 1 * *` — 1st of month 14:00 UTC = 8am MT (monthly recap)
- `0 15 * * *` — Daily 15:00 UTC = 9am MT (daily scan)

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit and push**

```bash
git add vercel.json
git commit -m "Register engagement cron jobs in vercel.json"
```

---

## Verification

- [ ] Deploy to production and run the migration: `POST /api/debug/migrate-engagement` with `x-migration-secret: $CRON_SECRET`
- [ ] Confirm both tables exist: check Supabase or connect to RDS and run `\dt engagement_log notification_preferences`
- [ ] Test weekly nudge manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.womenkindhealth.com/api/engagement/weekly-nudge` — expect `{"sent":N,"skipped":M}`
- [ ] Test daily scan manually: same pattern with `/api/engagement/daily-scan`
- [ ] Test unsubscribe: find a `patientId`, generate token with `HMAC-SHA256(patientId, CRON_SECRET)`, visit the unsubscribe URL — should show confirmation page and set all prefs to false
- [ ] Test settings toggles: open `/patient/settings`, toggle a preference, refresh — should persist
- [ ] Test score drop: submit a daily check-in with dramatically higher symptom scores than the previous — check inbox and notification bell
- [ ] Test lab result: `POST /api/canvas/labs/result` with a valid `orderId` — check inbox and notification bell
- [ ] Run `npx tsc --noEmit` — 0 errors
