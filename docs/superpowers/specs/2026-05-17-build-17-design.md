# Build 17 — Patient Cockpit + Medication Change Tracker

**Date:** 2026-05-17  
**Status:** Approved for implementation  
**Prerequisite:** Build 16 complete (tasks table, task engine, TaskQueue component all live)

---

## Goal

Give the provider a single tab to understand any patient and act — without navigating across 8 tabs to piece together context. Medication changes auto-schedule the full 5-touchpoint follow-up cadence as tasks.

---

## Design Decisions

| Question | Decision |
|---|---|
| Where does the cockpit live? | Rename the existing "Overview & Trends" tab to "Cockpit" — no new page, no new URL, tab count stays at 8 |
| Score display | Demoted to compact number (not full banner) in top-left of a 3-column strip |
| Med change button location | Inside the Medication Timeline accordion on the Cockpit tab only |
| Dashboard clinical tasks | Already built in Build 16 — no changes needed |
| Tasks page | Already built in Build 16 — no changes needed |

---

## 1. Cockpit Tab (replaces "Overview & Trends")

### What changes

In `src/app/provider/patient/[id]/page.tsx`:
- Rename tab label `'Overview & Trends'` → `'Cockpit'`
- Replace the `activeTab === 'overview'` content block with the new Cockpit layout
- Fetch `current_plan`, `next_step`, `last_md_review_at` from the patient API (added to existing response)

### Layout (top to bottom)

**1. Top strip — 3 columns**

```
┌─────────────────────────────────────────────────────────────┐
│  WK Score   │  Current Plan (inline editable)               │
│  68         │  E2 patch 0.05mg · Progesterone 100mg ...     │
│  ↓ 4 pts    │                                               │
│             │  Next Step (inline editable)                  │
│             │  12-week meaningful response review           │
│             │  Last MD review: 3 weeks ago                  │
└─────────────────────────────────────────────────────────────┘
```

- Score: `text-4xl font-light` (not `text-[100px]`). Delta chip beneath. Uses existing `liveWmi` prop — no new fetch.
- Current Plan + Next Step: `PlanEditor` component, saves on blur via `PATCH /api/provider/patients/[id]/plan`
- Next Step null state: "No current action needed"

**2. Since Last MD Review panel (`DiffPanel` component)**

Color-coded chips: WMI delta, new labs count, RN notes count, messages count. Chips only rendered if there is data (no empty rows).

Zero state: "No changes since last MD review on [date]" — or "No MD review recorded yet — showing all history."

Data: `GET /api/provider/patients/[id]/diff`

**3. Open Tasks**

`TaskQueue` component, filtered to this patient, status not in `['resolved', 'closed']`. Reuses existing component unchanged.

Zero state: "No open tasks for this patient."

**4. Symptom Domains (compact grid)**

4-column grid of domain cards. Compact: smaller score number, no sparklines. Driven by existing visit `symptom_scores` data already fetched by the patient profile page.

**5. Accordions (collapsed by default)**

- **Trend Chart** — expands to show `PillarTrendChart`, reused as-is
- **Medication Timeline** — expands to show chronological `prescription_changes` rows + `+ Record Change` button in the accordion header

---

## 2. Medication Change Flow

### `MedChangeModal` component

Triggered by `+ Record Change` button in the Medication Timeline accordion.

**Fields:**
- **Medication** — dropdown of patient's active prescriptions
- **Change type** — pill selector: `started | dose_increased | dose_decreased | stopped | formulation_changed`
- **New dosage** — text input (hidden for `stopped`)
- **Reason** — text input

**Confirmation banner inside modal (before submit):**
> ✓ Will schedule: Day 4 check-in · Week 4 check-in · Week 8 review · 12-week MD review · Annual review

Not shown for `stopped` or `refill_authorized`.

**On submit:** `POST /api/provider/patients/[id]/prescriptions/[rxId]/change`

After success: modal shows "Change recorded. 5 follow-up tasks scheduled:" with titles + dates. Closes on "Done" or after 3 seconds.

### Auto-task cadence (server-side)

Triggered for `change_type IN ('started', 'dose_increased', 'dose_decreased', 'formulation_changed')`. All 5 created in one transaction.

