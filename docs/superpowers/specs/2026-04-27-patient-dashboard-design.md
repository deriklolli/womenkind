# Patient Dashboard Design

**Status:** Draft for review
**Date:** 2026-04-27
**Owner:** Derik
**Implementation handoff:** This spec will be passed to claude-design for frontend execution.

---

## Context

The WomenKind patient dashboard is the patient's home base after they sign up and complete intake. Today the dashboard is phase-aware (intake → appointment → care plan viewed) but treats every patient state with the same general layout, mixes "what to do next" with "how am I doing" without clear hierarchy, and doesn't yet integrate the WMI score, phenotype, or the new tracker concepts.

This spec defines:
1. The dashboard's job (action-first, health-story-second)
2. The five lifecycle states the dashboard supports
3. The page structure (hero + supporting sections)
4. The dynamic-rotation rule for the steady-state hero card
5. Empty-state behavior so the page shape never changes
6. The design conventions to follow for visual implementation

Out of scope for v1: the wins board (cut for later), mobile weekly check-in flow (separate tracker spec), provider-side tracker (separate spec), lapse detection logic beyond a simple "no check-in in N weeks" rule.

---

## Design Direction

**Action-first, health story below.**

Every state shows one primary action at the top of the page (the hero card), followed by a health-story stack (WMI score, trend chart, domain cards, timeline). The hero is what the patient came to do. The health story is the reward for engaging.

Rationale: most healthcare dashboards default to "data first" and become graveyards. The patient's recurring reason to log in is to *do* something — book, prep, log, refill, message. The health story is the longitudinal payoff that makes the doing feel worth it.

---

## Lifecycle States

The dashboard supports **five states**. The patient progresses through them roughly linearly, but can re-enter S5 ↔ S6 indefinitely.

A loading spinner covers the gap between intake submission and brief generation (~30s–2min). No designed state is needed for that interval.

| State | Trigger | Hero card |
|---|---|---|
| **S2 — Brief ready, no appointment booked** | `intake.ai_brief` exists AND `appointments.length === 0` | **Book your initial consultation** |
| **S3 — Appointment booked, pre-visit** | `appointments[0].starts_at > now` | **Prep for your visit** (countdown + pre-visit check-in CTA; swaps to "Join video call" within 15 min of start) |
| **S4 — Post-visit, awaiting care plan** | Most recent visit ended < 48hrs ago AND no new `encounter_notes` finalized OR no new prescription posted | **Status card** (read-only): "Dr. Urban is finalizing your care plan." No CTA. |
| **S5 — Active treatment (steady state)** | Patient has a finalized care plan AND no overdue/upcoming actions in the last 7 days | **Rotating action** (see priority order below) |
| **S6 — Lapsed** | No weekly check-in in ≥ 21 days | **Re-engagement check-in**: "It's been 3 weeks. Quick 60-second check-in?" |

**State precedence** (when more than one applies): S3 > S6 > S4 > S2 > S5. An upcoming visit beats lapsed (a patient with a visit on the calendar isn't meaningfully lapsed even if they haven't checked in); lapsed beats post-visit reassurance; brief-ready-but-no-appt only applies before any visit has occurred.

---

## S5 Hero — Rotation Priority

When the patient has already completed their weekly check-in, the hero card rotates to the highest-priority overdue/upcoming item. **Single item only — no stacking.**

Priority order (top wins):

1. **Refill running out in ≤ 3 days** — `prescriptions.runs_out_at - now ≤ 72hrs`
2. **Follow-up appointment overdue** — provider recommended a follow-up by date X, X has passed, no booking
3. **Unread message from Dr. Urban** — `messages.read_at IS NULL` AND sender is provider
4. **New lab results posted** — `lab_results.posted_at > last_dashboard_visit`
5. **Follow-up appointment recommended (not yet overdue)** — softer nudge
6. **Care plan updated** — new `health_blueprint` version posted since last view
7. **All caught up (fallback)** — show "you're on track" trend summary

If none of 1–6 apply and the weekly check-in is *not* yet done this week, the hero is **"Log this week's symptoms"** (the default S5 hero).

---

## Page Structure

The page uses the same skeleton across all states. Sections fill in progressively as the patient accumulates data — they never disappear. Empty sections show a placeholder ("Your trend will appear here after your first visit") rather than collapsing.

```
┌────────────┬────────────────────────────────────────┐
│            │  HERO CARD (full-width, dynamic)       │
│            ├────────────────────────────────────────┤
│  LEFT NAV  │  WMI SCORE STRIP                       │
│  (existing │  "73 / Thriving — up 8 from intake"   │
│  Quick     ├────────────────────────────────────────┤
│  Actions)  │  SYMPTOM TREND CHART (multi-line)      │
│            ├────────────────────────────────────────┤
│            │  DOMAIN CARDS (2-col grid, 6 domains)  │
│            ├────────────────────────────────────────┤
│            │  TIMELINE STRIP (visits + milestones)  │
│            └────────────────────────────────────────┘
```

