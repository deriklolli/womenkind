# Build 16 — Multi-Staff Clinical Command Center
**Date:** 2026-05-17  
**Status:** Approved for implementation

---

## Context

WomenKind currently has a binary auth model (provider vs. patient). As the practice scales to include RN, admin, and concierge staff, every actionable item (score drops, lab results, patient messages, missed check-ins) needs an owner, a priority, and a closed-loop resolution. Without this, things fall through the cracks.

Build 16 adds multi-staff auth, a task engine with a full state machine, role-appropriate dashboards, structured close-out, and a complete audit trail. It is the foundation that Builds 17–19 build on.

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Navigation | Role-aware single portal — one shell, nav links vary by staff role | Simpler routing; familiar login experience |
| MD Today command bar | Priority row (3 large urgent tiles) + secondary row (6 smaller tiles) | Urgent items get visual weight; routine items stay visible but subordinate |
| Red task sign-off | `requires_md_signoff` is an explicit per-task flag, NOT tied to priority color | Dr. Urban empowers staff to close red tasks; MD sign-off is reserved for specific task types (e.g. lab results) |
| Staff roles in schema | All 6 (`md`, `np`, `rn`, `ma`, `admin`, `concierge`) — UI surfaces built for MD + RN + Concierge first | Schema supports all; UI prioritizes the roles in active use |

---

## Data Model

### 1. `providers` table — add columns

```sql
ALTER TABLE providers
  ADD COLUMN role text NOT NULL DEFAULT 'md',
  ADD COLUMN display_name text,
  ADD COLUMN specialty text;
```

Valid roles: `md | np | rn | ma | admin | concierge`

Drizzle: update `src/lib/db/schema.ts` — add `role`, `display_name`, `specialty` to `providers`.

### 2. New `tasks` table

Full schema in `docs/practice-os-plan.md` → Build 16 → Data Model → tasks.

Key fields:
- `category`: `clinical | lab | med | message | rn_escalation | service | admin | unable_to_reach`
- `priority`: `red | orange | yellow | blue | gray`
- `status`: `new | acknowledged | in_progress | waiting_patient | waiting_md | waiting_lab | resolved | closed`
- `owner_staff_id` + `backup_owner_staff_id` (backup required when priority = red or orange)
- `requires_md_signoff`: boolean, set explicitly by task source — NOT derived from priority
- Structured close-out fields: `closeout_what_was_done`, `closeout_plan`, `closeout_followup_*`, `closeout_safety_open`
- `message_category`: set when `source = 'patient_message'`

### 3. New `audit_events` table

Extends `phi_access_log` for Build 16+. Tracks every staff action with `user_id`, `staff_id`, `patient_id`, `action`, `resource_type`, `resource_id`, `metadata`. Existing `phi_access_log` writes stay intact.

---

## Auth Changes

**File:** `src/lib/getServerSession.ts`

Add `staffRole: 'md' | 'np' | 'rn' | 'ma' | 'admin' | 'concierge' | null` to `ServerSession`. Dev bypass returns `staffRole: 'md'`.

**New file:** `src/lib/requireStaffRole.ts` — returns 403 if session `staffRole` is not in the allowed set.

All `/api/provider/*` routes get `requireStaffRole()` guards.

---

## Task State Machine

```
new → acknowledged | in_progress
acknowledged → in_progress | waiting_patient | waiting_md | waiting_lab
in_progress → waiting_* | resolved
waiting_* → in_progress | resolved
resolved → closed  (requires all closeout_* fields; if requires_md_signoff, closed_by must be md/np)
```

**Hard rules enforced at API layer:**

| Rule | Enforcement |
|---|---|
| Red/orange task requires backup owner | API returns 400 if `backup_owner_staff_id` is null |
| `closeout_safety_open = true` → cannot close | API returns 400 |
| Message task with `patient_notified = false` → cannot resolve | API returns 400 |
| All `closeout_*` fields required on resolved → closed | API validates presence |
| `requires_md_signoff = true` → `closed_by` must have `role = 'md'` or `'np'` | API returns 403 |
| No direct `new → closed` or `new → resolved` | API rejects invalid transitions |

---

## API Routes

### New routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/provider/tasks` | any staff | List tasks; query: `patientId`, `status`, `priority`, `category`, `assignedToMe`, `queue` |
| POST | `/api/provider/tasks` | any staff | Create task; enforces backup owner on red/orange |
| PATCH | `/api/provider/tasks/[id]` | any staff | Update status / assign / acknowledge / close; enforces state machine + close-out |
| POST | `/api/provider/tasks/[id]/contact-attempt` | any staff | Log unable-to-reach attempt; escalation task auto-created after 3 attempts |
| GET | `/api/provider/today` | md, np | MD Today payload: command bar counts + patient priority queue |
| GET | `/api/staff/rn-queue` | rn, np, ma | RN queue: orange + yellow + unable_to_reach tasks |
| GET | `/api/staff/admin-queue` | admin, concierge | Admin queue: blue + gray + service tasks |
| POST | `/api/staff/escalate` | rn, ma | SBAR form → orange/red task assigned to MD |
| POST | `/api/staff/rn-note` | rn, ma | RN note with disposition → routes to correct task type |
| GET | `/api/audit/events` | md, admin | Paginated audit log |

### RN note disposition routing

