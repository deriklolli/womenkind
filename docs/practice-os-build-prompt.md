# Practice OS Build Plan — Prompt for Claude Code

Paste the section below into Claude Code (with superpower or your planning workflow of choice). It's self-contained and assumes no prior conversation context.

---

## Prompt

You are planning the next phase of builds for Womenkind, the telehealth midlife women's care platform. Read `CLAUDE.md` at the repo root first — it has the full stack, schema, deployment, and architectural context you need. Then read `src/lib/auth.ts`, the `src/db/schema/*` files, and a sample of the provider routes under `src/app/api/provider/` to ground yourself in the current auth and data model before planning.

### Background

The platform is currently built around a binary user model: `provider` (essentially one physician, Dr. Joseph Urban) and `patient`. Builds 1–10 are complete and demoable. The next phase needs to turn Womenkind from a single-physician demo into a multi-staff clinical operating system that supports a real practice — physicians, NPs, RNs, MAs, admin, concierge — with a closed-loop task engine so no patient concern, lab result, medication change, or message falls through the cracks.

Dr. Urban produced a long ChatGPT-generated specification for a "Practice Ops Center / Command Center." The vision is directionally right but enormous and includes scope creep (SMART on FHIR, versioned clinical reference layer, AI clinical decision support, 12-tab dashboard). We are filtering it down to the high-value core and sequencing it into three builds.

### Strategic constraints (do not violate)

- Build for a solo non-developer founder. Sequence work so each build is shippable and demoable on its own. No 12-week monoliths.
- Reuse what we already have. Engagement system (cron + email + in-app notifications), WMI scoring, daily check-ins, pillar trend chart, ambient/video transcription, AWS Bedrock briefs, lab orders, encounter notes, Sentry — all stay. None of this gets rewritten.
- Defer the following from Dr. Urban's plan: SMART on FHIR / FHIR resource mapping, versioned clinical-reference layer, AI clinical decision support that generates suggested diagnoses or action plans (regulatory minefield), service-recovery analytics dashboard, outcomes analytics dashboard, 12-tab UI. These can be revisited after the core ships and we have real multi-staff usage.
- AI is allowed for: patient one-liners, "what changed since last MD review" summaries, draft patient communication (with provider approval before send), overdue/orphaned task detection. AI is NOT allowed for: clinical decisions, diagnoses, action plans, autonomous closure of clinical tasks.
- HIPAA: every PHI access and every clinical task state change must be audit-logged.
- Closed-loop task model is non-negotiable: every actionable item becomes a task with owner, backup owner, priority, due date, acknowledgment, completion note, and audit trail. Red tasks cannot close without MD acknowledgment. Overdue tasks escalate. No task jumps from "new" to "closed."

### What to plan

Three builds, in order. For each one, produce: (1) goal statement, (2) data model changes (new tables, column additions, enum changes, migrations), (3) API routes (new + modified), (4) UI surfaces (new pages, new components, modifications to existing components like `PatientOverview`, `QuickActions`, provider patient profile), (5) integration points with existing systems (engagement cron, AI brief pipeline, lab orders, visits, daily check-ins), (6) testing/verification checklist, (7) realistic time estimate.

#### Build 16 — Practice OS Foundation

Goal: zero unassigned actionable items. Multi-staff auth, closed-loop tasks, audit logging, MD Today + RN Queue dashboards.

