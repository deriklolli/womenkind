# WomenKind — Claude Code guidance

## Stack
- Next.js 14 App Router on Vercel (prod: `womenkind.vercel.app`, auto-deploys from `main`)
- Supabase **Auth only** — all app tables live on AWS RDS PostgreSQL, accessed via Drizzle ORM
- RDS accepts connections from the Vercel network only — local scripts against prod DB will ECONNREFUSED
- AWS Bedrock for AI brief generation (see `src/lib/bedrock.ts`)

## Deploying
- Push to `main` triggers an auto-deploy. For manual deploys: `vercel deploy --prod`.
- When setting Vercel env vars, **always** use `printf '%s' 'value' | vercel env add NAME production`. `echo` appends `\n` which silently breaks AWS SDK calls (misleading "not authorized" / "invalid header" errors).

## AWS Bedrock
- Model: `us.anthropic.claude-sonnet-4-6` (`us.` prefix required — cross-region inference profile)
- IAM user: `womenkind-app` (account `695385417786`), policies: `AmazonBedrockFullAccess` + `AmazonS3FullAccess`
- Env vars on Vercel: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=us-west-2`, `BEDROCK_MODEL_ID`
- `src/lib/bedrock.ts` uses **explicit** credentials, not the default chain (Vercel's `VERCEL_OIDC_TOKEN` interferes)
- Brief pipeline: `/api/intake/submit` → `generateClinicalBrief()` → `invokeModel()` → writes `intakes.ai_brief`
- **Every route that calls Bedrock must have `export const maxDuration = 300`** — Vercel's default 10s kills Bedrock calls silently. Routes: `intake/submit`, `intake/regenerate-brief`, `generate-briefs`, `visits/webhook/transcription`. Others (chat, visit-prep, ai-notes, stripe webhook) use 60s.
- Brief generation uses `maxTokens: 8192` — full intake answers can exceed 4096 tokens and Bedrock will hard-error (not truncate silently)
- `/api/generate-briefs` is protected by `GENERATE_BRIEFS_SECRET` env var — call it to manually regenerate missing briefs. The secret is set in Vercel (not in local env files).
- Intakes only appear in the provider queue **after** a brief is generated — no need for recovery UX on the brief viewer page

## S3 Recordings
- Bucket: `womenkind-recordings` (us-west-2), used for ambient (in-office) recordings
- CORS: allows `*` origins, methods PUT/GET/HEAD, headers `*` — required for browser direct upload via pre-signed URL
- Video call recordings go to Daily.co's own S3 (`daily-meeting-recordings`), not this bucket
- `src/lib/s3.ts` — `getUploadUrl()` (pre-signed PUT), `getDownloadUrl()` (pre-signed GET for AssemblyAI)
- S3 client uses **explicit** credentials (same reason as Bedrock — Vercel's `VERCEL_OIDC_TOKEN` poisons the default chain, producing pre-signed URLs that return 403 when AssemblyAI tries to download them)

## Recording → Transcription Pipeline
- **In-office**: browser → pre-signed S3 PUT → `/api/visits/ambient-recording` → AssemblyAI → `/api/visits/webhook/transcription`
- **Video call**: Daily cloud records → Daily fires `recording.ready-to-download` webhook → `/api/visits/webhook/recording` → AssemblyAI → `/api/visits/webhook/transcription` → Bedrock SOAP note → `encounter_notes` table
- `WEBHOOK_SECRET` must be set in Vercel — AssemblyAI sends it as `x-webhook-secret`, Daily signs with HMAC-SHA256 (`x-daily-signature` + `x-daily-timestamp`)
- Daily webhook registered at: `https://api.daily.co/v1/webhooks` (no `event_types` filter — Daily API doesn't support it; all events go to one endpoint); URL must be `https://www.womenkindhealth.com/api/visits/webhook/recording`
- Debug endpoints: `/api/debug/reprocess-transcripts` (re-fires stuck AssemblyAI jobs), `/api/debug/create-test-video-appointment` (creates Daily room + appointment for testing)
- Cloud recording starts automatically via Daily's `enable_recording: 'cloud'` room property when participants join — do NOT call `startCloudRecording()` at booking time (nobody is in the room yet, it conflicts)

