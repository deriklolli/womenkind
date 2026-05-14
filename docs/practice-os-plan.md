# Practice OS Plan — Builds 16–19

**Created:** 2026-05-13  
**Updated:** 2026-05-13 — gaps from Dr. Urban's spec incorporated  
**Author:** Planning pass — do not execute without review

---

## Codebase Baseline (read before executing any build)

| Item | Current state |
|---|---|
| Auth | `getServerSession()` returns `role: 'patient' \| 'provider' \| 'unknown'` — binary |
| `providers` table | `id, profile_id, is_active` — no role column |
| Tasks | No `tasks` table exists |
| Audit | `phi_access_log` exists (`provider_id, patient_id, record_type, record_id, action, api_route, ip_address, user_agent, created_at`) — provider-only, no staff roles |
| Notifications | `notifications` table is patient-facing only |
| Prescriptions | No `prescription_changes` tracking table |
| Patients | No `last_md_review_at` column |
| Auth file | `src/lib/getServerSession.ts` — single file, clean to extend |
| Schema file | `src/lib/db/schema.ts` — single file, all tables |

---

## Regulatory Flag — Read Before Building AI Features

The doctor's spec contains a line under "Not Allowed" that reads:
> *"Make independent diagnosis — but give tentative diagnosis and reasoning with possible plan with options"*

That qualifier ("but give tentative diagnosis") makes it allowed, not prohibited. **AI output that says "this patient's bleeding is consistent with endometrial hyperplasia, consider biopsy" — even labeled tentative — is a regulated medical device under FDA's Software as a Medical Device (SaMD) framework.** This is the mechanism by which platforms like this attract enforcement or get forced into expensive regulatory pathways.

**The safe design:** AI surfaces clinical *facts and context*, not clinical *impressions*. Instead of "likely hyperplasia," the AI says: "New postmenopausal bleeding + systemic estrogen + intact uterus + uncertain P4 adherence — practice protocol for this pattern requires [checklist]." The protocol checklist is physician-authored and versioned. The AI routes to it; it does not generate the clinical reasoning itself.

This achieves the same workflow efficiency — the doctor sees the relevant context and a structured next-steps checklist — without the platform generating diagnoses. **All Build 18 AI action plans must follow this framing.**

Similarly: SMART on FHIR is not applicable here. FHIR is an interoperability layer for connecting to external EHRs (Epic, Cerner). WomenKind *is* the EHR. FHIR becomes relevant if we later connect to an external lab system or hospital record — not for internal platform data. The plan correctly defers it.

---

## What We Are NOT Building in Builds 16–19 (and Why)

| Deferred feature | Reason |
|---|---|
| SMART on FHIR / FHIR resource mapping | WomenKind is the EHR; FHIR interoperability targets external systems we don't yet connect to |
| Versioned clinical reference layer | Single physician; physician-authored protocol checklists (Build 18) cover this without a full reference CMS |
| AI-generated diagnoses or clinical impressions | FDA SaMD classification risk; liability exposure; replaced by protocol checklists (see Regulatory Flag above) |
| AI autonomous closure of clinical tasks | Staff must always be in the loop |
| Outcomes analytics dashboard (CSAT, NPS, retention) | Insufficient data volume at launch; revisit after 6–12 months of real multi-staff usage |
| 12-tab provider dashboard | Cognitive overload; role-based task queues surface the right items automatically — no tab-picking required |
| AI-suggested medication changes | Squarely in SaMD territory; deferred indefinitely |
| Service Recovery dashboard | Deferred to Build 19 — named on the roadmap, not dropped |

---

## Build 16 — Practice OS Foundation

### Goal

Zero unassigned actionable items. Multi-staff auth, closed-loop task engine, structured RN workflow, role-appropriate dashboards, and a full audit trail.

---

### Data Model Changes

#### 1. Add `role` to `providers` table

```sql
ALTER TABLE providers
  ADD COLUMN role text NOT NULL DEFAULT 'md',
  ADD COLUMN display_name text,
  ADD COLUMN specialty text;
-- Valid roles: 'md' | 'np' | 'rn' | 'ma' | 'admin' | 'concierge'
```