Left nav: keep existing `QuickActions` component as-is. No structural changes in this spec.

### Section behavior across states

| Section | S2 | S3 | S4 | S5 | S6 |
|---|---|---|---|---|---|
| Hero | Book consult | Prep / join visit | Read-only status | Rotating action | Re-engagement |
| WMI strip | ✓ from intake | ✓ | ✓ | ✓ | ✓ ("last updated N weeks ago") |
| Trend chart | Placeholder ("appears after first visit") | Placeholder | ✓ if visit added scores | ✓ | ✓ (no special lapse styling for v1) |
| Domain cards | ✓ baseline values from intake | ✓ same | ✓ updated if scored | ✓ | ✓ |
| Timeline strip | ✓ "intake complete" only | ✓ + "visit scheduled" | ✓ + "visit complete" | ✓ full | ✓ full |

S6 renders identically to S5 except for the hero. No faded chart sections, no special staleness UI for v1.

---

## Section Specs

### Hero Card

- Full-width card, `rounded-card` (20px), top of main column.
- **S2 / S5-default ("Log this week's symptoms") / S6:** dark aubergine background (`bg-aubergine`), white text, primary CTA pill button on the right (`bg-violet text-white rounded-pill px-7 py-3.5`). Same visual treatment as the existing "Schedule appointment" card on today's dashboard.
- **S3 (pre-visit):** white card with violet accents. Countdown ("Your visit is in 3 days") in serif `text-3xl text-aubergine`. Primary CTA: "Complete pre-visit check-in" → swaps to "Join video call" within 15 min of `starts_at`.
- **S4 (post-visit):** cream background (`bg-cream`), no CTA. Headline in serif. Body text: "Dr. Urban is reviewing your visit and finalizing your care plan. You'll be notified when it's ready (typically within 48 hours)."
- **S5 rotating items 1–6:** white card, status-colored left border (`border-l-4`):
  - Refill: `border-amber-600`
  - Overdue follow-up: `border-red-600`
  - Unread message: `border-violet`
  - New labs: `border-emerald-600`
  - Recommended follow-up: `border-aubergine/30`
  - Care plan updated: `border-violet/40`
- **S5 fallback (all caught up):** cream background, no CTA, single line: "You're on track. Your next check-in is due [date]."

### WMI Score Strip

Slim single-line band, not a card. Sits directly below hero with `mt-6`.

```
{score} / {wmi_label}  —  {trend_phrase}
73 / Thriving  —  up 8 from intake
```

- Score: serif `text-5xl text-aubergine`, label in serif `text-xl italic text-violet`.
- Trend phrase: sans `text-sm text-aubergine/60`. Generated from comparing current `wmi_scores.wmi` to the intake baseline (e.g., "up 8 from intake", "steady since last visit", "down 3 — let's check in").
- No card chrome. Bottom border: `border-b border-aubergine/5` to separate from chart below.

**Provisional** — user wants to see it in implementation before finalizing. May be removed if redundant with chart.

### Symptom Trend Chart

Multi-line chart following the tracker spec (`docs/womenkind-tracker-spec.md`).

- 6 domains: Vasomotor, Sleep, Mood, Energy, Cognition (Brain Fog), GSM.
- Y-axis: 0–10 (higher = better, baseline-inverted from intake severity).
- X-axis: last 12 weeks (or full history if shorter).
- Data sources: intake baseline (week 0) + visit `symptom_scores` + future weekly check-ins.
- Line styling: use the GradientSparkline pattern from `PatientOverview.tsx` (gradient fill below line, end-dot stroke). Each domain gets its color from the existing domain palette in `PatientOverview`.
- **Empty state (S2/S3):** show axes + a single baseline marker at week 0 with copy "Your trend will appear here after your first visit."

### Domain Cards

Reuse the existing **score chip pattern** from `PatientOverview.tsx` (lines ~285–336). 2-column grid on desktop, 1-column on mobile.

- 6 cards, one per tracker domain (Vasomotor, Sleep, Mood, Energy, Cognition, GSM).
- Each card: colored top border, icon, current score `/10`, sparkline, status pill (improving/steady/watch).
- Pre-visit (S2/S3): show baseline values from intake with status pill = "baseline" in a neutral aubergine/5 tone.

### Timeline Strip

Horizontal strip below domain cards. Compact pill markers on a horizontal line.

- Markers in chronological order: Intake complete → Initial consultation → Treatment start → Follow-up visit(s) → Most recent check-in.
- Active marker (most recent event): violet fill, white text. Past markers: white fill, aubergine/40 text. Future/scheduled markers: dashed border.
- On hover/tap: tooltip with date and short note ("Visit on Apr 12 — started HRT").
- This is a compact informational element, not a primary interaction. Click-through to a fuller history view is out of scope for v1.

