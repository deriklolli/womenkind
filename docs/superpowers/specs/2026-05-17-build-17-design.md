# Build 17 — Patient Cockpit + Medication Change Tracker

**Date:** 2026-05-17  
**Status:** Approved for planning  
**Prerequisite:** Build 16 (tasks table and task engine must be live)

---

## Goal

The physician understands any patient's current state in under 60 seconds. Medication changes automatically generate the full 5-touchpoint follow-up cadence as tasks. The clinical task count is visible at a glance on the dashboard home screen.

---

## Design Decisions

All decisions confirmed during brainstorming session on 2026-05-17.

| Question | Decision |
|---|---|
| Task counts on dashboard | Full "Clinical Tasks" card below the existing 4 cards (Option B) — top 8 tasks, "View all →" |
| Full task queue page layout | Grouped by priority sections: Urgent, MD Decisions, Lower Priority (Option B) |
| Patient cockpit layout | Single column scroll (Option A) |
| MedChangeModal entry points | Both: cockpit medication timeline + existing patient chart prescriptions tab |

---

## 1. Dashboard Consolidation

### 1a. DashboardHome — Clinical Tasks card

Add a full-width "Clinical Tasks" card below the existing 2×2 grid in `src/components/provider/DashboardHome.tsx`.

- Fetches top 8 open tasks from `GET /api/provider/tasks?limit=8` (sorted: red → orange → yellow, then by `updated_at`)
- Each row: priority color bar (left border), task title, patient name, status badge, time ago, Acknowledge or Close button
- **Acknowledge** (`new` status): calls `PATCH /api/provider/tasks/[id]` with `{ status: 'acknowledged' }` — no modal, instant
- **Close** (`acknowledged` / `in_progress` / `resolved` status): opens `TaskCloseModal` (already built in Build 16)
- "View all →" link navigates to `/provider/tasks`
- Zero state: "No open tasks — queue is clear." in muted text
- Polls every 60 seconds (same pattern as ProviderNav task badge)

### 1b. `/provider/tasks` — Full task queue page

New page at `src/app/provider/tasks/page.tsx`. Uses WomenKind design language (cream background, aubergine typography, white rounded cards).

**Layout — three collapsible priority sections:**

```
Urgent (N)           ← red tasks, requires_md_signoff or priority='red'
  [task rows with Ack/Close actions]

MD Decisions (N)     ← orange tasks
  [task rows]
  + N more in this section (expand link)

Lower Priority (N)   ← yellow + blue tasks
  [task rows]
  + N more in this section
```

Each section header has a colored dot, label, and count badge. Sections are expanded by default; clicking the header collapses them. The "+ N more" truncates each section to 5 rows; clicking expands all.

Each task row shows: priority color-left-border, patient name (links to cockpit), task title, category badge, status, time ago, Acknowledge / Close button.

**"Tasks" tab** added to `ProviderNav` between "Today" and "Patients". Shown for all staff roles. Badge count = total open tasks across all priorities (fetched alongside existing task count poll).

---

## 2. Patient Cockpit

### Route

`/provider/patients/[id]/cockpit` — linked from:
- `PatientOverview` component ("Open Cockpit" link, visible to providers only)
- Each patient name in the Clinical Tasks card and `/provider/tasks` page
- Patient list rows in the existing `/provider/dashboard?tab=patients` view

### Page layout (single column scroll)