## Auth / test accounts
- Provider: `josephurbanmd@gmail.com` / `password123`
- Patient `dlolli@gmail.com` password is **not** `password123` — ask the user if you need to log in as that account
- Signup flow is fully server-side (`/api/auth/signup`): admin client with `email_confirm: true` skips Supabase SMTP, creates RDS `profiles` + `patients` rows immediately, signs in server-side, sends welcome email via Resend
- Patient signup link on the login page goes to `womenkindhealth.com/signup` (marketing site), not the in-app `/signup` route
- `getServerSession()` checks **providers before patients** — if a user has both rows (can happen accidentally), they resolve as provider. `/api/auth/create-patient` guards against creating a patient row for a provider account.

## Patient Dashboard
- Entry: `src/app/patient/dashboard/page.tsx` — `PatientLayout` (`src/app/patient/layout.tsx`) gates auth; dev bypass via `process.env.NODE_ENV === 'development'` in both files
- Demo data: `DEMO_PATIENT` constant in the page; fixture visits/prescriptions from `devFixtures.patientProfile['fx-p-1']` (NOT `devFixtures.patients`)
- Dashboard phase logic: any submitted intake (`intakeStatus !== 'draft'`) → full dashboard immediately. Patients no longer need to view the presentation first (removed gate per patient feedback)
- Schedule appointment card: dark aubergine card at top of right column; only renders when `appointments.length === 0 && !appointmentsLoading`; calls `setActiveView('schedule')` on click
- Right column main content: `PatientOverview` (`src/components/provider/PatientOverview.tsx`) — shared between provider patient profile and patient dashboard
- `overviewIntake` state initialized with `DEMO_INTAKE` via lazy initializer (`process.env.NODE_ENV === 'development' ? DEMO_INTAKE : null`) to avoid async timing issues where state would be null on first render
- `overviewVisits` is loaded from `/api/patient/me` response (`me.visits`) in production — dev uses fixtures. Both must stay in sync when adding new visit fields.
- Left nav: `QuickActions` (`src/components/patient/QuickActions.tsx`) — primary actions include Dashboard, Symptom Tracker, Book Appointment, Request Rx Refill, Message Dr. Urban

## PatientOverview component (`src/components/provider/PatientOverview.tsx`)
- Shared between provider patient profile and patient dashboard
- `ALL_DOMAINS`: 10 health topics (Vasomotor, Sleep, Energy, Mood, Hormonal, Cognition, Bone Health, Metabolism, Libido, Cardiovascular)
- Default 4 shown: `DEFAULT_DOMAIN_KEYS = ['vasomotor', 'sleep', 'energy', 'mood']`
- `+` button next to "Areas of focus" opens a multi-select dropdown to customize which topics display
- Overall score label: **"Your Womenkind Score"** (branded, no date) — `isInitialState` (no visits) shows "Based on WMI" pill + WMI-band headline; active state (visits exist) shows delta chip + treatment-progress headline
- Domain cards are driven by visit `symptom_scores` (set via check-in), NOT WMI scores. WMI drives the top-level score number only.
- Domain card values are domain-appropriate: vasomotor shows episode count, sleep shows hrs, cardio shows episode count or "None", others show `X / 5`
- Score summary copy driven by `latestIntake.ai_brief.summary` — pass a seeded intake from the patient dashboard to show copy below the trend chip
- Body text below score capped at 2 sentences + `line-clamp-4` (patient view uses `patient_blueprint.overview`, provider view uses `symptom_summary.overview`)
- Props: `showCheckin`, `onCheckinComplete`, `liveWmi` (overrides WMI score when present), `onDomainsChange` (fires `string[]` on domain toggle — synced to `chartDomains` state in dashboard which feeds PillarTrendChart)
- `liveWmi` score resolution: `liveWmi → intakeWmi → visitOverall`. When live score is showing, displays "Live score · Last check-in: [date]" label.
- `hasWearable` state: fetched from GET `/api/daily-checkin` response; passed to `DailyCheckinModal` to skip sleep/energy questions when Oura data is present