Drizzle schema change in `src/lib/db/schema.ts`:
```ts
export const providers = pgTable('providers', {
  id:           uuid('id').primaryKey().defaultRandom(),
  profile_id:   uuid('profile_id').notNull().references(() => profiles.id),
  role:         text('role').notNull().default('md'),
  display_name: text('display_name'),
  specialty:    text('specialty'),
  is_active:    boolean('is_active').notNull().default(true),
  created_at:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

#### 2. New `tasks` table

```sql
CREATE TABLE tasks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            uuid NOT NULL REFERENCES patients(id),
  title                 text NOT NULL,
  body                  text,
  category              text NOT NULL,
    -- clinical | lab | med | message | rn_escalation | service | admin | unable_to_reach
  priority              text NOT NULL,
    -- red | orange | yellow | blue | gray
  status                text NOT NULL DEFAULT 'new',
    -- new | acknowledged | in_progress | waiting_patient | waiting_md | waiting_lab | resolved | closed
  owner_staff_id        uuid REFERENCES providers(id),
  backup_owner_staff_id uuid REFERENCES providers(id),
    -- REQUIRED (enforced at API) when priority = 'red' or 'orange'
  source                text NOT NULL,
    -- patient_message | lab_result | score_drop | refill_window | missed_checkin
    -- | post_visit | ai_brief | manual | med_change | unable_to_reach | rn_note
  source_ref            text,
  message_category      text,
    -- only set when source = 'patient_message':
    -- clinical_update | red_flag | side_effect | dose_question | adherence | pharmacy | frustration | life_event
  due_at                timestamp WITH TIME ZONE,
  acknowledged_at       timestamp WITH TIME ZONE,
  acknowledged_by       uuid REFERENCES providers(id),
  closed_at             timestamp WITH TIME ZONE,
  closed_by             uuid REFERENCES providers(id),
  -- structured close-out fields (all required on close):
  closeout_what_was_done    text,
  closeout_plan             text,
  closeout_followup_who     uuid REFERENCES providers(id),
  closeout_followup_when    timestamp WITH TIME ZONE,
  closeout_followup_how     text,   -- text | email | call | portal_message
  closeout_safety_open      boolean DEFAULT false,
  follow_up_task_id         uuid REFERENCES tasks(id),
  requires_md_signoff   boolean NOT NULL DEFAULT false,
  patient_notified      boolean NOT NULL DEFAULT false,
  -- unable-to-reach escalation:
  contact_attempts      integer NOT NULL DEFAULT 0,
  last_contact_attempt  timestamp WITH TIME ZONE,
  created_at            timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at            timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX tasks_patient_id_idx ON tasks(patient_id);
CREATE INDEX tasks_owner_staff_id_idx ON tasks(owner_staff_id);
CREATE INDEX tasks_status_priority_idx ON tasks(status, priority);
CREATE INDEX tasks_due_at_idx ON tasks(due_at) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX tasks_message_category_idx ON tasks(message_category) WHERE message_category IS NOT NULL;
```

**Status transition rules (enforced at API layer):**
- `new → acknowledged | in_progress` (any staff)
- `acknowledged → in_progress | waiting_patient | waiting_md | waiting_lab`
- `in_progress → waiting_patient | waiting_md | waiting_lab | resolved`
- `waiting_* → in_progress | resolved`
- `resolved → closed` — requires all `closeout_*` fields populated; if `requires_md_signoff = true`, `closed_by` must have `role = 'md'`
- No direct `new → closed` or `new → resolved`

**Hard rules (all enforced at API layer — not optional):**

| Rule | Enforcement |
|---|---|
| Red task cannot close without MD acknowledgment | `closed_by` must have `role = 'md'`; API rejects otherwise |
| Orange task requires acknowledgment from MD or backup owner before moving to in_progress | `acknowledged_by` must be MD or `backup_owner_staff_id`; API rejects otherwise |
| Any overdue red task escalates immediately | Nightly cron + real-time check on task list load |
| Any unassigned task (owner_staff_id IS NULL after 4h) is a system error | Housekeeping cron creates escalation admin task |
| Task with `closeout_safety_open = true` cannot move to closed | API rejects with "safety issue still open" |
| Patient message task with `patient_notified = false` cannot resolve | API rejects with "patient must be notified before archiving" |
| Close-out note required | All `closeout_*` fields required on `resolved → closed` transition |
| Follow-up task or explicit "no follow-up needed" attestation required | `follow_up_task_id IS NOT NULL` OR `closeout_no_followup_reason` text must be present |

**Backup owner rule (enforced at API layer):**
- `priority = 'red'` or `priority = 'orange'` → `backup_owner_staff_id` must not be null. API returns 400 if missing.

#### 3. New `audit_events` table

Extends and supersedes `phi_access_log` for Build 16+. Keep existing `phi_access_log` writes intact.

```sql
CREATE TABLE audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  staff_id      uuid REFERENCES providers(id),
  patient_id    uuid REFERENCES patients(id),
  action        text NOT NULL,
    -- VIEW_PATIENT | VIEW_LAB | TASK_CREATED | TASK_ACKNOWLEDGED | TASK_CLOSED
    -- | MESSAGE_SENT | PRESCRIPTION_CHANGED | RN_NOTE_CREATED | CONTACT_ATTEMPTED | etc.
  resource_type text NOT NULL,
  resource_id   text,
  metadata      jsonb,
  ip            text,
  user_agent    text,
  created_at    timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_patient_id_idx ON audit_events(patient_id);