| Due offset | Role | Priority | Title |
|---|---|---|---|
| +4 days | rn | yellow | `Day-4 check-in — [med name]: confirm received medication, no urgent side effects` |
| +28 days | rn | yellow | `4-week check-in — [med name]` |
| +56 days | rn | blue | `8-week trend review — [med name]` |
| +84 days | md | orange | `12-week response review — [med name]` |
| +365 days | md | blue | `Annual benefit/risk review — [med name]` |

`source = 'med_change'`, `source_ref = prescription_change.id`

`stopped` and `refill_authorized` create zero tasks.

---

## 3. Data Model Changes

### `patients` table — 4 new columns

```sql
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS last_md_review_at        timestamp WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_meaningful_touch_at  timestamp WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_plan              text,
  ADD COLUMN IF NOT EXISTS next_step                 text;
```

- `last_md_review_at`: set when MD/NP closes a `requires_md_signoff` task for this patient (hook in `PATCH /api/provider/tasks/[id]`)
- `last_meaningful_touch_at`: set on task close, check-in, message sent, or prescription change
- `current_plan` / `next_step`: free text, MD-maintained via `PlanEditor`

### `prescription_changes` table (new)

```sql
CREATE TABLE prescription_changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id  uuid NOT NULL REFERENCES prescriptions(id),
  patient_id       uuid NOT NULL REFERENCES patients(id),
  provider_id      uuid NOT NULL REFERENCES providers(id),
  change_type      text NOT NULL,
  previous_dosage  text,
  new_dosage       text,
  reason           text,
  created_at       timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX rx_changes_patient_id_idx ON prescription_changes(patient_id);
CREATE INDEX rx_changes_prescription_id_idx ON prescription_changes(prescription_id);
```

---

## 4. API Routes

### New

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/provider/patients/[id]/diff` | md, np | Diff since `last_md_review_at`: WMI delta, labs, RN notes, messages counts |
| PATCH | `/api/provider/patients/[id]/plan` | md, np | Update `current_plan` and `next_step` |
| POST | `/api/provider/patients/[id]/prescriptions/[rxId]/change` | md, np | Insert `prescription_changes` row + create task cadence |

### Modified

- `GET /api/provider/patients/[id]` — add `current_plan`, `next_step`, `last_md_review_at` to response
- `PATCH /api/provider/tasks/[id]` — when MD/NP closes a `requires_md_signoff` task: set `patients.last_md_review_at = now()`

---

## 5. New Components

| Component | Path | Purpose |
|---|---|---|
| `DiffPanel` | `src/components/provider/DiffPanel.tsx` | Since-last-review chips |
| `MedChangeModal` | `src/components/provider/MedChangeModal.tsx` | Record rx change + task cadence confirmation |
| `PlanEditor` | `src/components/provider/PlanEditor.tsx` | Inline edit for `current_plan` + `next_step`, auto-save on blur |

---

## 6. What Is NOT Changing

- All 7 other patient profile tabs (Intake, Biometrics, Prescriptions, Labs, Visit Timeline, Notes, Messages) — untouched
- Dashboard clinical tasks card — already built in Build 16
- Tasks page — already built in Build 16
- Patient-facing dashboard — untouched
- `PillarTrendChart` — reused inside accordion, no changes
- `TaskQueue` — reused, no changes

---

## 7. DB Migration

Via debug endpoint pattern: `POST /api/debug/migrate-build17` with `x-migration-secret: $CRON_SECRET`

Runs `ALTER TABLE patients` (4 columns) + `CREATE TABLE prescription_changes` + 2 indexes.

---

## 8. Verification Checklist

- [ ] `tsc --noEmit` passes
- [ ] "Overview & Trends" tab renamed to "Cockpit" and is default landing tab
- [ ] Score shows compact number + delta chip, not full banner
- [ ] Current plan saves on blur, "Saved" flash appears
- [ ] Next step null state shows "No current action needed"
- [ ] Diff panel shows correct counts for patient with 1 new lab + 2 RN notes
- [ ] Diff panel zero state renders when no MD review recorded
- [ ] Closing a `requires_md_signoff` task updates `patients.last_md_review_at`
- [ ] Medication Timeline accordion expands, shows chronological history
- [ ] `+ Record Change` button opens `MedChangeModal`
- [ ] Submitting `dose_increased` change creates 5 tasks with correct `due_at` offsets
- [ ] Submitting `stopped` change creates 0 tasks
- [ ] Confirmation shows all 5 task titles + dates
- [ ] All other 7 tabs unaffected