Required scope:
- Expand the user model from binary `provider/patient` to role-aware: MD, NP, RN, MA, Admin, Concierge, Patient. Update `getServerSession()`, route guards, and every `/api/provider/*` route to check role, not just "is provider."
- New `tasks` table with: id, patient_id, category (clinical / lab / med / message / rn_escalation / service / admin), priority (red / orange / yellow / blue / gray), status (new / acknowledged / in_progress / waiting_patient / waiting_md / waiting_lab / resolved / closed), owner_staff_id, backup_owner_staff_id, source (patient_message / lab_result / score_drop / refill_window / missed_checkin / post_visit / ai_brief / manual), source_ref, due_at, acknowledged_at, closed_at, close_out_note, follow_up_task_id, requires_md_signoff, patient_notified, created_at, updated_at. Enforce status transitions at the API layer (no skipping new→closed; red requires MD ack before close).
- New `audit_events` table: append-only, captures PHI access + task state changes + clinical actions. user_id, action, resource_type, resource_id, metadata jsonb, ip, user_agent, created_at.
- Event sources fan out into tasks: extend existing handlers to create tasks alongside their current behavior. Specifically: lab result webhook creates "review lab" task; patient message inbound creates "review message" task; score-drop detection in `/api/daily-checkin` creates "review symptom worsening" task; refill window cron creates "patient needs refill" task; missed-checkin cron creates "outreach" task; post-visit cron creates "post-visit follow-up" task.
- Role-based dashboard views: `/provider/today` (MD Today — red tasks, MD decisions, labs needing review, RN escalations), `/staff/rn-queue`, `/staff/admin-queue`. Reuse existing UI primitives; do not build a custom design system.
- Task acknowledgment + closure UI: every task row has acknowledge button, status dropdown, close-out modal that requires close-out note and "follow-up needed?" prompt.
- SBAR RN escalation form: typed fields (Situation / Background / Assessment / Recommendation), creates an orange or red task assigned to the on-call MD.

Out of scope for Build 16: AI-drafted summaries, AI-drafted replies, service recovery analytics, FHIR mapping, patient-facing changes.

#### Build 17 — Patient Cockpit + Medication Change Tracker

Goal: physician can understand a complex patient in under 60 seconds. Med changes auto-generate the standard follow-up cadence as tasks.

Required scope:
- Unified Patient Cockpit view in the provider portal: top-of-screen one-liner ("52F, postmenopausal, uterus present, on E2 patch + micronized P4, 6 weeks after E2 increase, symptoms improving"), "what changed since last MD review" panel (diffs symptom scores, new labs, new messages, med changes, RN notes since `last_md_review_at`), active task list for this patient, then progressive disclosure for medication timeline, symptom trend, labs, messages, visit notes.
- Medication-change tracker: when a prescription is started/changed/stopped, auto-create the follow-up cadence as tasks: day 3–7 (RN — confirm patient understood plan, no urgent side effects), week 4 (RN — early check-in), week 8 (RN/MD — trend review), week 12 (MD — meaningful response review), annual (MD/RN — benefit/risk).
- Hook existing engagement crons (weekly nudge, monthly recap, daily scan, score-drop, lab-result notification) into the task table so each cron-triggered email also produces a visible work item in the appropriate staff queue. Email continues to go to the patient; task goes to staff. De-duplicate via `engagement_log`.
- `last_md_review_at` timestamp on patient profile — set when an MD closes any task with `requires_md_signoff = true` for that patient.

Out of scope for Build 17: patient-facing cockpit changes, AI summaries (those land in Build 18).

#### Build 18 — AI Augmentation (Scoped)

Goal: reduce MD cognitive load without crossing into clinical decision-making.

Required scope:
- AI patient one-liner generator: Bedrock-driven, runs on Patient Cockpit load, cached per patient until next meaningful change. Use the existing `bedrock.ts` pattern. `maxDuration = 300` on the route.
- AI "what changed since last MD review" summary: feeds the diffs from Build 17 into Bedrock, produces a 3–5 sentence summary.
- AI-drafted patient reply: when a staff member is responding to a patient message, AI generates a draft. Staff edits and approves before send. Never auto-sends.
- AI overdue/orphaned-task detection: nightly cron flags tasks past SLA, tasks without owners, patients with no `last_meaningful_touch_at`. Creates yellow housekeeping tasks for admin.

Explicitly out of scope (regulatory): AI-suggested diagnoses, AI-suggested clinical action plans, AI-suggested medication changes, AI closure of clinical tasks.

### Deliverable

Produce a single planning document (markdown) with the three builds laid out in the format described above. Include a "what we are NOT building and why" section at the end so the rationale for deferrals is preserved. Save the plan to `/Users/deriklolli/Projects/WOMENKIND/WomenKind/docs/practice-os-plan.md`.

Do not write code yet. This is a planning pass only.