CREATE INDEX audit_events_staff_id_idx ON audit_events(staff_id);
CREATE INDEX audit_events_created_at_idx ON audit_events(created_at DESC);
```

---

### `getServerSession()` Changes

File: `src/lib/getServerSession.ts`

```ts
export interface ServerSession {
  userId: string
  patientId: string | null
  providerId: string | null
  role: 'patient' | 'provider' | 'unknown'
  staffRole: 'md' | 'np' | 'rn' | 'ma' | 'admin' | 'concierge' | null
}
```

Dev bypass returns `staffRole: 'md'`. Create `src/lib/requireStaffRole.ts` — returns 403 if session role is not in the allowed set.

---

### API Routes (New + Modified)

#### New routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/provider/tasks` | any staff | List tasks; query params: `patientId`, `status`, `priority`, `category`, `assignedToMe`, `queue` |
| POST | `/api/provider/tasks` | any staff | Create task manually; enforces backup owner on red/orange |
| PATCH | `/api/provider/tasks/[id]` | any staff | Update status / assign / acknowledge / close; enforces transition rules and structured close-out |
| POST | `/api/provider/tasks/[id]/contact-attempt` | any staff | Log an "unable to reach" attempt; increments `contact_attempts`, sets `last_contact_attempt`, creates escalation task after 3 failed attempts |
| GET | `/api/provider/today` | md, np | MD Today: red tasks + MD decisions + labs pending + RN escalations + Outcomes Watch |
| GET | `/api/staff/rn-queue` | rn, np | RN queue: orange + yellow + unable-to-reach tasks |
| GET | `/api/staff/admin-queue` | admin, concierge | Admin queue: blue + gray + service tasks |
| POST | `/api/staff/escalate` | rn, ma | SBAR form → orange/red task assigned to MD |
| POST | `/api/staff/rn-note` | rn, ma | RN note with disposition button; routes to correct task type |
| GET | `/api/audit/events` | md, admin | Paginated audit log |

#### RN note disposition routing

The `POST /api/staff/rn-note` body includes a `disposition` field:

| `disposition` value | System action |
|---|---|
| `fyi` | Adds `audit_events` timeline entry; no task created |
| `patient_contacted` | Adds communication log entry; creates yellow follow-up task |
| `needs_md_review` | Creates orange task assigned to MD |
| `same_day_md_review` | Creates red task assigned to MD; backup owner required |
| `unable_to_reach` | Creates `unable_to_reach` category task; first attempt logged |
| `resolved_by_protocol` | Requires `protocol_name` + `closeout_what_was_done`; closes inline |
| `service_issue` | Creates blue admin/concierge task |

#### Message triage categorization

`POST /api/provider/tasks` when `source = 'patient_message'` must include `message_category`. If not provided by the creating handler, default to `clinical_update`. Category drives default priority:

| `message_category` | Default priority | Default owner role |
|---|---|---|
| `red_flag` | red | md |
| `clinical_update` | orange | rn |
| `side_effect` | orange | rn |
| `dose_question` | orange | md |
| `adherence` | yellow | rn |
| `pharmacy` | yellow | admin |
| `frustration` | yellow | concierge |
| `life_event` | gray | rn |

#### Modified routes (add role check + audit event + task creation)

| Path | Change |
|---|---|
| All `/api/provider/*` routes | Add `requireStaffRole()` guard |
| `POST /api/canvas/labs/result` | Create lab review task (orange, requires_md_signoff=true) |
| `POST /api/daily-checkin` | Create red clinical task on score drop |
| `GET /api/engagement/weekly-nudge` | Create yellow missed-checkin task alongside email |
| `GET /api/engagement/daily-scan` | Each scan type creates appropriately categorized task |
| `POST /api/messages` (inbound) | Categorize message → create task with `message_category` set |

**Message archiving rule:** a patient message task cannot move to `resolved` while `patient_notified = false` and `message_category` is not `life_event` or `gray`. API returns 400 with "clinical question must be resolved and patient response sent before archiving."

**De-duplication rule:** before creating any cron-sourced task, check for an open task with the same `patient_id + source + source_ref` to avoid duplicate tasks when cron fires multiple times.

---

### UI Surfaces

#### Top Command Bar (MD Today page)

Nine tiles, visible on load. Color + icon + text — never color alone.

| Tile | Priority | Click opens |
|---|---|---|
| 🔴 Red MD Today | red | Red patient queue |
| 🟠 MD Decisions Due | orange | MD decision queue |
| 🟣 RN Escalations | orange | SBAR queue |
| 🧪 Labs Not Reviewed | orange | Lab review queue |
| 💊 Med Change Follow-Up | blue | 0–12 week med tracker |
| ⏰ Overdue Follow-Ups | any | Overdue queue |
| 💬 Messages > SLA | orange/yellow | Message risk queue |
| 📈 Outcomes Watch | varies | Worsening trend queue |
| 🤍 Service Recovery | blue/gray | Deferred to Build 19 — tile present but links to "coming soon" |

#### New pages

**`/provider/today`** — MD Today
- Top Command Bar (9 tiles)
- Patient Priority Queue: sortable by priority, never alphabetical by default. Columns: priority badge, patient name, why flagged, owner, status, due, last touched, action button.
- Task rows: color-coded left border by priority; "Acknowledge" button; status dropdown; "Close" button opens `TaskCloseModal`

**`/staff/rn-queue`** — RN Queue
- Same `TaskQueue` component, filtered to rn-relevant categories + unable_to_reach
- RN note composition area with disposition buttons
- SBAR escalation button opens `SbarModal`