## Daily Check-in
- Route: `GET /api/daily-checkin` (has today checked in? returns `{ checkedIn, visit, hasWearable }`), `POST /api/daily-checkin` (submit scores)
- Component: `src/components/patient/DailyCheckinModal.tsx` — domain-specific input types per question
- **Domain input types**: vasomotor → counter 0–20 (episode count), sleep → hours stepper 0–12 (skipped if wearable), energy → 1–5 slider (skipped if wearable), cardio → binary toggle + episode counter, all others → 1–5 burden slider
- 5 is always bad for sliders; vasomotor/cardio/sleep use raw counts/hours stored directly
- Wearable-adaptive: `hasWearable=true` skips sleep + energy questions (Oura covers them passively)
- Stored in `visits` table with `source='daily'`, `visit_type='daily_checkin'`, `appointment_id=null`
- One check-in per day enforced by partial unique index: `visits_patient_daily_unique ON visits(patient_id, visit_date) WHERE source = 'daily'`
- Provider is required for the visit row — POST handler queries the first active provider as a placeholder
- **Dev bypass**: both GET and POST return mock data immediately when `NODE_ENV === 'development'`
- Debug: `POST /api/debug/reset-daily-checkin {"email": "..."}` — deletes today's daily check-in so the patient can re-answer

## Pillar Trend Chart (`src/components/patient/PillarTrendChart.tsx`)
- Replaces `SymptomTrendChart` on both the patient dashboard and scorecard (Symptom Tracker) views
- Props: `patientId: string`, `activeDomains: string[]` (mirrors symptom tracker card selection), `initialDomain?: string`
- `activeDomains` is lifted state (`chartDomains`) in the dashboard — PatientOverview fires `onDomainsChange`, dashboard updates `chartDomains`, chart dropdown updates. Adding/removing a domain card in the tracker immediately adds/removes it from the chart dropdown.
- Data source: `GET /api/patient/pillar-trend?patientId=X` — returns 24 weekly series for all 10 domains + milestones
- Score normalization: check-in burden (1–5, 5=worst) → display (0–10, 10=best). Vasomotor count (0–20) → `10 - (count/15)*10`. Sleep hours → `(hours/9)*10`. Wearable `sleep_score`/`readiness_score` (0–100) → `/10`.
- **Wearable data**: production API queries `wearable_metrics` for `sleep_score` (→ sleep domain) and `readiness_score` (→ energy domain) in preference to check-in values
- Milestones derived from: provider visits (deduplicated by date) + prescriptions (same-week rxs merged into one pin)
- SVG chart: bezier area fill, baseline dashed marker, numbered medallion pins on dashed stems, 4-card annotation rail (first 3 milestones + most recent), bidirectional hover between pins and cards
- X-axis: relative week labels (START / WK 6 / WK 12 / WK 18 / NOW) — always covers last 24 weeks up to today
- Y-axis: 0–10, higher = better (scores are inverted from burden scale)
- Dev returns fixture data with 10 domains and 5 milestones; `activeDomains[0]` guarded with optional chaining (`?.`) to handle undefined prop on first render
- Debug: `GET /api/debug/patient-trend-data?email=...` — dumps check-ins, wearable metric types, prescriptions, visits for a patient

## WMI Scoring
- `src/lib/wmi-scoring.ts` — `computeWMI(answers)` deterministic scoring from intake, stored in `intakes.wmi_scores`
- `computeLiveWMI(checkins, wearableMetrics?)` — rolling 7-day score from daily check-ins; wearable-first for sleep/energy
- Per-domain normalization: vasomotor count → `min(avg,15)/15`; sleep hours → `max(0, 7-hrs)/7`; cardio count → `min(avg,5)/5`; others → `(avg-1)/4`. Backward-compat heuristic: if value ≤ 5 and none are 0, treat as legacy 1–5 burden.
- `liveWmi` returned from `/api/patient/me` and `/api/provider/patients/[id]` — passed as prop to PatientOverview
- Intakes submitted before `computeWMI()` was added will have `wmi_scores: null` — use `/api/debug/recompute-wmi-by-email` to backfill

## Sentry
- Org: `lolliprojects`, project: `javascript-nextjs`
- Auth token stored in Claude memory (`reference_sentry.md`) — can query issues directly via API without screenshots
- Query unresolved issues: `GET https://sentry.io/api/0/projects/lolliprojects/javascript-nextjs/issues/?query=is:unresolved`
- Get full stack trace: `GET https://sentry.io/api/0/issues/{id}/events/latest/`

## Patient Engagement System

Built 2026-04-29. Proactive email + in-app notification system to prevent patient drop-off.

### New DB tables (migrated to prod)
- `engagement_log` — deduplication/audit log for every sent message. `alreadySentRecently()` queries this to enforce frequency caps.
- `notification_preferences` — per-patient opt-out toggles (3 boolean categories). No row = all defaults on (implicit opt-in).

