# Build 15 — Patient Follow-up & Engagement Engine

## Overview

The Follow-up Engine ensures no patient falls silent after a prescription or lab result. It is a scheduled, event-driven system that fires targeted touchpoints across four trigger types, delivers them via email (Resend) and in-app notifications, and surfaces patient engagement status to providers. The design draws directly from a real gap in telehealth care: patients who receive treatment but never hear from their provider again disengage and drop off — often blaming themselves rather than the system.

The engine is passive from the provider's perspective. Sequences launch automatically on clinical events. Providers only need to act when something goes wrong: a patient flags high symptoms, ignores repeated outreach, or falls outside the expected visit window.

---

## Trigger Types

### 1. After Prescription Sent (`rx_sent`)
**Source:** DoseSpot webhook — `prescription.transmitted`

| Offset | Touchpoint | Channel |
|--------|-----------|---------|
| +3 days | Early check-in: "How is your first week going?" | Email + In-app |
| +7 days | Symptom check-in form prompt | Email + In-app |
| +14 days | Two-week update: any noticeable changes? | Email + In-app |
| +30 days | One-month milestone + book follow-up CTA | Email + In-app |
| +45 days | Appointment gap warning (if no visit booked) | Email + In-app |

### 2. After Lab Results Received (`lab_received`)
**Source:** Health Gorilla delivery (webhook or polling)
**Note:** Patient notification is held until provider marks results as released.

| Offset from release | Touchpoint | Channel |
|---------------------|-----------|---------|
| Day 0 | "Your lab results are ready to review" | Email + In-app |
| +2 days | "Any questions about your results? We're here." | Email + In-app |
| +7 days | Book a follow-up visit to discuss CTA | Email + In-app |

**Abnormal result rule:** If any result value is flagged outside reference range, compress Day +2 to Day +1 and set `flagged = true` on the follow-up record so the provider dashboard surfaces it immediately.

### 3. Periodic Symptom Check-ins (`symptom_checkin`)
**Source:** Cron — fires for any patient with an active prescription

| Schedule | Touchpoint |
|----------|-----------|
| Weeks 2, 4, 6, 8, 10, 12 post-Rx | Symptom form: 5-question rating + free text |
| Monthly thereafter (while on treatment) | Same form, abbreviated label |

**Adaptive rule:** If any symptom score ≥ 8/10, or any score worsens by more than 2 points from the previous check-in, set `flagged = true`, notify provider, and schedule the next check-in at 1 week instead of the standard interval.

**Symptom questions (stored as JSONB):**
- Hot flash frequency and intensity (0–10)
- Sleep quality (0–10)
- Mood and emotional steadiness (0–10)
- Energy level (0–10)
- Pain or physical discomfort (0–10)
- Free text: "Anything else you want your provider to know?"

### 4. Appointment Gap (`appointment_gap`)
**Source:** Daily cron — scans all active patients by last appointment date

| Days since last visit | Touchpoint | Action |
|-----------------------|-----------|--------|
| 45 days | Gentle nudge: "It's been a while — how are you feeling?" | Email + In-app |
| 60 days | Stronger re-engagement + prominent book-a-visit button | Email + In-app |
| 90 days | Mark patient as `at_risk` in provider dashboard | Provider alert + Email |

---

## State Machine

Each follow-up record moves through the following states:

```
pending → sent → completed   (patient took action: submitted check-in or booked visit)
pending → sent → expired     (7 days passed with no patient response — move to next in sequence)
pending → cancelled          (patient proactively booked or provider dismissed)
pending → skipped            (provider manually dismissed)
```

**Auto-cancellation rules:**
- Patient books an appointment → cancel all pending `appointment_gap` follow-ups for that patient
- Patient submits a check-in → mark that `symptom_checkin` touchpoint as `completed`
- Patient completes a check-in early → compress remaining sequence window accordingly

---

## Database Schema

### `patient_follow_ups`