**`/staff/admin-queue`** — Admin / Concierge Queue
- TaskQueue filtered to service/admin/pharmacy categories

#### New components

**`TaskQueue`** (`src/components/staff/TaskQueue.tsx`)
- Sortable list, color-coded by priority
- Each row: priority badge (color + icon + text), patient name, title, due date, owner initials, last-touched timestamp, action buttons

**`TaskCloseModal`** (`src/components/staff/TaskCloseModal.tsx`)

Structured close-out — all fields required before save:
1. What was done (text)
2. Plan going forward (text)
3. Follow-up: who (staff picker), when (date/time), how (text / email / call / portal message)
4. Patient notified? (toggle)
5. Safety issue still open? (toggle — if yes, cannot close)
6. Create follow-up task? (toggle — if yes, pre-populates a new task with follow-up details)
7. Close-out note summary (text)

If `requires_md_signoff` and current user is not MD → shows "Escalate to MD for sign-off" instead of Close.

**`SbarModal`** (`src/components/staff/SbarModal.tsx`)
- Four text areas: Situation / Background / Assessment / Recommendation
- Priority selector (orange = urgent, red = emergency)
- Backup owner selector (required for both orange and red)

**`RnNoteComposer`** (`src/components/staff/RnNoteComposer.tsx`)
- Note text area
- 7 disposition buttons (FYI / Patient Contacted / Needs MD Review / Same-Day MD Review / Unable to Reach / Resolved by Protocol / Service Issue)
- Each button label makes the outcome obvious before clicking
- "Unable to Reach" opens a sub-form: contact method attempted, next attempt scheduled, auto-creates escalation after 3 attempts

**`OutcomesWatchQueue`** (`src/components/staff/OutcomesWatchQueue.tsx`)
- Pulls patients with WMI delta < −20% over last 4 weeks OR no check-in improvement after 8+ weeks on current meds
- Data comes from existing score-drop detection + PillarTrend data; no new backend logic needed
- Links to Patient Cockpit for each flagged patient

#### Modified components

**Provider nav** — role-conditional links; unacknowledged task count badge per role

---

### Integration Points with Existing Systems

| Existing system | Integration |
|---|---|
| `POST /api/daily-checkin` score-drop | Also INSERT red clinical task |
| `GET /api/engagement/daily-scan` | Each scan type creates task alongside email send |
| `POST /api/canvas/labs/result` | Also INSERT lab review task |
| `phi_access_log` | Keep existing writes; new writes go to `audit_events` |
| `engagement_log` | Check before creating cron-sourced tasks to avoid duplicates |

---

### Build 16 Execution Sequencing

Build 16 must be executed in this order to avoid a situation that looks good in a demo but fails in production. Do not start UI work until week 2 is complete.

| Week | Work | Gate to next phase |
|---|---|---|
| 1 | Schema migrations: `providers.role`, `tasks`, `audit_events`. Run against prod RDS before any code ships. | Migration applied, `tsc --noEmit` passes |
| 2 | Auth refactor: extend `getServerSession()`, add `requireStaffRole()`, update every `/api/provider/*` route guard. | All provider routes tested with role-restricted sessions |
| 3 | Task engine API: POST/PATCH `/api/provider/tasks` with state machine, backup-owner enforcement, structured close-out. Extend existing event handlers to fan into tasks. | Task creation + transition rules verified end-to-end |
| 4 | RN note composer + disposition routing. Message triage by category. `SbarModal`. | All 7 dispositions verified; message categories route correctly |
| 5 | Dashboard pages: MD Today (command bar + patient priority queue), RN Queue, Admin Queue. `TaskQueue`, `TaskCloseModal`, `OutcomesWatchQueue`. | Role-based dashboards load correctly for each staff role |

### Testing / Verification Checklist

- [ ] `tsc --noEmit` passes after schema and session changes
- [ ] Create RN user; verify `/api/provider/today` returns 403, `/api/staff/rn-queue` returns 200
- [ ] Attempt to create a red task with no backup owner; verify API returns 400
- [ ] Trigger score drop; verify red task created with `requires_md_signoff = true`
- [ ] POST lab result; verify orange lab review task created
- [ ] Attempt to close red task without acknowledging; verify 400
- [ ] Attempt to close `requires_md_signoff` task as RN; verify 403
- [ ] Submit SBAR; verify task created + audit_events row written
- [ ] Submit RN note with each of the 7 dispositions; verify correct task type / routing for each
- [ ] Log 3 "unable to reach" contact attempts; verify escalation task auto-created
- [ ] Inbound patient message with `message_category = 'red_flag'`; verify red task assigned to MD
- [ ] Attempt to resolve a message task with `patient_notified = false`; verify 400
- [ ] All `/api/provider/*` routes return 403 for patient session

### Time Estimate

**4–5 weeks** — Structured close-out, RN disposition buttons, and message categorization add scope beyond the original estimate.

---

## Build 17 — Patient Cockpit + Medication Change Tracker

### Goal