### Core helper: `src/lib/engagement.ts`
- `alreadySentRecently(patientId, triggerType, withinDays)` — frequency cap check via `engagement_log`
- `logEngagement(patientId, triggerType, channel, metadata?)` — write to `engagement_log`
- `isEngagementEnabled(patientId, triggerType)` — checks `notification_preferences`; clinical triggers (`rx_refill`, `lab_results_ready`) always return true (not in category map)
- `generateUnsubscribeToken(patientId)` / `verifyUnsubscribeToken(patientId, token)` — stateless HMAC-SHA256 using `CRON_SECRET`
- `buildEngagementEmail(params)` — shared HTML builder; injects unsubscribe + manage-preferences footer links in every email

### Cron routes (vercel.json registered)
| Route | Schedule | Trigger |
|-------|----------|---------|
| `/api/engagement/weekly-nudge` | `0 14 * * 1` (Mon 8am MT) | Send nudge if no check-in this week |
| `/api/engagement/monthly-recap` | `0 14 1 * *` (1st of month 8am MT) | WMI trend + top domain + check-in count |
| `/api/engagement/daily-scan` | `0 15 * * *` (daily 9am MT) | 4 checks: missed check-ins (14d), no login (30d), rx refill (7d window), post-visit (47–71h after visit) |

All cron routes use `GET` + `Authorization: Bearer ${CRON_SECRET}`.

### Event hooks
- `POST /api/daily-checkin` — fire-and-forget score-drop check after insert: if new WMI < prev WMI × 0.80, sends email + in-app notification (3-day cap)
- `POST /api/canvas/labs/result` — marks `lab_orders.status='resulted'`, sends email + in-app notification

### Notification preferences API
- `GET /api/patient/notification-preferences` — returns prefs (defaults all true if no row)
- `PATCH /api/patient/notification-preferences` — upserts row; accepts `checkin_reminders`, `progress_updates`, `care_alerts` booleans
- `GET /api/engagement/unsubscribe?patientId=X&token=Y` — no-auth one-click unsubscribe; sets all 3 categories false, renders HTML confirmation page

### Settings UI
Notifications tab in `src/components/patient/PatientSettings.tsx` — 3 wired toggle rows backed by the preferences API. Note on bottom: prescription refill and lab result notifications always sent.

### Email PHI notes
- Medication names appear in email **body only** (not subject) — acceptable under HIPAA treatment operations, but requires a BAA with Resend. BAA is in progress as of 2026-04-30.
- Subjects are deliberately neutral: score-drop → "A message from your care team", refill → "Time to request a refill"
- Two borderline subjects flagged but left as-is pending user decision: post-visit ("How are you feeling after your visit?") and lab results ("Your lab results are ready")
- Email preview page: `/admin/email-preview` — renders all 8 templates with sample data, flags PHI notes inline

### Key gotchas
- `profiles` table has **no** `last_sign_in_at` column — the no-login check uses `supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })` to build a Map of `profile_id → last_sign_in_at`
- `visits.symptom_scores` comes back as `unknown` from Drizzle — cast to `Record<string, number> | null` before passing to `computeLiveWMI()`
- Migration route: `POST /api/debug/migrate-engagement` with `x-migration-secret: $CRON_SECRET` (already run on prod 2026-04-30)

## PostgreSQL / Drizzle gotchas
- `ORDER BY submitted_at DESC` puts NULLs **first** in PostgreSQL — always add `ne(intakes.status, 'draft')` when querying intakes to avoid a null-submitted_at draft masking the real intake
- Both `/api/patient/me` and `/api/provider/patients/[id]` filter `ne(status, 'draft')` for this reason

## Working style
- User is a solo, non-developer founder. Keep explanations short. Do the work, don't narrate plans.
- Never ask the user to edit `.env.local` or paste keys into Vercel UI — do it from the CLI.
- Tight debug loops: when stuck, write a debug endpoint that dumps all suspect values in one response rather than probing fields one at a time.
- Don't promise "I'll wake up in N seconds" — just take the next action.
- **Verify all work before asking the user to take any action.** Run tsc, check logs, confirm DB state, trace the full end-to-end flow. Never ask the user to test something until every step has been verified independently. Incomplete fixes that require follow-up user testing waste the user's time.