```sql
create table patient_follow_ups (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references auth.users(id) on delete cascade,
  provider_id     uuid not null references auth.users(id),
  trigger_type    text not null check (trigger_type in ('rx_sent', 'lab_received', 'symptom_checkin', 'appointment_gap')),
  trigger_ref_id  uuid,                          -- prescription ID, lab result ID, etc.
  touchpoint_num  int not null default 1,        -- position in the sequence (1, 2, 3...)
  scheduled_at    timestamptz not null,
  sent_at         timestamptz,
  status          text not null default 'pending'
                  check (status in ('pending', 'sent', 'completed', 'expired', 'cancelled', 'skipped')),
  channel         text not null default 'both'
                  check (channel in ('email', 'in_app', 'both')),
  flagged         boolean not null default false, -- high-severity flag for provider queue
  metadata        jsonb default '{}',            -- email template key, sequence config, etc.
  created_at      timestamptz default now()
);

create index idx_follow_ups_scheduled on patient_follow_ups (scheduled_at) where status = 'pending';
create index idx_follow_ups_patient on patient_follow_ups (patient_id, status);
create index idx_follow_ups_flagged on patient_follow_ups (flagged) where flagged = true;
```

### `patient_check_ins`

```sql
create table patient_check_ins (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references auth.users(id) on delete cascade,
  follow_up_id     uuid references patient_follow_ups(id),
  check_in_type    text not null check (check_in_type in ('post_rx', 'post_lab', 'periodic', 'appointment_gap')),
  responses        jsonb not null default '{}',  -- { hot_flash: 4, sleep: 7, mood: 6, energy: 5, pain: 2, notes: "..." }
  symptom_score    int,                          -- computed average for trending
  flagged          boolean not null default false,
  submitted_at     timestamptz default now(),
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz
);

create index idx_check_ins_patient on patient_check_ins (patient_id, submitted_at desc);
create index idx_check_ins_flagged on patient_check_ins (flagged) where flagged = true;
```

### `patient_engagement_summary` (view)

```sql
create or replace view patient_engagement_summary as
select
  p.id as patient_id,
  p.full_name,
  max(a.start_time) as last_appointment_at,
  now() - max(a.start_time) as days_since_visit,
  count(f.id) filter (where f.status = 'pending') as pending_follow_ups,
  count(f.id) filter (where f.flagged = true and f.status != 'cancelled') as flagged_items,
  max(ci.submitted_at) as last_check_in_at,
  avg(ci.symptom_score) filter (where ci.submitted_at > now() - interval '30 days') as avg_symptom_score_30d,
  case
    when now() - max(a.start_time) > interval '90 days' then 'at_risk'
    when count(f.id) filter (where f.flagged = true and f.status != 'cancelled') > 0 then 'needs_attention'
    when count(f.id) filter (where f.status = 'pending') > 2 then 'overdue'
    else 'on_track'
  end as engagement_status
from profiles p
left join appointments a on a.patient_id = p.id and a.status = 'completed'
left join patient_follow_ups f on f.patient_id = p.id
left join patient_check_ins ci on ci.patient_id = p.id
where p.role = 'patient'
group by p.id, p.full_name;
```

### RLS Policies

```sql
-- Patients can read their own follow-ups
alter table patient_follow_ups enable row level security;
create policy "patient read own" on patient_follow_ups
  for select using (auth.uid() = patient_id);

-- Providers can read/write follow-ups for their patients
create policy "provider manage" on patient_follow_ups
  for all using (auth.uid() = provider_id);

-- Service role bypasses RLS (used by edge functions)

alter table patient_check_ins enable row level security;
create policy "patient read own check-ins" on patient_check_ins
  for select using (auth.uid() = patient_id);
create policy "patient submit check-in" on patient_check_ins
  for insert with check (auth.uid() = patient_id);
create policy "provider read check-ins" on patient_check_ins
  for select using (
    exists (
      select 1 from patient_follow_ups f
      where f.id = follow_up_id and f.provider_id = auth.uid()
    )
  );
```