Physician understands any patient in under 60 seconds. Medication changes auto-generate the full follow-up cadence as tasks. Engagement crons become visible work items.

---

### Data Model Changes

#### 1. Add columns to `patients` table

```sql
ALTER TABLE patients
  ADD COLUMN last_md_review_at timestamp WITH TIME ZONE,
  ADD COLUMN last_meaningful_touch_at timestamp WITH TIME ZONE,
  ADD COLUMN current_plan text,
  ADD COLUMN next_step text;
  -- next_step = null means "no current action needed"
```

`last_md_review_at`: set when MD closes a `requires_md_signoff` task for this patient.  
`last_meaningful_touch_at`: set on any task close, check-in, message, or prescription change.  
`current_plan`: free text maintained by MD; displayed prominently in Patient Cockpit.  
`next_step`: free text or null ("No current action needed"); displayed in cockpit header.

#### 2. New `prescription_changes` table

```sql
CREATE TABLE prescription_changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id  uuid NOT NULL REFERENCES prescriptions(id),
  patient_id       uuid NOT NULL REFERENCES patients(id),
  provider_id      uuid NOT NULL REFERENCES providers(id),
  change_type      text NOT NULL,
    -- started | dose_increased | dose_decreased | stopped | refill_authorized | formulation_changed
  previous_dosage  text,
  new_dosage       text,
  previous_status  text,
  new_status       text,
  reason           text,
  created_at       timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX rx_changes_patient_id_idx ON prescription_changes(patient_id);
CREATE INDEX rx_changes_prescription_id_idx ON prescription_changes(prescription_id);
```

---

### Task Cadence on Medication Change

When a `prescription_changes` row is inserted with `change_type IN ('started', 'dose_increased', 'dose_decreased', 'formulation_changed')`, auto-create 5 tasks in one transaction:

| Offset | Assigned role | Priority | Title |
|---|---|---|---|
| +4 days | rn | yellow | Confirm patient understood plan, obtained medication, no urgent side effects |
| +28 days | rn | yellow | 4-week early check-in — [medication name] |
| +56 days | rn | blue | 8-week trend review — [medication name] |
| +84 days | md | orange | 12-week meaningful response review — [medication name] |
| +365 days | md | blue | Annual benefit/risk review — [medication name] |

`source = 'med_change'`, `source_ref = prescription_change.id`. Pre-assigned backup owner = on-call MD for RN tasks.

---

### API Routes (New + Modified)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/provider/patients/[id]/cockpit` | md, np | Full cockpit payload: current plan, next step, diff since last MD review, active tasks, med timeline, recent labs, recent messages, recent visits |
| POST | `/api/provider/patients/[id]/prescriptions/[rxId]/change` | md, np | Record prescription change → insert `prescription_changes` → create task cadence |
| GET | `/api/provider/patients/[id]/diff` | md, np | Structured diff since `last_md_review_at` |
| PATCH | `/api/provider/patients/[id]/plan` | md, np | Update `current_plan` and `next_step` |

**Modified:** `PATCH /api/provider/tasks/[id]` close → if MD closes `requires_md_signoff` task: update `patients.last_md_review_at = now()`.

---

### UI Surfaces

#### Patient Cockpit (`/provider/patients/[id]/cockpit`)

**Top strip (always visible):**
- Patient one-liner (plain text, editable inline, AI-generated in Build 18)
- Current plan (editable inline by MD)
- Next step (editable inline; null state renders "No current action needed")
- Last MD review date

**"Since last MD review" panel (`DiffPanel` component):**
- Symptom score delta (WMI + per-domain)
- New labs
- Prescription changes
- New messages (count + categories)
- RN notes
- Contact attempts (any "unable to reach" logs)

**Active tasks** — `TaskQueue` filtered to this patient, status not closed/resolved.

**Accordion sections (collapsed by default):**
- Medication timeline (chronological `prescription_changes` rows)
- Symptom trend (`PillarTrendChart` — reused as-is)
- Lab history (with timing context: "ordered 4 weeks after E2 increase")
- Messages (thread view)
- Visit & encounter notes

#### New components

**`DiffPanel`** (`src/components/provider/DiffPanel.tsx`)
- Props: `diff` object from GET `/api/provider/patients/[id]/diff`
- Each change type is a collapsible row
- Zero-state: "No changes since last MD review on [date]"

**`MedChangeModal`** (`src/components/provider/MedChangeModal.tsx`)
- Fields: change_type selector, new_dosage, reason
- On submit: confirms "5 follow-up tasks have been scheduled" with dates

**`PlanEditor`** (`src/components/provider/PlanEditor.tsx`)
- Inline edit for `current_plan` and `next_step`
- Auto-saves on blur; shows "Saved" confirmation

#### Modified components

**`PatientOverview`** — add "Open Cockpit" link. No other changes.

---

### Integration Points

| Existing system | Integration |
|---|---|
| `computeLiveWMI()` | Cockpit diff panel computes score delta since `last_md_review_at` |
| `PillarTrendChart` | Reused inside cockpit accordion — props unchanged |
| Engagement crons | Already creating tasks (Build 16); no additional change |
| `engagement_log` | Cockpit diff panel shows "patient contacted N times" since last MD review |

