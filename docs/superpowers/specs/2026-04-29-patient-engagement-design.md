# Patient Engagement System — Design Spec

**Date:** 2026-04-29
**Status:** Ready for implementation

## Problem

Womenkind patients disengage in two patterns: (B) symptoms plateau after a few months and the novelty of tracking fades, and (C) life gets busy, they miss a few check-ins, and the re-entry barrier grows. A concierge service needs a proactive engagement system that acts as the "hand-holding" layer — reaching out before patients drift rather than waiting for them to return.

## Goals

- Keep patients consistently logging weekly check-ins
- Celebrate progress and surface it back to patients
- Respond clinically when scores drop
- Ensure care plan adherence (refills, labs)
- Make re-entry frictionless after a gap

## Out of Scope (v1)

- SMS/text messages (infrastructure not set up — add in v2)
- Provider-triggered manual messages (future)
- Score plateau trigger (C — not selected by user)
- Treatment milestone celebrations (not selected by user)

---

## Trigger Map

### Fixed Cadence — every active patient

| Trigger | Schedule | Channel | Frequency cap |
|---------|----------|---------|---------------|
| Weekly check-in nudge | Monday 8am MT (`0 14 * * 1`) | Email + in-app | 7 days |
| Monthly progress recap | 1st of month 8am MT (`0 14 1 * *`) | Email only | 28 days |

### Behavior-Based — fires on patient activity

| Trigger | When | Channel | Frequency cap |
|---------|------|---------|---------------|
| Score dropped | WMI drops ≥20% on check-in save | Email + in-app | 3 days |
| Post-visit follow-up | 47–71 hrs after provider visit note generated | Email only | 30 days |
| Missed 2+ check-ins | Daily scan: no `source='daily'` visit in 14+ days | Email only | 7 days |
| No login 30+ days | Daily scan: `profiles.last_sign_in_at` > 30 days ago | Email only | 14 days |

### Clinical Reminders — care plan adherence

| Trigger | When | Channel | Frequency cap |
|---------|------|---------|---------------|
| Rx refill due | Daily scan: `prescriptions.runs_out_at` within 7 days, `status='active'` | Email + in-app | 7 days |
| Lab results ready | `lab_orders.status` updated to `'resulted'` | Email + in-app | Per order |

---

## Data Model

### New table: `engagement_log`

```sql
CREATE TABLE engagement_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid        NOT NULL REFERENCES patients(id),
  trigger_type text        NOT NULL,
  channel      text        NOT NULL DEFAULT 'email',  -- 'email' | 'in_app'
  sent_at      timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb       -- { score_before, score_after, medication_name, lab_order_id, etc. }
);

CREATE INDEX ON engagement_log(patient_id, trigger_type, sent_at DESC);
```

`trigger_type` values: `weekly_nudge` · `monthly_recap` · `score_drop` · `post_visit` · `missed_checkins` · `no_login` · `rx_refill` · `lab_results_ready`

### Frequency cap helper (shared utility)

```typescript
// src/lib/engagement.ts
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
      gte(engagement_log.sent_at, cutoff)
    ))
    .limit(1)
  return rows.length > 0
}

export async function logEngagement(
  patientId: string,
  triggerType: string,
  channel: 'email' | 'in_app',
  metadata?: Record<string, unknown>
) {
  await db.insert(engagement_log).values({ patient_id: patientId, trigger_type: triggerType, channel, metadata })
}
```

---

## Infrastructure

### New Vercel cron entries (`vercel.json`)

```json
{ "path": "/api/engagement/weekly-nudge",  "schedule": "0 14 * * 1" },
{ "path": "/api/engagement/monthly-recap", "schedule": "0 14 1 * *" },
{ "path": "/api/engagement/daily-scan",    "schedule": "0 15 * * *" }
```

All routes protected by `Authorization: Bearer ${CRON_SECRET}` (same as `/api/reminders/appointments`).

### New API routes

#### `GET /api/engagement/weekly-nudge`
- Query all active patients
- For each: skip if they've already checked in this week (`visits` with `source='daily'` and `visit_date >= Monday`)
- Skip if `alreadySentRecently(patientId, 'weekly_nudge', 7)`
- Send nudge email + create in-app notification
- Log to `engagement_log`

#### `GET /api/engagement/monthly-recap`
- Query all active patients with at least one check-in ever
- For each: compute WMI at start of month vs. end of month, top improving domain, count of check-in days
- Skip if `alreadySentRecently(patientId, 'monthly_recap', 28)`
- Send recap email (with data inline — no separate API call needed)
- Log to `engagement_log`

#### `GET /api/engagement/daily-scan`
Four checks per patient, all skippable independently:

1. **Missed check-ins** — no `source='daily'` visit in last 14 days AND has at least one historical check-in → send if not sent in 7 days
2. **No login** — `profiles.last_sign_in_at` > 30 days ago → send if not sent in 14 days
3. **Rx refill** — `prescriptions` where `status='active'` AND `runs_out_at` between now and +7 days → send per prescription if not sent in 7 days
4. **Post-visit** — provider visits (`source != 'daily'`) created 47–71 hours ago → send if not sent in 30 days

### Event hooks (additions to existing routes)