---

## Edge Functions

### `process-follow-ups` (cron — every hour)

Runs on a pg_cron schedule. Fetches all `pending` follow-ups where `scheduled_at <= now()`, sends the appropriate email via Resend, creates an in-app notification, and marks the record as `sent`.

```typescript
// supabase/functions/process-follow-ups/index.ts
// Triggered by pg_cron: select cron.schedule('process-follow-ups', '0 * * * *', ...)

const due = await supabase
  .from('patient_follow_ups')
  .select('*, profiles!patient_id(email, full_name)')
  .eq('status', 'pending')
  .lte('scheduled_at', new Date().toISOString())
  .limit(100);

for (const followUp of due.data) {
  await sendFollowUpEmail(followUp);        // Resend
  await createInAppNotification(followUp); // insert into notifications table
  await supabase
    .from('patient_follow_ups')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', followUp.id);
}
```

### `detect-appointment-gaps` (cron — daily at 8am)

```typescript
// Finds patients whose last completed appointment was 45, 60, or 90 days ago
// and schedules the appropriate gap follow-up if one doesn't already exist
```

### `schedule-follow-up-sequence` (called internally)

Utility function that accepts a trigger type + trigger ref ID and inserts the full sequence into `patient_follow_ups`.

```typescript
export async function scheduleFollowUpSequence({
  patientId,
  providerId,
  triggerType,
  triggerRefId,
  startAt = new Date(),
}: ScheduleFollowUpParams) {
  const sequence = SEQUENCES[triggerType]; // defined below
  const records = sequence.map((step, i) => ({
    patient_id: patientId,
    provider_id: providerId,
    trigger_type: triggerType,
    trigger_ref_id: triggerRefId,
    touchpoint_num: i + 1,
    scheduled_at: addDays(startAt, step.offsetDays).toISOString(),
    metadata: { template: step.template },
  }));
  await supabase.from('patient_follow_ups').insert(records);
}

const SEQUENCES = {
  rx_sent: [
    { offsetDays: 3,  template: 'rx_early_checkin' },
    { offsetDays: 7,  template: 'rx_symptom_form' },
    { offsetDays: 14, template: 'rx_two_week' },
    { offsetDays: 30, template: 'rx_one_month' },
    { offsetDays: 45, template: 'appointment_gap_gentle' },
  ],
  lab_received: [
    { offsetDays: 0, template: 'lab_results_ready' },
    { offsetDays: 2, template: 'lab_any_questions' },
    { offsetDays: 7, template: 'lab_book_followup' },
  ],
  appointment_gap: [
    { offsetDays: 0,  template: 'gap_45_gentle' },
    { offsetDays: 15, template: 'gap_60_nudge' },
    { offsetDays: 45, template: 'gap_90_at_risk' },
  ],
};
```

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/follow-ups/schedule` | Called by DoseSpot/Health Gorilla webhooks — creates sequence |
| GET | `/api/follow-ups/patient/[id]` | Provider: full follow-up history for a patient |
| PATCH | `/api/follow-ups/[id]/cancel` | Cancel a specific pending follow-up |
| PATCH | `/api/follow-ups/patient/[id]/cancel-all` | Cancel all pending follow-ups of a given trigger type |
| POST | `/api/check-ins/submit` | Patient submits a symptom check-in |
| GET | `/api/check-ins/[patientId]` | Provider: all check-in history for a patient |
| GET | `/api/check-ins/pending` | Patient: any pending check-in prompts |

### Webhook hook additions

**DoseSpot prescription transmitted:**
```typescript
// In existing DoseSpot webhook handler
if (event.type === 'prescription.transmitted') {
  await scheduleFollowUpSequence({
    patientId: event.patientId,
    providerId: event.prescriberId,
    triggerType: 'rx_sent',
    triggerRefId: event.prescriptionId,
  });
}
```

**Health Gorilla lab result released:**
```typescript
// Called when provider clicks "Release results to patient" in the lab review UI
await scheduleFollowUpSequence({
  patientId,
  providerId,
  triggerType: 'lab_received',
  triggerRefId: labResultId,
  startAt: new Date(), // starts immediately on release
});
```

---

## Email Templates (Resend)

All emails: clean text, no emojis, WomenKind brand font, violet accent CTA buttons.

### `rx_early_checkin` — Day 3 post-prescription
**Subject:** Checking in on your first few days

> Hi [Name],
>
> It's been a few days since your prescription was sent to the pharmacy. We want to make sure things are going smoothly.
>
> If you have any questions about your medication, side effects, or anything else, your provider is available to help.
>
> [How are you feeling? — link to check-in form]
>
> The WomenKind team

### `rx_symptom_form` — Day 7 post-prescription
**Subject:** A quick check-in from your care team

> Hi [Name],
>
> One week in. This is a good moment to take stock of how your body is responding.
>
> Your provider has set up a short symptom check-in — it takes about two minutes and helps us track how treatment is working for you specifically.
>
> [Complete your check-in — link]
>
> The WomenKind team

### `rx_two_week` — Day 14 post-prescription
**Subject:** Two weeks in — how are you feeling?

> Hi [Name],
>
> Two weeks on your treatment plan is a meaningful milestone. Some patients notice changes by now; others take a bit longer. Both are normal.
>
> Let your provider know where things stand.
>
> [Share your update — link to check-in form]
>
> The WomenKind team

### `rx_one_month` — Day 30 post-prescription
**Subject:** One month in — time for a follow-up

> Hi [Name],
>
> You've been on your treatment plan for a month. This is the right time to review how things are going with your provider and make any adjustments.
>
> [Book your follow-up visit — link to scheduling]
>
> The WomenKind team

### `lab_results_ready` — Day 0 (results released)
**Subject:** Your lab results are ready

> Hi [Name],
>
> Your provider has reviewed your recent lab results and they are now available for you to see.
>
> [View your results — link to lab results page]
>
> If you have questions, you can message your provider directly or schedule a visit to discuss.
>
> The WomenKind team

### `lab_any_questions` — Day 2 post-release
**Subject:** Any questions about your results?

> Hi [Name],
>
> We wanted to check in to see if you had a chance to review your lab results.
>
> Lab results can sometimes raise more questions than answers. Your provider is here to help you understand what they mean for your care.
>
> [Message your provider — link] or [Book a visit — link]
>
> The WomenKind team

### `gap_45_gentle` — 45 days since last visit
**Subject:** We haven't seen you in a while

> Hi [Name],
>
> It's been about six weeks since your last visit with your WomenKind provider. We want to make sure you're feeling supported.
>
> If now is a good time, booking a check-in is easy.
>
> [Schedule a visit — link]
>
> The WomenKind team

### `gap_60_nudge` — 60 days since last visit
**Subject:** Your care team is thinking of you

> Hi [Name],
>
> Managing menopause well means staying in touch with your care team, even when things feel stable. It's been a couple of months since your last visit.
>
> We'd love to hear how you've been. A follow-up visit helps your provider make sure your treatment is still working as well as it can.
>
> [Book your visit — link]
>
> The WomenKind team

### `gap_90_at_risk` — 90 days since last visit
**Subject:** A note from your WomenKind provider

> Hi [Name],
>
> [Provider name] wanted to personally reach out. It has been a while since we've connected, and we want to make sure you're doing well.
>
> There's no pressure — but we do want you to know that your care team is here and your health matters to us.
>
> [Schedule a visit — link] or reply to this email with any questions.
>
> [Provider name]  
> WomenKind

---

## Patient-Facing UI

### Dashboard: Follow-up Card
A card shown on the patient dashboard when there are pending follow-up items.

```
┌─────────────────────────────────────────┐
│  Your care team wants to hear from you  │
│                                         │
│  You have a quick check-in waiting.     │
│  It takes about 2 minutes.              │
│                                         │
│  [Complete check-in]                    │
└─────────────────────────────────────────┘
```

- Only shown when there is an active `sent` follow-up with no patient response
- Dismissed when patient submits a check-in or the follow-up expires
- Styled per light theme prefs: minimal container, violet accent button

### Symptom Check-in Form (`/dashboard/check-in/[followUpId]`)
- 5 slider inputs (0–10) with label anchors ("None" → "Severe")
- Free text textarea: "Anything else your provider should know?"
- Submit button: "Send to my provider"
- On submit: POST `/api/check-ins/submit`, mark follow-up as `completed`, show confirmation

### Notification Bell
- Badged when there are pending follow-up items
- Dropdown shows: "Your lab results are ready", "Check-in from your care team", etc.
- Each item is a link to the relevant action (results page, check-in form, scheduling)

---

## Provider-Facing UI

### Patient List: Engagement Status Column
New column in the patient list table showing engagement badge:

| Status | Badge | Meaning |
|--------|-------|---------|
| `on_track` | Green dot | Active, recent visit, no flags |
| `needs_attention` | Orange dot | Flagged check-in or abnormal lab with no response |
| `overdue` | Yellow dot | 2+ pending follow-ups with no response |
| `at_risk` | Red dot | 90+ days since last visit |

### Patient Detail: Engagement Tab
New tab on the patient detail page alongside "Appointments", "Messages", "Labs".

Sections:
- **Follow-up Timeline** — chronological list of all sent/pending touchpoints with status icons
- **Check-in History** — each submitted check-in with symptom scores, trend sparkline, free text
- **Symptom Trend Chart** — line chart of each symptom dimension over time (recharts)
- **Provider Actions** — "Cancel pending follow-ups", "Send a message", "Schedule a visit"

### Provider Dashboard: Flagged Items Panel
A panel on the main provider dashboard (not per-patient) showing:
- Patients with flagged check-ins awaiting review
- Patients marked `at_risk`
- Abnormal lab results awaiting discussion

---

## Implementation Order

1. **Migration** — `patient_follow_ups`, `patient_check_ins`, `patient_engagement_summary` view, RLS policies
2. **`scheduleFollowUpSequence` utility** — core scheduling logic, `SEQUENCES` config
3. **DoseSpot webhook extension** — call scheduler on `prescription.transmitted`
4. **Health Gorilla release hook** — call scheduler when provider releases results
5. **`process-follow-ups` Edge Function** — cron, Resend send, in-app notification insert
6. **`detect-appointment-gaps` Edge Function** — daily cron, gap detection, scheduler call
7. **Resend email templates** — all 8 templates registered in Resend, tested
8. **In-app notification system** — `notifications` table (if not already present), bell component
9. **Patient check-in form** — `/dashboard/check-in/[followUpId]` route + submit API
10. **Patient dashboard card** — follow-up prompt card, conditional render
11. **Provider engagement tab** — follow-up timeline, check-in history, symptom chart
12. **Provider dashboard flagged panel** — `at_risk` and flagged items surface

---

## Notes for Dr. Urban Review

- The symptom questions are menopause-specific but the schema is general enough to support other specialties later.
- The "90-day at risk" email is framed as coming personally from the provider (not the platform) — this personalizes re-engagement at the highest-stakes moment and aligns with how Dr. Urban communicates.
- The adaptive check-in logic (compress interval when symptoms worsen) should be reviewed with Dr. Urban to confirm the threshold (currently ≥ 8/10 or Δ > 2) makes clinical sense.
- All sequences can be configured per-patient or per-protocol in `metadata` if different treatment types warrant different cadences (e.g., HRT vs. supplements).