---

### Testing / Verification Checklist

- [ ] `tsc --noEmit` passes
- [ ] Record prescription change; verify 5 task rows with correct `due_at` offsets
- [ ] MD closes `requires_md_signoff` task; verify `patients.last_md_review_at` updated
- [ ] Cockpit diff panel shows correct items for patient with 2 labs + 1 rx change since last review
- [ ] DiffPanel zero-state renders correctly
- [ ] `current_plan` and `next_step` save inline on blur
- [ ] `patients.last_meaningful_touch_at` updates on check-in and message submit

### Time Estimate

**2–3 weeks** — Cockpit is the main surface; diff query has joins but all data is in RDS.

---

## Build 18 — AI Augmentation (Scoped)

### Goal

Reduce MD cognitive load. AI summarizes, drafts, and flags — staff and MD make every decision. No AI output contains diagnoses or clinical impressions; all AI action suggestions reference physician-authored protocol checklists.

---

### Data Model Changes

#### 1. New `ai_cache` table

```sql
CREATE TABLE ai_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id),
  cache_type   text NOT NULL,
    -- one_liner | diff_summary | action_plan | message_draft
  content      text NOT NULL,
  source_hash  text NOT NULL,
  model_id     text NOT NULL,
  generated_at timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id, cache_type)
);
```

Cache invalidation: SHA-256 hash of most recent check-in date + last rx change date + last lab result date. If hash differs on cockpit load, re-generate async and return stale copy immediately.

#### 2. New `protocol_checklists` table

```sql
CREATE TABLE protocol_checklists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
    -- 'postmenopausal_bleeding' | 'testosterone_side_effects' | 'no_symptom_improvement' | etc.
  version      integer NOT NULL DEFAULT 1,
  steps        jsonb NOT NULL,
    -- array of { order, action, owner_role, due_offset_hours, patient_message_template }
  updated_at   timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES providers(id)
);
```

Physician-authored checklists drive AI action plans. AI identifies which checklist applies; it does not generate clinical reasoning. Checklists are versioned — updating a checklist does not require a code deploy.

---

### API Routes

| Method | Path | Auth | Purpose | `maxDuration` |
|---|---|---|---|---|
| GET | `/api/provider/patients/[id]/ai/one-liner` | md, np | Cached one-liner or trigger generation | 300 |
| GET | `/api/provider/patients/[id]/ai/diff-summary` | md, np | Cached diff summary or trigger generation | 300 |
| GET | `/api/provider/tasks/[id]/ai/action-plan` | md, np | For red/orange task: AI identifies matching protocol checklist + generates suggested patient wording | 300 |
| POST | `/api/provider/messages/[threadId]/ai-draft` | any staff | Draft reply using patient response quality template; staff approves before send | 300 |
| GET | `/api/engagement/task-housekeeping` | cron | Nightly scan: overdue tasks, orphaned tasks, 30d no-touch patients | 300 |
| GET | `/api/admin/protocol-checklists` | md, admin | List all checklists |
| PUT | `/api/admin/protocol-checklists/[name]` | md | Update checklist steps + bump version |

---

### Bedrock Prompt Specifications

All prompts use `src/lib/bedrock.ts` `invokeModel()`. Model: `us.anthropic.claude-sonnet-4-6`. `maxTokens: 4096`.

**One-liner** — Input: age, menopause status, uterus present/absent, active prescriptions, weeks since last dose change, WMI delta direction. Constraint in prompt: "Output one sentence under 25 words. Do not include diagnoses, clinical impressions, or recommendations."

**Diff summary** — Input: structured diff JSON. Constraint: "Summarize what changed in 3–5 sentences. State facts only. Do not suggest diagnoses, next steps, or clinical interpretations."

**Action plan** — Input: task title + category + patient context (meds, recent labs, recent scores) + matching protocol checklist steps. Output: ordered checklist of steps from the physician-authored protocol, with suggested patient-facing wording for each step (empathy first, clarity, education, next step, timing). Constraint: "You are rendering a physician-authored protocol checklist into patient-friendly language. Do not add clinical reasoning, diagnoses, or steps not present in the protocol."

**Message draft** — Input: last 5 messages in thread, patient first name, staff first name. Required structure enforced in prompt: empathy statement → clear answer → patient education point → next step → timing. Constraint: "Do not include medical advice. Staff reviews before sending."

---

### Patient-Facing Response Quality Template

All AI-drafted patient messages must follow this structure (enforced in the Bedrock prompt and validated before surfacing the draft to staff):

1. **Empathy first** — Acknowledge the patient's concern or feeling
2. **Clarity** — Plain-language answer or acknowledgment
3. **Education** — One relevant fact about what to expect
4. **Next step** — What happens next and who owns it
5. **Timing** — When the patient will hear back

Draft is labeled "AI draft — review before sending" with an edit prompt. No indication reaches the patient that AI was involved.

---

### Protocol Checklist — Required Authoring Work