---

## Design Conventions Reference

This spec assumes claude-design will follow the existing WomenKind design system. Key tokens:

**Colors** (from `tailwind.config.*`):
- `aubergine` `#280f49` — primary text, dark surfaces
- `violet` `#944fed` — accent, active states, primary CTA
- `cream` `#f7f3ee` — soft backgrounds (S4 hero, info surfaces)
- Status: `emerald` (improving), `amber` (watch), `red` (urgent)
- Opacity scale: `/5`, `/10`, `/40`, `/60` for layered hierarchy

**Typography:**
- Sans: `Plus Jakarta Sans` (body, UI)
- Serif: `Vogun` / `Playfair Display` (headings, scores, hero copy)
- Italic violet accent word in section headings (e.g., "Your *trend*")

**Surfaces:**
- `rounded-card` = 20px (cards)
- `rounded-pill` = 9999px (status pills, CTAs)
- `rounded-brand` = 8px (small UI)
- Standard card: `bg-white rounded-card shadow-sm border border-aubergine/5 p-6`
- Vertical rhythm between sections: `space-y-6` to `space-y-8`

**Components to reuse (do not rebuild):**
- Score chip / domain card → `PatientOverview.tsx`
- Status pill → `QuickActions.tsx`
- Primary CTA pill button → `.btn-primary` global class
- Section heading with italic accent → recurring pattern in `PatientOverview` and `ClinicalBriefView`

---

## Critical Files to Modify

- `src/app/patient/dashboard/page.tsx` — main page; replace existing right-column layout with the skeleton above; add state-detection logic
- `src/components/patient/QuickActions.tsx` — no changes (left nav stays)
- New: `src/components/patient/DashboardHero.tsx` — accepts `state` and renders the appropriate hero variant
- New: `src/components/patient/WMIStrip.tsx` — slim score band
- New: `src/components/patient/SymptomTrendChart.tsx` — multi-line chart per tracker spec
- New: `src/components/patient/TimelineStrip.tsx` — horizontal milestone strip
- Reuse: existing `PatientOverview.tsx` score-chip pattern for domain cards (extract a `DomainScoreCard` if not already separate)

State-detection logic should live in a small helper (e.g., `src/lib/patient-dashboard-state.ts`) that takes `{ intake, appointments, prescriptions, messages, labs, blueprintVersions, lastCheckinAt }` and returns `{ state: 'S2' | 'S3' | 'S4' | 'S5' | 'S6', heroAction: <discriminated union> }`. This keeps the page component declarative.

---

## Open Data Dependencies

The following data points are referenced by the rotation logic but may not yet exist in the schema. Implementation plan will need to confirm and add fields/tables as needed:

- **`weekly_checkins` table** — needed for "Log this week's symptoms" detection and S6 lapse detection. Already specified in `docs/womenkind-tracker-spec.md`; not yet built.
- **Recommended follow-up date** — referenced by S5 priority items 2 and 5. Needs a field on `encounter_notes` or `appointments` (e.g., `next_follow_up_due_at`) that the provider sets after a visit.
- **Last-viewed timestamps** — referenced by "new lab results" and "care plan updated" rotation items. Needs either a `patient_dashboard_views(patient_id, last_viewed_at)` table or per-resource `viewed_at` flags.
- **Care plan version** — `health_blueprint` updates need a comparable version field or `updated_at` to detect "new since last view."

These are flagged here, not solved here — they're implementation work, not design decisions.

---

## Verification

End-to-end checks (manual, in dev):

1. **S2** — Submit a new intake as a fresh patient; confirm dashboard shows "Book your initial consultation" hero, WMI strip from intake scores, domain cards with baseline values, empty trend chart with placeholder copy.
2. **S3** — Book an appointment; confirm hero swaps to countdown + "Complete pre-visit check-in." Force `starts_at` within 15 min and confirm CTA swaps to "Join video call."
3. **S4** — Mark a visit as ended in the last 48hrs with no finalized encounter notes; confirm read-only status hero in cream.
4. **S5** — With finalized care plan and no overdue items, confirm hero is "Log this week's symptoms." Then seed each rotation case (refill <3d, overdue follow-up, unread message, new lab, recommended follow-up, blueprint update) one at a time and confirm correct hero appears in priority order.
5. **S6** — Set `last_checkin_at` to 22 days ago; confirm hero swaps to re-engagement check-in.
6. **State precedence** — Combine S3 (upcoming visit) + S5 (refill due in 2 days); confirm S3 wins. Combine S6 + S3; confirm S6 wins.
7. **Empty-state shape** — Confirm trend chart and domain cards render their placeholder/baseline state in S2 without collapsing.
8. **Visual conformance** — Spot-check colors (aubergine `#280f49`, violet `#944fed`), card radius (20px), typography (serif headings, sans body), and reuse of existing score-chip pattern.