```
┌─ Patient strip ────────────────────────────────────────────┐
│ Sarah Mitchell  51y · Peri-menopausal · Member             │
│                                                             │
│ Current Plan (editable inline)                              │
│ "Estradiol 1mg patch started 6 weeks ago. Monitor          │
│  vasomotor response, reassess at 12 weeks."                 │
│                                                             │
│ → Next: 12-week meaningful response review due Jun 28       │
│                          Last MD review: 18 days ago  WMI↓8 │
└─────────────────────────────────────────────────────────────┘

┌─ Since last MD review ─────────────────────────────────────┐
│ WMI        72 → 64 (↓11%)                                  │
│ Labs       E2 level resulted — pending review              │
│ Messages   2 new · dose question, side effect              │
│ RN Notes   1 note — patient contacted re: hot flashes      │
│ Rx Changes Estradiol dose increased → 1mg (May 3)         │
└─────────────────────────────────────────────────────────────┘

┌─ Active Tasks (3) ─────────────────────────────────────────┐
│ [TaskQueue component filtered to this patient]             │
└─────────────────────────────────────────────────────────────┘

┌─ History ──────────────────────────────────────────────────┐
│ ▸ Medication Timeline (3 changes)                          │
│ ▸ Symptom Trend (8 check-ins)                              │
│ ▸ Labs (2 orders)                                          │
│ ▸ Messages (5 threads)                                     │
│ ▸ Visit & Encounter Notes (2)                              │
└─────────────────────────────────────────────────────────────┘
```

### Patient strip details

- **Current plan**: editable inline via `PlanEditor` component; auto-saves on blur via `PATCH /api/provider/patients/[id]/plan`
- **Next step**: editable inline (same component, same endpoint); null state renders "No current action needed" in muted text
- **Last MD review date**: set automatically when MD closes a `requires_md_signoff` task for this patient
- **WMI delta chip**: compares current `liveWmi` to value at `last_md_review_at`; green if up, red if down, gray if no change

### "Since last MD review" — DiffPanel

- Zero state (no prior MD review): "No prior MD review recorded — showing all history."
- Each row is a different change type; rows only rendered if there's data (no empty rows)
- Rx Changes row only shown if `prescription_changes` exist since `last_md_review_at`
- RN Notes row shows count + most recent note snippet

### Active Tasks

Reuses `TaskQueue` component from Build 16, filtered to `patient_id`. Includes Acknowledge and Close inline actions. Zero state: "No open tasks for this patient."

### History accordions

Each section collapsed by default. Content loaded lazily on expand (separate fetch per section to keep cockpit initial load fast).

| Section | Data source |
|---|---|
| Medication Timeline | `prescription_changes` rows, newest first; "+ Record change" button |
| Symptom Trend | Reuses `PillarTrendChart` component, props unchanged |
| Labs | `lab_orders` + results |
| Messages | Message threads for this patient |
| Visit & Encounter Notes | `visits` + `encounter_notes` |

---

## 3. Medication Change Tracker

### prescription_changes table

```sql
CREATE TABLE prescription_changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id  uuid NOT NULL REFERENCES prescriptions(id),
  patient_id       uuid NOT NULL REFERENCES patients(id),
  provider_id      uuid NOT NULL REFERENCES providers(id),
  change_type      text NOT NULL,
    -- started | dose_increased | dose_decreased | stopped
    -- | refill_authorized | formulation_changed
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

### MedChangeModal

Fields:
- **Change type** (required): dropdown — Started / Dose increased / Dose decreased / Stopped / Formulation changed / Refill authorized
- **New dosage** (text, optional): pre-filled with current dosage
- **Reason** (text, optional)

On submit:
1. `POST /api/provider/patients/[id]/prescriptions/[rxId]/change` with body `{ change_type, new_dosage, previous_dosage, reason }`
2. Server inserts `prescription_changes` row + creates 5 tasks in one transaction (see cadence below)
3. Modal shows confirmation: "Change recorded. 5 follow-up tasks scheduled:" with the task titles and dates listed
4. Confirmation closes after 3 seconds or on "Done" click

**Entry points:**
- Cockpit → Medication Timeline accordion → "+ Record change" button per medication row
- Patient chart prescriptions tab → "Record change" button per prescription row

### Task cadence on medication change

Created for `change_type IN ('started', 'dose_increased', 'dose_decreased', 'formulation_changed')`. Not created for `stopped`, `refill_authorized`.

| Due offset | Assigned role | Priority | Title |
|---|---|---|---|
| +4 days | rn | yellow | Confirm patient understood plan, obtained [med name], no urgent side effects |
| +28 days | rn | yellow | 4-week early check-in — [med name] |
| +56 days | rn | blue | 8-week trend review — [med name] |
| +84 days | md | orange | 12-week meaningful response review — [med name] |
| +365 days | md | blue | Annual benefit/risk review — [med name] |

All 5 tasks: `source = 'med_change'`, `source_ref = prescription_change.id`.

---

## 4. Data Model Changes

### patients table

```sql
ALTER TABLE patients
  ADD COLUMN last_md_review_at        timestamp WITH TIME ZONE,
  ADD COLUMN last_meaningful_touch_at timestamp WITH TIME ZONE,
  ADD COLUMN current_plan             text,
  ADD COLUMN next_step                text;