**This is a parallel deliverable, not a code task.** Dr. Urban must author and approve all checklists before Build 18 ships. Each checklist defines: ordered action steps, which staff role owns each step, due-date offset, and suggested patient-facing wording for that step.

The following 12 checklists are required at minimum. Clinical basis is noted for each.

| Checklist name | Trigger condition | Clinical basis |
|---|---|---|
| `new_bleeding_mht` | New, heavy, or prolonged bleeding + systemic estrogen + uterus present | IMS 2023 Toolkit: persistent/new bleeding after months of MHT requires investigation |
| `missed_progesterone` | Systemic estrogen + uterus present + missed or uncertain P4 adherence | IMS 2023 Toolkit: progestogen required for endometrial protection |
| `severe_mood_worsening` | Severe distress, self-harm language, sudden mood collapse | Clinical safety — same-day MD review required |
| `testosterone_androgenic_effects` | Voice change, androgenic hair growth, acne, clitoromegaly concern | Potential irreversible effects; urgent MD review |
| `no_symptom_improvement_6_12wk` | Persistent VMS / sleep / mood symptoms after 6–12 weeks on current regimen | IMS 2024 White Paper: hormone profiles useful when symptom relief inadequate after 6–12 weeks |
| `adverse_effect_breast_nausea_spotting` | Breast tenderness, nausea, or spotting — distinguish expected (early) vs persistent | Expected early side effect vs. indication for regimen change |
| `lab_abnormal_unexpected` | Hormone level out of expected range, timing unclear, or symptom mismatch with result | IMS: "treat the patient, not the lab" — context required |
| `pharmacy_failure` | Medication not obtained, wrong medication dispensed, patient confused about pharmacy | Operational + safety — medication gap creates treatment failure |
| `patient_frustration_repeat_messages` | "No one called," "I'm confused," "cancel," or two+ messages before response | Service recovery + clinical safety screen |
| `poi_early_menopause` | Younger patient (typically <40), early menopause confirmed or suspected | Higher-dose logic; bone and cardiovascular prevention considerations |
| `gsm_vaginal_therapy` | Local vaginal therapy started or patient has questions about vaginal application | Education: insertion instructions, expected side effects, applicator use |
| `post_visit_followup` | 47–71 hours after any clinical visit | Standard post-visit check-in cadence |

### Protocol Checklist — Seed Data

Seed the `protocol_checklists` table with physician-authored checklists before launch. Minimum required at Build 18:

See the "Protocol Checklist — Required Authoring Work" section above for the full list of 12 checklists. The seed script inserts all 12 as empty templates; Dr. Urban fills in the steps via `/admin/protocol-checklists` before Build 18 ships.

---

### UI Surfaces

#### Cockpit — AI one-liner
- On load: fires GET `…/ai/one-liner`; shows spinner; shows stale copy if cache hit
- "AI" badge + edit icon — staff can overwrite; override stored in `provider_notes` with `note_type = 'one_liner_override'`

#### Cockpit — AI diff summary
- Below `DiffPanel`: collapsible "AI Summary" section
- "AI-generated · Last updated [time]" label

#### Task detail — AI action plan
- On any red/orange task: "Suggested Protocol" section
- Shows matched checklist name + steps with suggested patient wording
- "Use this wording" button pre-populates a message draft; staff edits and approves
- Labeled "Based on [checklist name] v[version] — approved by Dr. Urban"

#### Message compose — AI draft
- "Draft with AI" button
- Draft populates compose box with "AI draft — review before sending" label
- Must be edited or explicitly approved before send button activates

---

### `task-housekeeping` Cron Logic

`vercel.json` cron: `"0 16 * * *"` (10am MT daily).

1. Tasks with `due_at < now()` and status not resolved/closed → create yellow admin task: "Overdue: [title]"
2. Tasks with `owner_staff_id IS NULL` and `status = 'new'` and `created_at < now() - interval '4 hours'` → create yellow admin task: "Unassigned task needs owner"
3. Patients with `last_meaningful_touch_at < now() - interval '30 days'` and `is_active = true` → create yellow admin task: "No patient contact in 30 days"
4. Patients with no `next_step` and at least one open task → create gray admin task: "Patient has no documented next step"

De-duplicate: check for open task with same `patient_id + title` created in last 24 hours before inserting.

---

### Testing / Verification Checklist

- [ ] `tsc --noEmit` passes
- [ ] Cockpit load triggers Bedrock one-liner call; response cached in `ai_cache`
- [ ] Second cockpit load within 5 minutes returns cached response (verify no second Bedrock call in logs)
- [ ] Prescription change → cache hash mismatch on next cockpit load → re-generation triggered
- [ ] Red task with matching protocol checklist shows AI action plan panel with correct steps
- [ ] AI action plan does not contain the words "diagnosis," "likely," "I suggest," or "probably" — manual prompt review required before deploy
- [ ] "Use this wording" button pre-populates message compose with correct patient-facing text
- [ ] Message draft follows empathy → clarity → education → next step → timing structure
- [ ] Sending drafted message: patient receives it without "AI draft" label
- [ ] Verify `maxDuration = 300` on all AI routes (grep before deploy)
- [ ] Trigger `task-housekeeping` manually; verify housekeeping tasks appear in admin queue
- [ ] All protocol checklists seeded and reviewed by Dr. Urban before deploy