| `disposition` | Action |
|---|---|
| `fyi` | Audit event only; no task |
| `patient_contacted` | Yellow follow-up task |
| `needs_md_review` | Orange task → MD |
| `same_day_md_review` | Red task → MD; backup owner required |
| `unable_to_reach` | `unable_to_reach` task; first attempt logged |
| `resolved_by_protocol` | Requires `protocol_name` + `closeout_what_was_done`; closes inline |
| `service_issue` | Blue admin/concierge task |

### Message triage — `message_category` → default priority + owner role

| Category | Priority | Owner role |
|---|---|---|
| `red_flag` | red | md |
| `clinical_update` | orange | rn |
| `side_effect` | orange | rn |
| `dose_question` | orange | md |
| `adherence` | yellow | rn |
| `pharmacy` | yellow | admin |
| `frustration` | yellow | concierge |
| `life_event` | gray | rn |

### Modified existing routes

| Route | Change |
|---|---|
| All `/api/provider/*` | Add `requireStaffRole()` |
| `POST /api/canvas/labs/result` | Create orange lab review task (`requires_md_signoff = true`) |
| `POST /api/daily-checkin` (score drop) | Create red clinical task |
| `GET /api/engagement/weekly-nudge` | Create yellow missed-checkin task |
| `GET /api/engagement/daily-scan` | Each scan type creates categorized task |
| `POST /api/messages` (inbound) | Categorize → create task with `message_category` |

**De-duplication:** before creating any cron-sourced task, check for open task with same `patient_id + source + source_ref`.

---

## UI Surfaces

### `/provider/today` — MD Today (md, np)

**Command bar — two rows:**
- Row 1 (large): 🔴 Red MD Today · 🟠 MD Decisions Due · 🟣 RN Escalations
- Row 2 (small): 🧪 Labs Not Reviewed · 💊 Med Change Follow-Up · ⏰ Overdue · 💬 Messages > SLA · 📈 Outcomes Watch · 🤍 Service Recovery (coming soon)

Each tile: color + icon + count. Zero count = grayed out. Click opens filtered task queue.

**Patient Priority Queue below command bar:**
- Columns: priority badge, patient name, reason flagged, owner initials, status, due, last touched, action button
- Color-coded left border by priority
- Default sort: priority (red first), then due date
- "Acknowledge" / "Review" / "Close" action buttons per row

### `/staff/rn-queue` — RN Queue (rn, np, ma)

- `TaskQueue` filtered to: orange + yellow + `unable_to_reach` categories
- `RnNoteComposer` below queue
- "Escalate (SBAR)" button opens `SbarModal`

### `/staff/admin-queue` — Admin / Concierge Queue (admin, concierge)

- `TaskQueue` filtered to: service + admin + pharmacy categories

### Provider nav changes

- Role-conditional links: MD sees Today + Patients + Schedule; RN sees RN Queue + Patients; Admin/Concierge sees Admin Queue
- Unacknowledged task count badge per role's primary queue link

---

## New Components

| Component | Path | Purpose |
|---|---|---|
| `TaskQueue` | `src/components/staff/TaskQueue.tsx` | Sortable task list, color-coded by priority, action buttons per row |
| `TaskCloseModal` | `src/components/staff/TaskCloseModal.tsx` | 7-field structured close-out form; shows "Escalate to MD" if `requires_md_signoff` and user is not MD |
| `SbarModal` | `src/components/staff/SbarModal.tsx` | SBAR form + priority + backup owner selector |
| `RnNoteComposer` | `src/components/staff/RnNoteComposer.tsx` | Note text + 7 disposition buttons |
| `OutcomesWatchQueue` | `src/components/staff/OutcomesWatchQueue.tsx` | Patients with WMI drop >20% over 4 weeks or no improvement after 8+ weeks on meds |

---

## Execution Order

| Week | Work | Gate |
|---|---|---|
| 1 | Schema migrations: `providers.role`, `tasks`, `audit_events` — run against prod RDS | Migration applied, `tsc --noEmit` passes |
| 2 | Auth refactor: `getServerSession` + `requireStaffRole` + all route guards | All provider routes tested with role-restricted sessions |
| 3 | Task engine API: POST/PATCH with state machine, backup owner enforcement, close-out validation. Extend existing event handlers. | Task creation + all transition rules verified end-to-end |
| 4 | RN note composer + disposition routing. Message triage by category. `SbarModal`. | All 7 dispositions verified; message categories route correctly |
| 5 | Dashboard pages: MD Today, RN Queue, Admin Queue. All UI components. | Role-based dashboards load correctly for each staff role |

---

## Verification Checklist

- [ ] `tsc --noEmit` passes after schema and session changes
- [ ] Create RN user; verify `/api/provider/today` returns 403, `/api/staff/rn-queue` returns 200
- [ ] Attempt red task with no backup owner; verify 400
- [ ] Trigger score drop; verify red clinical task created
- [ ] POST lab result; verify orange lab review task with `requires_md_signoff = true`
- [ ] Attempt to close `requires_md_signoff` task as RN; verify 403
- [ ] Submit SBAR; verify orange/red task created + audit_events row written
- [ ] Submit RN note with each of 7 dispositions; verify correct task type per disposition
- [ ] Log 3 unable-to-reach attempts; verify escalation task auto-created
- [ ] Inbound message with `red_flag` category; verify red task assigned to MD
- [ ] Attempt to resolve message task with `patient_notified = false`; verify 400
- [ ] Attempt to close task with `closeout_safety_open = true`; verify 400
- [ ] All `/api/provider/*` routes return 403 for patient session
- [ ] Nav shows correct role-conditional links for MD, RN, admin sessions
