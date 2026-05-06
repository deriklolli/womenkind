# Pillar Trend Chart & Scheduling Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining two items from the Pillar Trend Chart + scheduling fix spec; all other items in the spec are already committed.

**Architecture:** Most of the spec (10 items covering chart rendering, nav labels, Oura tab, portal modal, source fixes) was already shipped across 10 recent commits. Two small code changes remain: (1) a one-line default-value fix in the dashboard, and (2) committing an unstaged schedule-page bugfix that is already in the working tree.

**Tech Stack:** Next.js 14 App Router, TypeScript, React state

---

## Already Done (verify only, no code changes needed)

These items are committed and live on `main`. No action required:

| Item | Commit |
|------|--------|
| X-axis START/NOW only + date tooltips | `46d9d09` |
| Hollow ring dots + current-week pulse halo | `46d9d09` |
| Floor baseline + vertical connector | `46d9d09` |
| S-curve fix (bezier split at first real check-in) | `46d9d09` |
| Filled milestone dots | `725f1ee` |
| Raw value fix (all domains plot same number as symptom card) | `46d9d09` |
| `startIso` in API response | `46d9d09` |
| OURA label gray + above dashed line | `46d9d09` |
| Wearable energy inverted to match 1–5 burden | `46d9d09` |
| Dev fixture uses realistic 1–5 values | `46d9d09` |
| "Book Initial Consultation" hero CTA fix (`onlyInitial` path) | `d65a045` |
| "Your Journey" timeline strip removed | `d22932b` |
| Nav subtitle truncation | `ab508b5` |
| Symptom Tracker subtitle → "Weekly check-ins" | `71d5032` |
| Health Trends → "Wearable Data" | `8f93d83` |
| Oura Ring source tab in Wearable Data | `49f2578` |
| WmiExplainerModal via `createPortal` | `2874f0d` |

---

## Task 1: Fix `hasInitialConsultation` default causing flash-of-hidden for new patients

**Problem:** `hasInitialConsultation` initializes to `true` (line 413 of `dashboard/page.tsx`). Before the appointments API call completes, the `AppointmentTypeSelector` receives `excludeNames={['initial consultation']}`, silently hiding the initial consultation option for new patients on first render.

**Fix:** Change the default to `false`. This means the selector shows all appointment types (including initial consultation) on first render, then correctly hides it once we confirm the patient has had one. Safe because the only downside is briefly showing initial consultation to existing patients — it disappears as soon as the API responds.

**Files:**
- Modify: `src/app/patient/dashboard/page.tsx:413`

- [ ] **Step 1: Apply the one-line fix**

In `src/app/patient/dashboard/page.tsx`, change line 413 from:
```ts
const [hasInitialConsultation, setHasInitialConsultation] = useState(true)
```
to:
```ts
const [hasInitialConsultation, setHasInitialConsultation] = useState(false)
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/deriklolli/Projects/WOMENKIND/WomenKind && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors (this is a type-compatible change — `boolean` stays `boolean`).

- [ ] **Step 3: Commit**

```bash
git add src/app/patient/dashboard/page.tsx
git commit -m "Fix hasInitialConsultation defaulting to true, hiding initial consult for new patients on load"
```

---

## Task 2: Commit unstaged schedule-page fix (isNewPatient scoped to initial consultations only)

**Problem:** The working tree contains an uncommitted fix to `src/app/patient/schedule/page.tsx`. The original `hasPrior` check treated any confirmed/completed appointment as proof the patient is not new — meaning a patient who had only a follow-up (no initial) would incorrectly be considered not-new and would never see the initial consultation option. The fix narrows the check to only initial consultation appointments.

**The unstaged diff (already in working tree — no code to write):**
```diff
- (a: any) => a.status === 'confirmed' || a.status === 'completed'
+ (a: any) =>
+     (a.status === 'confirmed' || a.status === 'completed') &&
+     (a.appointment_types?.name || '').toLowerCase().includes('initial')
```

**Files:**
- Modify: `src/app/patient/schedule/page.tsx:149–152` (already modified, just needs committing)

- [ ] **Step 1: Verify the diff is as expected**

```bash
cd /Users/deriklolli/Projects/WOMENKIND/WomenKind && git diff src/app/patient/schedule/page.tsx
```
Expected: only the `hasPrior` check change shown above — no other modifications.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/patient/schedule/page.tsx
git commit -m "Scope isNewPatient detection to initial consultation appointments only"
```

---

## Verification

- [ ] Run `npx tsc --noEmit` — 0 errors
- [ ] In dev, open the patient dashboard and navigate to the inline schedule view. With no appointments loaded, confirm initial consultation is visible in the type selector immediately (not hidden until data loads).
- [ ] On the `/patient/schedule` page, confirm a patient who has only a follow-up visit is treated as a new patient and sees the initial consultation option.