### Time Estimate

**2–3 weeks** — Protocol checklist authoring adds coordination time; prompt tuning requires clinical review pass.

---

## Build 19 — Service Recovery Dashboard

### Goal

No frustrated, confused, or unheard patient slips through. Practice feels personal and premium.

---

### Scope (to be planned in detail before execution)

**Trigger events that create service recovery tasks:**
- Patient message unanswered > practice SLA (define SLA in settings)
- Two or more patient messages before any staff response
- Message body contains: "no one called," "I'm confused," "cancel," "frustrated," "I'm upset," "no one responded"
- Pharmacy issue open > 48 hours
- Lab order not completed after 7 days
- New patient onboarding forms incomplete after 48 hours
- Patient has not started medication 7 days after prescription

**New dashboard tab:** Service Recovery Queue — assigned to Concierge/Admin. Shows: trigger, patient, days open, last touch, assigned staff, status.

**Patient-facing:** "We saw your message and someone will be in touch by [time]" auto-acknowledgment on inbound messages. (Staff sets SLA; system sends auto-ack; staff follows up by that time.)

**Operational metrics view** (practice admin only): response time SLA compliance, first-contact resolution rate, service recovery task close rate. Not a full analytics dashboard — just the 3–4 numbers that matter.

### Time Estimate

**2 weeks** — Most infrastructure exists from Build 16; this is primarily trigger detection + queue UI.

---

## Build 20 — Patient Experience Layer (future, not yet planned in detail)

Named here so it stays on the roadmap. Not in scope for Builds 16–19.

| Feature | Why it matters |
|---|---|
| "How you are doing" symptom trend (patient-facing) | Reduces anxiety; shows progress visually |
| Medication plan with images | Improves adherence; patients understand what they're taking |
| "What to expect weeks 1–12" education cards | Prevents panic messaging about normal early side effects |
| Report a side effect button | Captures issues early; feeds into RN queue |
| Bleeding report flow (structured) | Safety; ensures bleeding events become tasks |
| Vaginal medication instruction video | Better use + reduces embarrassment barrier |
| Visit prep card | Better consults; patient arrives prepared |
| After-visit summary | Retention; patient remembers the plan |
| "We saw your message" SLA auto-acknowledgment | Trust; patient knows they're not ignored |

---

## Architectural Constraint — FHIR-Compatible Design

Do not build SMART on FHIR in Builds 16–19. But design the data model so that FHIR integration is not painful later. Concrete constraints:

- Use UUIDs for all primary keys (already done)
- Keep PHI in clearly bounded, named tables — do not scatter patient identifiers into logging tables as free text
- Field names in `tasks`, `patients`, `providers` should map naturally to FHIR resource fields where there is an obvious equivalent (e.g., `provider_id` → `Practitioner`, `patient_id` → `Patient`, task `status` values align with FHIR `Task.status`)
- Avoid storing clinical data in opaque JSON blobs where a structured column would work — JSON is fine for `symptom_scores` and `ai_brief`, not for medication names or lab values that FHIR would need to query

This is a design-time constraint, not an implementation task. No additional code required.

---

## SOP Parallel Deliverable

The platform cannot prevent failures without a matching SOP layer authored by the practice team. Software ships alongside these — they are not code but are equally required:

- Daily MD huddle SOP (red alerts, overdue orange, service recovery)
- RN triage SOP (what RN resolves vs. escalates)
- Message SLA SOP (business hours, after-hours, urgent language)
- Lab review SOP (critical vs. routine, resulted/not-reviewed window)
- Medication change SOP (5-touchpoint cadence responsibilities)
- Service recovery SOP (apology, call-back, escalation, close-out)
- AI-use SOP (no PHI in non-HIPAA tools, no autonomous clinical advice)
- Audit SOP (weekly review of closed red/orange tasks)

These should be authored in parallel with Build 16, not after launch.

---

## Cross-Build Sequencing Notes

- Build 16 must ship before 17 (tasks table is required by the cockpit's active-task panel)
- Build 17 must ship before 18 (diff data structure feeds AI diff-summary prompt; protocol checklists need task context)
- Build 19 can ship independently after Build 16
- Each build is independently demoable
- No patient-facing changes in Builds 16–18 — patient dashboard, check-in flow, and engagement emails untouched
- All AI routes: `export const maxDuration = 300` — grep before every deploy
- DB migrations run against RDS before deploying code that references new columns
- Dev bypass in `getServerSession()` must return `staffRole: 'md'` after Build 16 session change

## Vercel / Deployment Notes

- New cron route in Build 18 (`/api/engagement/task-housekeeping`) must be added to `vercel.json`
- New Bedrock routes all need `export const maxDuration = 300`
- Protocol checklist seed data: run as a one-time migration script after Build 18 schema deploy, before Build 18 code ships