```

- `last_md_review_at`: set by `PATCH /api/provider/tasks/[id]` when MD closes a `requires_md_signoff=true` task for this patient
- `last_meaningful_touch_at`: set on task close, check-in, message sent, or prescription change
- `current_plan`: free text, MD-maintained, displayed in cockpit header
- `next_step`: free text or null; null renders as "No current action needed"

---

## 5. API Routes

### New

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/provider/patients/[id]/cockpit` | md, np | Full cockpit payload |
| GET | `/api/provider/patients/[id]/diff` | md, np | Structured diff since `last_md_review_at` |
| PATCH | `/api/provider/patients/[id]/plan` | md, np | Update `current_plan` and `next_step` |
| POST | `/api/provider/patients/[id]/prescriptions/[rxId]/change` | md, np | Record rx change + create task cadence |

### Modified

- `PATCH /api/provider/tasks/[id]` close → if `requires_md_signoff` task closed by MD/NP: set `patients.last_md_review_at = now()`
- `GET /api/provider/tasks` → add `limit` param support (used by DashboardHome top-8 fetch)

---

## 6. New Components

| Component | Path | Purpose |
|---|---|---|
| `DiffPanel` | `src/components/provider/DiffPanel.tsx` | "Since last MD review" section |
| `MedChangeModal` | `src/components/provider/MedChangeModal.tsx` | Record prescription change + confirm task cadence |
| `PlanEditor` | `src/components/provider/PlanEditor.tsx` | Inline edit for `current_plan` + `next_step`, auto-save on blur |

## 7. Modified Components

| Component | Change |
|---|---|
| `DashboardHome` | Add Clinical Tasks card below existing grid |
| `ProviderNav` | Add "Tasks" tab |
| `PatientOverview` | Add "Open Cockpit" link |
| Existing patient chart prescriptions tab | Add "Record change" button per row → opens `MedChangeModal` |

---

## 8. DB Migration

Run via debug endpoint pattern (same as Build 16): `POST /api/debug/migrate-build17` with `x-migration-secret: $CRON_SECRET`.

Runs:
1. `ALTER TABLE patients ADD COLUMN ...` (4 columns)
2. `CREATE TABLE prescription_changes ...`
3. `CREATE INDEX ...` (2 indexes)

---

## 9. Verification Checklist

- [ ] Clinical Tasks card on dashboard shows top 8, priority-ordered
- [ ] Acknowledge button sets status to `acknowledged` without modal
- [ ] Close button opens `TaskCloseModal`, task disappears on success
- [ ] "View all →" navigates to `/provider/tasks`
- [ ] `/provider/tasks` grouped sections render; Urgent section shows only red tasks
- [ ] Cockpit loads at `/provider/patients/[id]/cockpit`
- [ ] Current plan edits auto-save on blur, "Saved" confirmation appears
- [ ] Diff panel shows "No prior MD review" when `last_md_review_at` is null
- [ ] Closing a `requires_md_signoff` task sets `last_md_review_at` on the patient
- [ ] After MD review close, diff panel shows delta from that date forward
- [ ] `MedChangeModal` accessible from cockpit med timeline and patient chart prescriptions tab
- [ ] Submitting a `started` change creates exactly 5 tasks with correct due dates
- [ ] Submitting a `stopped` change creates 0 tasks
- [ ] Confirmation modal lists all 5 scheduled task titles + dates
- [ ] `tsc --noEmit` passes with no errors