#### `POST /api/daily-checkin` — score drop detection
After saving scores and computing WMI, compare to previous check-in WMI:
```typescript
const prevWmi = /* most recent previous check-in's WMI */ 
const newWmi  = computeLiveWMI([newCheckin])
if (prevWmi && newWmi < prevWmi * 0.80) {  // ≥20% drop
  if (!await alreadySentRecently(patientId, 'score_drop', 3)) {
    await sendScoreDropEmail(patient, prevWmi, newWmi)
    await createNotification(patientId, 'score_drop', ...)
    await logEngagement(patientId, 'score_drop', 'email', { score_before: prevWmi, score_after: newWmi })
    await logEngagement(patientId, 'score_drop', 'in_app', { score_before: prevWmi, score_after: newWmi })
  }
}
```

#### Wherever `lab_orders.status` is updated to `'resulted'`
```typescript
if (newStatus === 'resulted') {
  await sendLabResultsReadyEmail(patient)
  await createNotification(patientId, 'lab_results_ready', ...)
  await logEngagement(patientId, 'lab_results_ready', 'email', { lab_order_id: orderId })
  await logEngagement(patientId, 'lab_results_ready', 'in_app', { lab_order_id: orderId })
}
```

---

## Email Templates

All follow existing Resend HTML pattern: beige background (`#f7f3ee`), white card, `#944fed` CTA button, Plus Jakarta Sans font. Inline in each route file.

| Template | Subject line | Key content | Tone |
|----------|-------------|-------------|------|
| `weekly_nudge` | "Your weekly check-in is ready" | One sentence + "Log Check-In" button | Brief, clinical |
| `monthly_recap` | "Your [Month] progress with Womenkind" | WMI trend (start vs. end of month) · top improving domain · days checked in · book follow-up CTA if no upcoming appt | Celebratory, data-rich |
| `score_drop` | "We noticed a change in your symptoms" | Domain(s) that dropped · what it means · "Message Dr. Urban" CTA + "Log a Check-In" CTA | Clinical, actionable |
| `post_visit` | "How are you feeling after your visit?" | Care plan recap (2 sentences) · "Log your first check-in" CTA · "Questions? Message us" secondary CTA | Warm, supportive |
| `missed_checkins` | "We've missed you" | "Life gets busy — we get it" · no guilt · "Jump back in" button | Warm, no guilt |
| `no_login` | "Your care team is still here" | Personal opener · "We haven't gone anywhere" · dashboard CTA | Warmest, personal |
| `rx_refill` | "Time to refill your [Medication]" | Medication name + runs out date · "Request Refill" button (links to refill view) | Action-oriented, clear |
| `lab_results_ready` | "Your lab results are ready" | "Dr. Urban will review and may follow up" · "View in Dashboard" button | Clinical, informative |

---

## In-App Notifications

Uses existing `notifications` table — no schema changes. Four triggers write notification rows in addition to email:

| Trigger | `type` | Title | Body | `link_view` |
|---------|--------|-------|------|-------------|
| Weekly nudge | `checkin_reminder` | "Time for your check-in" | "Log how you're feeling this week — takes 60 seconds." | `scorecard` |
| Score dropped | `score_drop` | "Your symptoms may have increased" | "We noticed a change in your recent check-in. Tap to review." | `scorecard` |
| Rx refill due | `rx_refill_reminder` | "Refill due: [Medication]" | "Your prescription runs out soon. Request a refill now." | `refill` |
| Lab results ready | `lab_results_ready` | "Your lab results are ready" | "Dr. Urban will review them shortly." | `lab-results` |

`lab_results_ready` type already handled by `NotificationBell` — no UI changes needed.
New types (`checkin_reminder`, `score_drop`, `rx_refill_reminder`) need icon entries added to `NotificationBell`.

---

## Files to Create / Modify

**Create:**
- `src/lib/engagement.ts` — `alreadySentRecently()` + `logEngagement()` helpers
- `src/app/api/engagement/weekly-nudge/route.ts`
- `src/app/api/engagement/monthly-recap/route.ts`
- `src/app/api/engagement/daily-scan/route.ts`
- Drizzle migration: `engagement_log` table

**Modify:**
- `vercel.json` — add 3 cron entries
- `src/lib/db/schema.ts` — add `engagement_log` table definition
- `src/app/api/daily-checkin/route.ts` — add score-drop hook
- Wherever `lab_orders.status` is updated — add lab-results-ready hook
- `src/components/patient/NotificationBell.tsx` — add 3 new notification type icons

---

## Drizzle Schema Addition

```typescript
// src/lib/db/schema.ts
export const engagement_log = pgTable('engagement_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  patient_id:   uuid('patient_id').notNull().references(() => patients.id),
  trigger_type: text('trigger_type').notNull(),
  channel:      text('channel').notNull().default('email'),
  sent_at:      timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  metadata:     json('metadata'),
})
```

---

## Definition: "Active Patient"

For all cron scans, an active patient is one who has submitted their intake (status != 'draft') AND has either a completed appointment or at least one daily check-in. Patients who signed up but never completed intake are excluded — they're handled by the existing welcome email flow, not the engagement system.

---

## Key Decisions

- **No separate template engine** — email HTML stays inline in route files, consistent with existing codebase pattern
- **Frequency caps in DB** — checked via `engagement_log` query, not in-memory — survives server restarts and scales to multiple Vercel instances
- **Post-visit uses daily scan** — rather than a delayed job or queue, the daily cron catches visits created 47–71 hours prior. At worst 24hr drift from the ideal 48hr window, acceptable for this use case
- **WMI delta threshold: 20%** — conservative enough to avoid false alarms, aggressive enough to catch real symptom spikes
- **SMS deferred** — engagement_log `channel` column is already typed as text (not an enum) so adding `'sms'` in v2 requires no migration
