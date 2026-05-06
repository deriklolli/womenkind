# WomenKind Obsidian Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a fully populated Obsidian vault at `/Users/deriklolli/Projects/WOMENKIND/brain/` and register it in Obsidian.

**Architecture:** Eight folder sections (Technical, Product, Clinical, Business, Decisions, Bugs, Project, AI) each with an `_index.md` and topic notes. Content synthesized from existing project docs — nothing invented. A root `CONTEXT.md` serves as the Claude entry point.

**Tech Stack:** Plain Markdown, Obsidian wiki links (`[[Note]]`), registered via `~/Library/Application Support/obsidian/obsidian.json`.

---

## File Map

| File | Purpose |
|---|---|
| `brain/CONTEXT.md` | Master entry point — what is WomenKind, quick facts, vault map, Claude onboarding prompt |
| `brain/Technical/Stack.md` | Framework, hosting, DBs, AI, key env var gotchas |
| `brain/Technical/Database-Schema.md` | All RDS tables, Drizzle gotchas, connection constraints |
| `brain/Technical/API-Routes.md` | All routes, auth, maxDuration, cron schedule |
| `brain/Technical/Auth-Flow.md` | Supabase Auth + RDS, signup flow, role resolution, test accounts |
| `brain/Technical/Recording-Pipeline.md` | S3, Daily, AssemblyAI, webhook flows, debug endpoints |
| `brain/Product/Features.md` | Full feature inventory |
| `brain/Product/Patient-Journey.md` | Signup through ongoing care loop |
| `brain/Product/Provider-Workflow.md` | Provider login through SOAP note |
| `brain/Product/Engagement-System.md` | Cron nudges, score-drop, lab result triggers, PHI rules |
| `brain/Clinical/Intake-Design.md` | 54 questions, 10 sections, branching, consent gate |
| `brain/Clinical/AI-Brief.md` | Bedrock pipeline, JSON output structure, recovery |
| `brain/Clinical/WMI-Scoring.md` | computeWMI, computeLiveWMI, domain normalization |
| `brain/Clinical/Care-Model.md` | 10 health domains, treatment pathways, clinical references |
| `brain/Business/Legal-Structure.md` | MSO, Iron Gate, Frier Levitt memo, BAA status |
| `brain/Business/Pricing.md` | Intake fee, membership, follow-up rules, Stripe pass-through |
| `brain/Business/Infrastructure.md` | Assembled providers (OpenLoop, Daily, AssemblyAI, Resend, Sentry) |
| `brain/Business/Competitive.md` | Direct competitors, differentiation, Medvi reference |
| `brain/Decisions/_index.md` | Decisions log index |
| `brain/Decisions/2026-05-05-key-architecture-decisions.md` | Major architectural decisions made during the build |
| `brain/Bugs/Known-Issues.md` | Recurring gotchas and edge cases |
| `brain/Project/Roadmap.md` | Completed features, active work, upcoming priorities |
| `brain/AI/Claude-Onboarding.md` | Paste-ready Claude session starter |
| `_index.md` files (×8) | Section navigation hubs |

---

### Task 1: Create vault directory structure

**Files:** Create `brain/` at `/Users/deriklolli/Projects/WOMENKIND/brain/`

- [ ] **Step 1: Create all directories**

```bash
mkdir -p /Users/deriklolli/Projects/WOMENKIND/brain/{Technical,Product,Clinical,Business,Decisions,Bugs,Project,AI}
```

- [ ] **Step 2: Verify structure**

```bash
find /Users/deriklolli/Projects/WOMENKIND/brain -type d
```

Expected output:
```
/Users/deriklolli/Projects/WOMENKIND/brain
/Users/deriklolli/Projects/WOMENKIND/brain/Technical
/Users/deriklolli/Projects/WOMENKIND/brain/Product
/Users/deriklolli/Projects/WOMENKIND/brain/Clinical
/Users/deriklolli/Projects/WOMENKIND/brain/Business
/Users/deriklolli/Projects/WOMENKIND/brain/Decisions
/Users/deriklolli/Projects/WOMENKIND/brain/Bugs
/Users/deriklolli/Projects/WOMENKIND/brain/Project
/Users/deriklolli/Projects/WOMENKIND/brain/AI
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind add -A
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind commit -m "feat: scaffold WomenKind Obsidian brain vault structure"
```

---

### Task 2: Create CONTEXT.md (master entry point)

**Files:** Create `/Users/deriklolli/Projects/WOMENKIND/brain/CONTEXT.md`

- [ ] **Step 1: Write the file**

```markdown
# WomenKind — Brain Context

**Last updated:** 2026-05-05
**Vault location:** `~/Projects/WOMENKIND/brain/`

This is the Claude entry point for the WomenKind Obsidian vault. Read this file first to orient, then navigate to specific notes as needed.

---

## What is WomenKind?

Telehealth-first, cash-pay, physician-led menopause and midlife care platform. Patients complete an AI-powered intake, pay for a visit, and get a provider who shows up with a pre-generated clinical brief. Ongoing care runs on a $200/month membership.

---

## Quick Facts

| Fact | Value |
|---|---|
| Codebase | `~/Projects/WOMENKIND/WomenKind/` (Next.js 14) |
| Prod URL | `womenkindhealth.com` / `womenkind.vercel.app` |
| Hosting | Vercel (auto-deploys from `main`) |
| Auth | Supabase Auth only — no app tables in Supabase |
| App DB | AWS RDS PostgreSQL via Drizzle ORM |
| AI | AWS Bedrock — `us.anthropic.claude-sonnet-4-6` |
| Provider test account | `josephurbanmd@gmail.com` / `password123` |
| Patient test account | `dlolli@gmail.com` (password: ask Derik) |
| Legal entity | Iron Gate Management Services LLC (Delaware MSO) |
| Physician principal | Dr. Joseph Urban |
| CTO / builder | Derik Lolli |

---

## Vault Map

### [[Technical/_index|Technical/]]
- [[Technical/Stack]] — Framework, hosting, DB, AI, S3, Resend. Key gotchas: `printf` not `echo` for Vercel env vars; `maxDuration` on all Bedrock routes.
- [[Technical/Database-Schema]] — All RDS tables, Drizzle gotchas (NULL ordering, draft filtering), connection constraints.
- [[Technical/API-Routes]] — All routes, auth requirements, `maxDuration` values, cron schedule.
- [[Technical/Auth-Flow]] — Supabase Auth + RDS profiles, signup flow, role resolution order (providers before patients), test accounts.
- [[Technical/Recording-Pipeline]] — In-office (S3) and video call (Daily) recording flows, AssemblyAI transcription, webhook secrets, debug endpoints.

### [[Product/_index|Product/]]
- [[Product/Features]] — Full feature inventory with status.
- [[Product/Patient-Journey]] — Signup → welcome → intake → payment → dashboard → daily check-in loop.
- [[Product/Provider-Workflow]] — Provider login → patient queue → brief review → visit → SOAP note.
- [[Product/Engagement-System]] — Cron nudges, score-drop trigger, lab result trigger, frequency caps, PHI email rules.

### [[Clinical/_index|Clinical/]]
- [[Clinical/Intake-Design]] — 54 questions across 10 clinical sections, branching logic, consent gate.
- [[Clinical/AI-Brief]] — Bedrock pipeline, JSON output structure, `maxTokens: 8192`, recovery endpoint.
- [[Clinical/WMI-Scoring]] — `computeWMI()`, `computeLiveWMI()`, per-domain normalization, wearable-first logic.
- [[Clinical/Care-Model]] — 10 health domains, treatment pathways, IMS 2024 and FDA 2026 references.

### [[Business/_index|Business/]]
- [[Business/Legal-Structure]] — MSO/physician-practice model, Iron Gate LLC, Frier Levitt memo (confidential), BAA status.
- [[Business/Pricing]] — $650 intake, $200/mo membership, follow-up pricing rules, Stripe pass-through accounting.
- [[Business/Infrastructure]] — Assembled (never built): OpenLoop, Daily.co, AssemblyAI, Resend, Stripe, Sentry.
- [[Business/Competitive]] — Midi, Alloy, Gennev, Evernow, Winona. Differentiation. Medvi reference model.

### [[Decisions/_index|Decisions/]]
- [[Decisions/2026-05-05-key-architecture-decisions]] — Major architectural decisions made during the build.

### [[Bugs/_index|Bugs/]]
- [[Bugs/Known-Issues]] — Recurring gotchas, edge cases, and failure modes with fixes.

### [[Project/_index|Project/]]
- [[Project/Roadmap]] — Completed features, active work, upcoming priorities.

### [[AI/_index|AI/]]
- [[AI/Claude-Onboarding]] — Paste this at the start of any Claude session.

---

## How to Use This Vault With Claude

Paste this at the start of any Claude session:

> Read brain/CONTEXT.md. Don't summarize — just confirm you're oriented.

After reading CONTEXT.md, Claude can navigate to specific notes by asking for them or reading them directly. Update notes whenever significant decisions are made, bugs are discovered, or the roadmap changes.
```

- [ ] **Step 2: Verify file exists and is non-empty**

```bash
wc -l /Users/deriklolli/Projects/WOMENKIND/brain/CONTEXT.md
```

Expected: line count > 50

- [ ] **Step 3: Commit**

```bash
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind add /Users/deriklolli/Projects/WOMENKIND/brain/CONTEXT.md
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind commit -m "feat: add vault CONTEXT.md — master entry point"
```

---

### Task 3: Create Technical/ notes

**Files:** Create 5 notes + `_index.md` in `brain/Technical/`

- [ ] **Step 1: Write `Technical/_index.md`**

```markdown
# Technical

Stack, database, API routes, auth, and recording pipeline.

## Notes
- [[Stack]] — Framework, hosting, AI, env var gotchas
- [[Database-Schema]] — All RDS tables, Drizzle quirks
- [[API-Routes]] — All routes, auth, maxDuration, cron schedule
- [[Auth-Flow]] — Signup, session, role resolution
- [[Recording-Pipeline]] — S3, Daily, AssemblyAI, webhooks
```

- [ ] **Step 2: Write `Technical/Stack.md`**

```markdown
# Stack

## Framework & Hosting
- **Next.js 14 App Router** on **Vercel** (prod: `womenkindhealth.com`)
- Auto-deploys from `main`. Manual deploy: `vercel deploy --prod`
- **Never use `echo` to set Vercel env vars** — use `printf '%s' 'value' | vercel env add NAME production`. `echo` appends `\n` and silently breaks AWS SDK calls.

## Database
- **Supabase Auth only** — no app tables in Supabase
- **AWS RDS PostgreSQL** — all app tables, accessed via **Drizzle ORM**
- RDS accepts connections from the Vercel network only. Local scripts against prod DB will `ECONNREFUSED`.

## AI
- **AWS Bedrock** — model `us.anthropic.claude-sonnet-4-6` (`us.` prefix required for cross-region inference)
- IAM user: `womenkind-app` (account `695385417786`), policies: `AmazonBedrockFullAccess` + `AmazonS3FullAccess`
- Uses **explicit** credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) — Vercel's `VERCEL_OIDC_TOKEN` poisons the default credential chain
- **Every Bedrock route must have `export const maxDuration = 300`** — Vercel's default 10s kills Bedrock calls silently
- Brief generation uses `maxTokens: 8192` — intake answers can exceed 4096 tokens; Bedrock hard-errors (doesn't truncate)

## S3
- Bucket: `womenkind-recordings` (us-west-2) — in-office ambient recordings only
- Video call recordings go to Daily.co's own S3 (`daily-meeting-recordings`)
- S3 client uses explicit credentials (same reason as Bedrock)
- CORS: allows `*` origins, PUT/GET/HEAD, headers `*` — required for browser direct upload via pre-signed URL

## Email
- **Resend** for transactional email
- BAA with Resend is in progress — medication names may appear in email bodies only pending BAA completion

## Error Tracking
- **Sentry** — org `lolliprojects`, project `javascript-nextjs`
- Query unresolved issues: `GET https://sentry.io/api/0/projects/lolliprojects/javascript-nextjs/issues/?query=is:unresolved`

## Key Env Vars (Vercel)
| Var | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | Bedrock + S3 |
| `AWS_SECRET_ACCESS_KEY` | Bedrock + S3 |
| `AWS_REGION` | `us-west-2` |
| `BEDROCK_MODEL_ID` | `us.anthropic.claude-sonnet-4-6` |
| `DATABASE_URL` | RDS connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin operations |
| `CRON_SECRET` | Protects cron routes |
| `GENERATE_BRIEFS_SECRET` | Protects `/api/generate-briefs` |
| `WEBHOOK_SECRET` | AssemblyAI webhook verification |
| `RESEND_API_KEY` | Transactional email |
| `STRIPE_SECRET_KEY` | Stripe server-side |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
```

- [ ] **Step 3: Write `Technical/Database-Schema.md`**

```markdown
# Database Schema

All app tables live on **AWS RDS PostgreSQL**, accessed via **Drizzle ORM**. Supabase holds Auth users only.

## Tables

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user. `role`: `patient` or `provider`. |
| `patients` | Patient-specific data. FK → `profiles`. |
| `providers` | Provider-specific data. FK → `profiles`. |
| `intakes` | Patient intake answers + AI brief + WMI scores. |
| `visits` | All visit types: `daily_checkin`, `provider_visit`, `video_call`. |
| `appointments` | Scheduled appointments. FK → `patients`, `providers`, `appointment_types`. |
| `appointment_types` | Provider-defined appointment types with pricing. |
| `provider_availability` | Weekly recurring availability windows. |
| `availability_overrides` | Date-specific overrides (blocked days, custom hours). |
| `prescriptions` | Prescription records. |
| `lab_orders` | Lab orders with results JSONB. |
| `encounter_notes` | SOAP notes generated from visit transcriptions. |
| `engagement_log` | Audit log for all engagement messages (deduplication). |
| `notification_preferences` | Per-patient opt-out toggles (3 boolean categories). |
| `wearable_metrics` | Oura ring data (sleep_score, readiness_score, etc.). |

## Key Drizzle Gotchas

### NULL ordering
`ORDER BY submitted_at DESC` puts NULLs **first** in PostgreSQL. Always add `ne(intakes.status, 'draft')` when querying intakes to avoid a null-submitted_at draft masking a real intake.

### Draft filtering
Both `/api/patient/me` and `/api/provider/patients/[id]` filter `ne(status, 'draft')` to avoid this.

### visits.symptom_scores type
Comes back as `unknown` from Drizzle — cast to `Record<string, number> | null` before passing to `computeLiveWMI()`.

## RDS Connection
- Accepts connections from the **Vercel network only**
- Local scripts against prod DB will `ECONNREFUSED`
- Connection string in `DATABASE_URL` env var

## Daily Check-in Uniqueness
One check-in per patient per day enforced by:
```sql
CREATE UNIQUE INDEX visits_patient_daily_unique 
ON visits(patient_id, visit_date) 
WHERE source = 'daily';
```
```

- [ ] **Step 4: Write `Technical/API-Routes.md`**

```markdown
# API Routes

## Route Inventory

### Auth
| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/auth/signup` | POST | None | Creates Supabase user + RDS `profiles` + `patients` rows. Sends welcome email. |
| `/api/auth/login` | POST | None | Signs in via Supabase. Returns session. |
| `/api/auth/logout` | POST | Session | Clears Supabase session. |
| `/api/auth/resend-verification` | POST | None | Resends email verification token. |

### Patient
| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/patient/me` | GET | Patient session | Returns full patient profile + visits + prescriptions + liveWmi. |
| `/api/patient/notification-preferences` | GET/PATCH | Patient session | Read/update notification opt-outs. |
| `/api/patient/pillar-trend` | GET | Patient session | 24-week series for all 10 domains + milestones. |

### Intake
| Route | Method | Auth | maxDuration | Notes |
|---|---|---|---|---|
| `/api/intake/submit` | POST | Patient session | 300 | Submits intake → generates AI brief via Bedrock. |
| `/api/intake/regenerate-brief` | POST | Provider session | 300 | Regenerates brief for an existing intake. |

### Daily Check-in
| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/daily-checkin` | GET | Patient session | Returns `{ checkedIn, visit, hasWearable }`. Dev: mock data. |
| `/api/daily-checkin` | POST | Patient session | Submits scores. Fires score-drop check. Dev: mock data. |

### Provider
| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/provider/patients/[id]` | GET | Provider session | Returns patient profile + liveWmi. |

### Visits & Recordings
| Route | Method | Auth | maxDuration | Notes |
|---|---|---|---|---|
| `/api/visits/ambient-recording` | POST | Provider session | 60 | Returns pre-signed S3 PUT URL. |
| `/api/visits/webhook/transcription` | POST | WEBHOOK_SECRET | 300 | AssemblyAI webhook → Bedrock SOAP note. |
| `/api/visits/webhook/recording` | POST | Daily HMAC | 60 | Daily recording ready → sends to AssemblyAI. |

### Engagement (Cron)
All cron routes: `GET` + `Authorization: Bearer ${CRON_SECRET}`

| Route | Schedule | Trigger |
|---|---|---|
| `/api/engagement/weekly-nudge` | `0 14 * * 1` (Mon 8am MT) | Nudge if no check-in this week |
| `/api/engagement/monthly-recap` | `0 14 1 * *` (1st of month 8am MT) | WMI trend + top domain + check-in count |
| `/api/engagement/daily-scan` | `0 15 * * *` (daily 9am MT) | Missed check-ins, no login, rx refill, post-visit |
| `/api/engagement/unsubscribe` | GET | No auth — one-click unsubscribe via HMAC token |

### Stripe
| Route | Method | Auth | maxDuration | Notes |
|---|---|---|---|---|
| `/api/stripe/webhook` | POST | Stripe sig | 60 | Handles payment events. |
| `/api/stripe/checkout` | POST | Patient session | 60 | Creates Stripe checkout session. |

### Debug (non-production use)
| Route | Purpose |
|---|---|
| `/api/debug/reset-daily-checkin` | Delete today's daily check-in for a patient |
| `/api/debug/reprocess-transcripts` | Re-fire stuck AssemblyAI jobs |
| `/api/debug/create-test-video-appointment` | Create Daily room + appointment for testing |
| `/api/debug/recompute-wmi-by-email` | Backfill WMI scores for pre-scoring intakes |
| `/api/debug/patient-trend-data` | Dump check-ins, wearable metrics, prescriptions, visits |
| `/api/generate-briefs` | Regenerate missing briefs (protected by `GENERATE_BRIEFS_SECRET`) |

## maxDuration Reference
Routes calling Bedrock need `export const maxDuration = 300`. Vercel default is 10s.

| maxDuration | Routes |
|---|---|
| 300 | `intake/submit`, `intake/regenerate-brief`, `generate-briefs`, `visits/webhook/transcription` |
| 60 | `chat`, `visit-prep`, `ai-notes`, `stripe/webhook`, `visits/ambient-recording`, `visits/webhook/recording` |
```

- [ ] **Step 5: Write `Technical/Auth-Flow.md`**

```markdown
# Auth Flow

## Architecture
- **Supabase Auth** handles identity (email/password, session tokens)
- **RDS** holds `profiles`, `patients`, `providers` rows — the app reads these, not Supabase tables
- Every user has a Supabase auth user + an RDS `profiles` row (same UUID)

## Signup Flow
All server-side via `/api/auth/signup`:
1. Supabase admin client creates auth user with `email_confirm: true` (skips Supabase SMTP)
2. RDS `profiles` row created immediately
3. RDS `patients` row created immediately
4. Server-side Supabase sign-in (returns session)
5. Welcome email sent via Resend

## Role Resolution (`getServerSession()`)
**Checks providers before patients.** If a user has both rows (can happen accidentally), they resolve as provider. `/api/auth/create-patient` guards against creating a patient row for a provider account.

## Test Accounts
| Role | Email | Password |
|---|---|---|
| Provider | `josephurbanmd@gmail.com` | `password123` |
| Patient | `dlolli@gmail.com` | Ask Derik |

## Patient Signup Link
The link on the login page goes to `womenkindhealth.com/signup` (marketing site), NOT the in-app `/signup` route.

## Onboarding Status
Patients have `onboarding_status` on the `patients` table:
- `unverified` → email not verified
- `verified` → email verified, no plan selected
- `plan_selected` → plan chosen
- `intake_complete` → intake submitted
- `active` → fully onboarded
```

- [ ] **Step 6: Write `Technical/Recording-Pipeline.md`**

```markdown
# Recording Pipeline

## In-Office (Ambient) Flow
1. Browser requests pre-signed S3 PUT URL from `/api/visits/ambient-recording`
2. Browser uploads audio directly to `womenkind-recordings` S3 bucket (us-west-2)
3. Server calls AssemblyAI with the S3 URL
4. AssemblyAI transcribes and calls back `/api/visits/webhook/transcription`
5. Webhook route generates SOAP note via Bedrock, writes to `encounter_notes`

## Video Call Flow
1. Patient + provider join Daily.co room (cloud recording enabled via `enable_recording: 'cloud'` room property)
2. **Do NOT call `startCloudRecording()` at booking time** — room is empty, it conflicts
3. Recording starts automatically when participants join
4. Daily fires `recording.ready-to-download` webhook to `/api/visits/webhook/recording`
5. Route downloads recording, sends to AssemblyAI
6. AssemblyAI calls back `/api/visits/webhook/transcription`
7. Same SOAP note generation as ambient flow

## Daily Webhook
- Registered at `https://api.daily.co/v1/webhooks`
- No `event_types` filter — Daily API doesn't support it; all events go to one endpoint
- URL must be `https://www.womenkindhealth.com/api/visits/webhook/recording`
- Signed with HMAC-SHA256 (`x-daily-signature` + `x-daily-timestamp`)

## Webhook Secrets
- AssemblyAI: sends `x-webhook-secret` header. Verified against `WEBHOOK_SECRET` env var.
- Daily: HMAC-SHA256 signature. Verified against `WEBHOOK_SECRET` env var.

## S3 Bucket
- Name: `womenkind-recordings`
- Region: us-west-2
- CORS: `*` origins, PUT/GET/HEAD, headers `*`
- Uses explicit AWS credentials (not default chain — Vercel's OIDC token causes 403s on pre-signed URLs)

## Video Recordings
- Go to Daily.co's own S3 bucket (`daily-meeting-recordings`) — not `womenkind-recordings`

## Debug Endpoints
| Endpoint | Purpose |
|---|---|
| `POST /api/debug/reprocess-transcripts` | Re-fire stuck AssemblyAI jobs |
| `GET /api/debug/create-test-video-appointment` | Create Daily room + appointment for testing |
```

- [ ] **Step 7: Commit**

```bash
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind add /Users/deriklolli/Projects/WOMENKIND/brain/Technical/
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind commit -m "feat: add Technical/ vault notes"
```

---

### Task 4: Create Product/ notes

**Files:** Create 4 notes + `_index.md` in `brain/Product/`

- [ ] **Step 1: Write `Product/_index.md`**

```markdown
# Product

Features, patient journey, provider workflow, and engagement system.

## Notes
- [[Features]] — Full feature inventory
- [[Patient-Journey]] — Signup through ongoing care
- [[Provider-Workflow]] — Provider login through SOAP note
- [[Engagement-System]] — Proactive nudges, cron jobs, PHI email rules
```

- [ ] **Step 2: Write `Product/Features.md`**

```markdown
# Features

## Live in Production

| Feature | Description |
|---|---|
| **Patient intake** | 54-question adaptive clinical questionnaire across 10 sections |
| **AI clinical brief** | Bedrock-generated structured brief (symptom summary, risk flags, treatment pathway, provider questions) |
| **Provider queue** | Patients appear after brief is generated. Sorted by submission date. |
| **Patient dashboard** | Full dashboard unlocks after any submitted intake (no presentation gate) |
| **Daily check-in** | Domain-specific inputs (counter, slider, binary toggle, hours). One per day. |
| **Pillar trend chart** | 24-week SVG chart across 10 domains with milestone pins |
| **WMI scoring** | Womenkind Menopause Index — intake-based and live (rolling 7-day) |
| **Wearable integration** | Oura ring — sleep and readiness scores replace manual check-in questions |
| **Video visits** | Daily.co with cloud recording. HIPAA mode enabled. |
| **Ambient recording** | In-office microphone → S3 → AssemblyAI → SOAP note |
| **Engagement system** | Weekly nudge, monthly recap, daily scan, score-drop alert, lab result alert |
| **Notification preferences** | Patient can opt out by category. Clinical alerts (rx refill, labs) always sent. |
| **Stripe billing** | $650 intake, $200/mo membership, follow-up pricing |
| **Scheduling** | Patient books appointments. Members pay $0 for follow-ups. Google Calendar sync. |
| **Prescriptions** | Provider writes prescriptions from patient profile |
| **Lab orders** | Provider orders labs; results surface in patient record |
| **SOAP notes** | Auto-generated from visit transcription via Bedrock |
| **Onboarding flow** | Welcome → plan selection → signup → email verify → intake → payment |

## Not Yet Built
- Canvas Medical EHR integration (prescription/lab data currently stored in RDS only)
- Patient care presentation (animated scroll-driven per-patient summary)
- Employer portal (B2B billing)
- Menkind sub-brand
- Licensure-aware multi-provider routing
```

- [ ] **Step 3: Write `Product/Patient-Journey.md`**

```markdown
# Patient Journey

## Onboarding Flow
1. `womenkindhealth.com/signup` (marketing site) → plan selection
2. `/signup` — create account (email + password)
3. `/signup/verify` — check inbox prompt
4. Email click → `/signup/verified` — HMAC token verified, status → `verified`
5. `/welcome` — pre-intake orientation screen
6. `/intake` — 54-question adaptive intake
7. Stripe checkout — $650 intake fee (or $0 if membership covers it)
8. Brief generation runs server-side (Bedrock, ~30s)
9. Patient is redirected to `/patient/dashboard`

## Dashboard Phase Logic
Any submitted intake (status ≠ `draft`) unlocks the full dashboard immediately. No presentation gate required.

## Ongoing Care Loop
- **Daily check-in** — prompted each day. Domain-specific inputs. Wearable-adaptive (Oura skips sleep + energy).
- **Pillar trend chart** — 24-week view. Score 0–10, higher = better. Milestones pinned.
- **Symptom tracker** — domain cards. Patient customizes which 4–10 domains to show.
- **Appointments** — book via patient dashboard. Members get all follow-ups free.
- **Engagement nudges** — weekly check-in reminders, monthly WMI recap, post-visit follow-up.

## Patient Portal Quick Actions
Dashboard, Symptom Tracker, Book Appointment, Request Rx Refill, Message Dr. Urban

## Dev Bypass
Both `patient/dashboard/page.tsx` and `patient/layout.tsx` have `process.env.NODE_ENV === 'development'` auth bypass. Demo data uses `DEMO_PATIENT` constant and `devFixtures.patientProfile['fx-p-1']`.
```

- [ ] **Step 4: Write `Product/Provider-Workflow.md`**

```markdown
# Provider Workflow

## Flow
1. Provider logs in at `/provider/login`
2. **Patient queue** — shows intakes where AI brief is generated. Sorted newest first. `ne(status, 'draft')` filter applied.
3. Open a patient → **brief viewer** (4 tabs: Symptom Summary, Risk Flags, Treatment Pathway, Suggested Questions)
4. Add annotations / provider notes
5. **Patient profile** (`/provider/patients/[id]`) — visit history, symptom trend chart, prescriptions, lab orders
6. **Video visit** — Daily.co room. Cloud recording starts automatically on join.
7. Post-visit: AssemblyAI transcribes → Bedrock generates SOAP note → saved to `encounter_notes`

## Patient Queue Note
Intakes only appear **after a brief is generated**. If a patient submitted but the brief failed, they won't appear until the brief is regenerated via `/api/generate-briefs` (requires `GENERATE_BRIEFS_SECRET`).

## SOAP Note Generation
Triggered by `/api/visits/webhook/transcription` — fired by AssemblyAI after transcription completes. Uses `maxDuration: 300`.

## Visit Types in DB
`visits.visit_type`: `daily_checkin`, `provider_visit`, `video_call`
`visits.source`: `daily`, `provider`, `video`
```

- [ ] **Step 5: Write `Product/Engagement-System.md`**

```markdown
# Engagement System

Built 2026-04-29. Proactive email + in-app notifications to prevent patient drop-off.

## Cron Routes (all GET, Bearer `CRON_SECRET`)

| Route | Schedule | Trigger |
|---|---|---|
| `/api/engagement/weekly-nudge` | Mon 8am MT | Send nudge if no check-in this week |
| `/api/engagement/monthly-recap` | 1st of month 8am MT | WMI trend + top domain + check-in count |
| `/api/engagement/daily-scan` | Daily 9am MT | 4 checks: missed check-ins (14d), no login (30d), rx refill (7d window), post-visit (47–71h) |

## Event-Triggered
- **Score drop:** POST `/api/daily-checkin` → if new WMI < prev WMI × 0.80 → email + in-app notification (3-day cap)
- **Lab results:** POST `/api/canvas/labs/result` → marks `lab_orders.status='resulted'` → email + in-app notification

## Core Helpers (`src/lib/engagement.ts`)
- `alreadySentRecently(patientId, triggerType, withinDays)` — frequency cap via `engagement_log`
- `logEngagement(patientId, triggerType, channel, metadata?)` — write to `engagement_log`
- `isEngagementEnabled(patientId, triggerType)` — checks `notification_preferences`; clinical triggers always return true
- `generateUnsubscribeToken(patientId)` / `verifyUnsubscribeToken(patientId, token)` — stateless HMAC-SHA256 using `CRON_SECRET`
- `buildEngagementEmail(params)` — shared HTML builder; injects unsubscribe + manage-preferences footer links

## PHI Rules
- Medication names in email **body only** (never subject) — acceptable under HIPAA treatment operations, BAA with Resend in progress
- Neutral subjects: score-drop → "A message from your care team", refill → "Time to request a refill"
- Email preview page: `/admin/email-preview` — all 8 templates with sample data

## Notification Preferences
- `GET/PATCH /api/patient/notification-preferences`
- 3 categories: `checkin_reminders`, `progress_updates`, `care_alerts`
- No row = all defaults on (implicit opt-in)
- Clinical triggers (`rx_refill`, `lab_results_ready`) always sent regardless of preferences
- One-click unsubscribe: `GET /api/engagement/unsubscribe?patientId=X&token=Y`

## Gotcha: `profiles` has no `last_sign_in_at`
The no-login check uses `supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })` to build a `Map<profile_id, last_sign_in_at>`.
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind add /Users/deriklolli/Projects/WOMENKIND/brain/Product/
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind commit -m "feat: add Product/ vault notes"
```

---

### Task 5: Create Clinical/ notes

**Files:** Create 4 notes + `_index.md` in `brain/Clinical/`

- [ ] **Step 1: Write `Clinical/_index.md`**

```markdown
# Clinical

Intake design, AI brief pipeline, WMI scoring, and care model.

## Notes
- [[Intake-Design]] — 54 questions, 10 sections, branching, consent gate
- [[AI-Brief]] — Bedrock pipeline, JSON output structure, recovery
- [[WMI-Scoring]] — computeWMI, computeLiveWMI, domain normalization
- [[Care-Model]] — 10 health domains, treatment pathways, clinical references
```

- [ ] **Step 2: Write `Clinical/Intake-Design.md`**

```markdown
# Intake Design

## Overview
54 questions across 10 clinical sections. Adaptive branching (questions show/hide based on prior answers). Typeform-style one-question-at-a-time UX.

## The 10 Sections

| Section | Key questions |
|---|---|
| About you | Name, DOB, email, phone, height, weight, pharmacy |
| Your goals | Top concern (free text), health priorities (multi-select) |
| Reproductive history | Uterus status, ovaries, menstrual status, LMP, abnormal bleeding |
| Health basics | Blood pressure (conditional on hypertension) |
| Medications | Current meds (structured), med detail (free text), allergies, peanut allergy |
| Medical history | Cardiovascular/clotting, smoking, cancer history, other conditions |
| Vasomotor | Hot flash frequency, sleep disruption, severity, duration, interference |
| Mood & cognition | Palpitations, sleep quality, wired/tired, mood, irritability, anxiety, brain fog, fatigue, sexual change |
| Vaginal & bladder | GSM symptoms, bladder severity, vaginal severity |
| Body & bone | Midsection weight gain, strength training, fracture history, parental hip fracture, family osteoporosis, DEXA |
| Treatment preferences | Birth control need, treatments tried, openness to options, dosing preference, open notes |

## Consent Gate (before question 1)
- BAA acknowledgment
- Telehealth consent
- State-of-location capture (for future licensure routing)
- Privacy notice

## HIPAA Note
**Never pass identifying information (name, DOB, email) in the Bedrock prompt.** Only clinical response data goes to the AI.

## Branching Logic
Adaptive: if a patient reports severity 0 on a domain, deep-dive questions for that domain are skipped. Branching handled in `src/app/intake/` component.

## Submission Flow
Intake → `/api/intake/submit` → `generateClinicalBrief()` → writes `intakes.ai_brief` + `intakes.wmi_scores`. Patient appears in provider queue only after brief is generated.
```

- [ ] **Step 3: Write `Clinical/AI-Brief.md`**

```markdown
# AI Clinical Brief

## Pipeline
`/api/intake/submit` → `generateClinicalBrief()` → `invokeModel()` → writes `intakes.ai_brief`

## Bedrock Config
- Model: `us.anthropic.claude-sonnet-4-6` (cross-region, `us.` prefix required)
- `maxTokens: 8192` — full intake answers can exceed 4096 tokens; Bedrock hard-errors on overflow
- Route must have `export const maxDuration = 300`
- Explicit credentials (not default chain)

## Prompt Grounding
- IMS 2024 White Paper: "Menopause and MHT in 2024: addressing the key controversies"
- 2023 Practitioner's Toolkit for Managing Menopause
- FDA 2026 labeling changes to menopausal hormone therapy products (Feb 12, 2026)
- AI acts as clinical decision support only — provider retains full clinical authority

## Output JSON Structure
```json
{
  "symptom_summary": {
    "vasomotor_severity": "none|mild|moderate|severe",
    "sleep_severity": "...",
    "mood_severity": "...",
    "gsm_severity": "...",
    "sexual_health_severity": "...",
    "overall_burden": "low|moderate|high|very_high",
    "overview": "2-sentence patient-facing summary"
  },
  "risk_flags": [
    { "flag": "string", "detail": "string", "severity": "informational|caution|contraindication" }
  ],
  "treatment_pathway": {
    "pathway": "systemic_mht|local_estrogen_only|non_hormonal|combination|needs_clarification",
    "rationale": "2-3 sentence clinical rationale",
    "uterus_note": "progesterone requirement note or null"
  },
  "suggested_provider_questions": ["string"],
  "priority_domains": ["string"],
  "overall_complexity": "routine|moderate|complex",
  "patient_blueprint": {
    "overview": "patient-facing overview text"
  }
}
```

## The 4-Tab Brief View (Provider)
1. **Symptom Summary** — severity-ranked map, patient language + clinical terminology
2. **Risk Flags** — contraindications, family history items, severity levels
3. **Treatment Pathway** — evidence-based options ranked by clinical fit
4. **Suggested Questions** — conversation starters based on intake responses

## Recovery
If brief generation fails, patient won't appear in provider queue. Regenerate via:
```
GET /api/generate-briefs
Authorization: Bearer ${GENERATE_BRIEFS_SECRET}
```
```

- [ ] **Step 4: Write `Clinical/WMI-Scoring.md`**

```markdown
# WMI Scoring

`src/lib/wmi-scoring.ts`

## Functions

### `computeWMI(answers)`
Deterministic scoring from intake answers. Stored in `intakes.wmi_scores`. Run on intake submission.

Intakes submitted before scoring was added will have `wmi_scores: null`. Backfill:
```
GET /api/debug/recompute-wmi-by-email?email=X
```

### `computeLiveWMI(checkins, wearableMetrics?)`
Rolling 7-day score from daily check-ins. Wearable-first for sleep and energy domains (Oura data takes precedence when available).

## Score Resolution Order
`liveWmi → intakeWmi → visitOverall`

When live score is showing, PatientOverview displays: "Live score · Last check-in: [date]"

## Per-Domain Normalization

| Domain | Input | Normalization |
|---|---|---|
| Vasomotor | Episode count (0–20) | `min(avg, 15) / 15` |
| Sleep | Hours (0–12) | `max(0, 7 - hrs) / 7` |
| Cardio | Episode count (0–5) | `min(avg, 5) / 5` |
| All others | Burden 1–5 (5=worst) | `(avg - 1) / 4` |

Backward-compat heuristic: if value ≤ 5 and none are 0, treat as legacy 1–5 burden scale.

## Display Scale
Scores are inverted from burden scale for display: 0–10, **higher = better**.

## Wearable Data Sources
- `wearable_metrics.sleep_score` (0–100) → divide by 10 → sleep domain
- `wearable_metrics.readiness_score` (0–100) → divide by 10 → energy domain

## Check-in Domain Input Types
| Domain | Input | Storage |
|---|---|---|
| Vasomotor | Counter 0–20 | Episode count stored directly |
| Sleep | Hours stepper 0–12 | Hours stored directly (skipped if wearable) |
| Energy | 1–5 slider | Burden stored (skipped if wearable) |
| Cardio | Binary toggle + episode counter | Episode count stored directly |
| All others | 1–5 burden slider | Burden stored (5 = worst) |
```

- [ ] **Step 5: Write `Clinical/Care-Model.md`**

```markdown
# Care Model

## Overview
Telehealth-first, cash-pay, physician-led menopause and midlife care. Dr. Joseph Urban is the physician principal. No NP-only model — physician-led is a core differentiator.

## The 10 Health Domains
| Domain | Default Shown | Card Value |
|---|---|---|
| Vasomotor | Yes | Episode count |
| Sleep | Yes | Hours |
| Energy | Yes | X / 5 |
| Mood | Yes | X / 5 |
| Hormonal | No | X / 5 |
| Cognition | No | X / 5 |
| Bone Health | No | X / 5 |
| Metabolism | No | X / 5 |
| Libido | No | X / 5 |
| Cardiovascular | No | Episode count or "None" |

Default 4 shown: vasomotor, sleep, energy, mood. Patient can add more via `+` button.

## Treatment Pathways
- `systemic_mht` — systemic menopausal hormone therapy
- `local_estrogen_only` — vaginal/local estrogen, no systemic
- `non_hormonal` — non-hormonal options (SSRIs, gabapentin, etc.)
- `combination` — mix of above
- `needs_clarification` — more info needed before recommendation

Uterus status drives whether progesterone is required alongside estrogen.

## Key Clinical References
- **IMS 2024 White Paper:** "Menopause and MHT in 2024: addressing the key controversies"
- **2023 Practitioner's Toolkit for Managing Menopause**
- **FDA 2026 Labeling Changes:** Menopausal hormone therapy products (Feb 12, 2026)
- **Frier Levitt Memo:** MSO regulatory analysis (Dec 5, 2025) — confidential, attorney-client

## HIPAA Note
BAA with Anthropic must be in place before processing real patient data. BAA with Resend is in progress as of 2026-04-30 (required for medication names in email bodies).
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind add /Users/deriklolli/Projects/WOMENKIND/brain/Clinical/
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind commit -m "feat: add Clinical/ vault notes"
```

---

### Task 6: Create Business/ notes

**Files:** Create 4 notes + `_index.md` in `brain/Business/`

- [ ] **Step 1: Write `Business/_index.md`**

```markdown
# Business

Legal structure, pricing, assembled infrastructure, and competitive context.

## Notes
- [[Legal-Structure]] — MSO, Iron Gate, Frier Levitt, BAA status
- [[Pricing]] — $650 intake, $200/mo membership, follow-up rules
- [[Infrastructure]] — Assembled providers (OpenLoop, Daily, Resend, Sentry, etc.)
- [[Competitive]] — Direct competitors, differentiation, Medvi reference
```

- [ ] **Step 2: Write `Business/Legal-Structure.md`**

```markdown
# Legal Structure

## Entities
- **Iron Gate Management Services LLC** — Delaware MSO (EIN 41-3229574)
- **Physician practice** — Dr. Joseph Urban. Retains sole clinical authority.
- MSO provides non-clinical services. Management fee must be FMV and not referral-based.

## Model
Cash-pay MSO / physician-practice model. Provider fees pass through to the rendering provider. MSO receives a management fee. This is the standard telemedicine assembly model (see Medvi reference in [[Competitive]]).

## Controlling Legal Document
**Frier Levitt MSO Regulatory Analysis memo (Dec 5, 2025)** — treat as confidential, attorney-client. All fee structure and referral decisions defer to this memo.

## BAA Status
| Vendor | BAA Status |
|---|---|
| Anthropic (Bedrock) | Required before real patient data — confirm status |
| Resend (email) | In progress as of 2026-04-30 |
| Vercel | Required — confirm status |
| Supabase | Required — confirm status |
| AssemblyAI | Required — confirm status |

## Team
- **Dr. Joseph Urban** — Physician principal, clinical authority
- **Derik Lolli** — CTO, technical build
```

- [ ] **Step 3: Write `Business/Pricing.md`**

```markdown
# Pricing

## Current Pricing
| Item | Price | Notes |
|---|---|---|
| Intake visit (2-hour telehealth) | $650 | Covers the Initial Consultation appointment ($0) |
| Monthly membership | $200/mo | Ongoing care, messaging, titration |
| Follow-ups (members) | $0 | All follow-ups free for active members |
| Follow-ups (non-members) | Charged | Rate TBD |

## Stripe Architecture
- `womenkind-intake` — $650 one-time product
- `womenkind-membership` — $200/mo recurring subscription
- **Pass-through accounting:** Provider fee portion tracked separately from MSO management fee in Stripe metadata
- Members: `membership_plan` on `patients` table; scheduling checks this for follow-up pricing

## Appointment Type Pricing
Stored in `appointment_types.price_cents`. Provider sets per type. Members always pay $0 for follow-ups regardless of the stored price.
```

- [ ] **Step 4: Write `Business/Infrastructure.md`**

```markdown
# Assembled Infrastructure

These are vendor relationships — never build what these provide.

| Capability | Vendor | Notes |
|---|---|---|
| Provider network + pharmacy + compliance | **OpenLoop Health** | Handles provider licensing, pharmacy coordination, regulatory compliance |
| Video consultations + cloud recording | **Daily.co** | HIPAA mode enabled. Cloud recording to `daily-meeting-recordings` S3. |
| Speech-to-text transcription | **AssemblyAI** | Transcribes both ambient (S3) and video (Daily) recordings |
| Transactional email | **Resend** | Welcome, engagement nudges, lab results. BAA in progress. |
| Payments | **Stripe** | Intake checkout, membership subscriptions, pass-through accounting |
| Error tracking | **Sentry** | Org: `lolliprojects`, project: `javascript-nextjs` |
| AI / clinical brief | **AWS Bedrock** | `us.anthropic.claude-sonnet-4-6`. IAM user `womenkind-app`. |

## The Assembly Model
Following the Medvi / Matthew Gallagher pattern: build a superior distribution and experience layer over existing compliant infrastructure (OpenLoop). Don't rebuild pharmacy networks, credentialing systems, or compliance frameworks.
```

- [ ] **Step 5: Write `Business/Competitive.md`**

```markdown
# Competitive Context

## Direct Competitors
| Competitor | Notes |
|---|---|
| **Midi Health** | NP-led, subscription, broad menopause care |
| **Alloy** | Subscription, hormone therapy focus, no in-person |
| **Gennev** | Telehealth + coaching, older brand |
| **Evernow** | Prescription-first, minimal clinical depth |
| **Winona** | Compounded hormones, low-touch model |

## WomenKind Differentiation
- **Physician-led** — Dr. Urban is MD, not NP-only. Clinical credibility matters to the target patient.
- **Premium long-form intake** — 54 questions, adaptive branching. Not a 5-minute form.
- **Evidence-based** — IMS guidelines, not compounded-hormone-first. Not wellness influencer content.
- **AI clinical depth** — Brief generation, WMI scoring, SOAP notes, symptom trend analysis.
- **Subscription continuity** — Intake unlocks membership. Long-term relationship, not one-and-done.
- **Outcomes visibility** — Pillar trend charts show symptom improvement over time.

## Reference Model
**Medvi / Matthew Gallagher** (NYT, April 2, 2026): GLP-1 telehealth, $401M ARR in year one, 2 employees. Built a superior distribution layer over OpenLoop. WomenKind follows the same assembly model with genuine clinical depth as the moat instead of GLP-1 arbitrage.
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind add /Users/deriklolli/Projects/WOMENKIND/brain/Business/
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind commit -m "feat: add Business/ vault notes"
```

---

### Task 7: Create Decisions/, Bugs/, Project/, AI/ notes

**Files:** `_index.md` files for all 4 sections + 1 decisions log + Known-Issues.md + Roadmap.md + Claude-Onboarding.md

- [ ] **Step 1: Write `Decisions/_index.md`**

```markdown
# Decisions

Architectural and product decisions with rationale. Format: `YYYY-MM-DD-<topic>.md`

## Logs
- [[2026-05-05-key-architecture-decisions]] — Major decisions made during the build
```

- [ ] **Step 2: Write `Decisions/2026-05-05-key-architecture-decisions.md`**

```markdown
# Key Architecture Decisions

## Database: RDS over Supabase for app tables
**Decision:** Migrate all app tables from Supabase to AWS RDS (Drizzle ORM).
**Why:** Supabase Postgres had row-level security complexity for multi-role queries. RDS gives full Postgres control with Drizzle's type-safe ORM. Supabase retained for Auth only.
**Trade-off:** RDS is Vercel-network-only. Local scripts can't hit prod DB.

## Auth: Supabase Auth with server-side signup
**Decision:** All signup is server-side via `/api/auth/signup` using Supabase admin client with `email_confirm: true`.
**Why:** Skips Supabase SMTP entirely. Creates RDS rows immediately on signup without waiting for email confirmation click.
**Trade-off:** Custom verification token system required (HMAC-based).

## Role resolution: providers checked before patients
**Decision:** `getServerSession()` checks for a `providers` row before a `patients` row.
**Why:** Prevents a user with accidental dual rows from resolving as patient. Discovered after a test account had both rows.

## Bedrock: explicit credentials, not default chain
**Decision:** All Bedrock and S3 clients use explicit `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
**Why:** Vercel's `VERCEL_OIDC_TOKEN` poisons the default AWS credential chain, producing S3 pre-signed URLs that return 403 when AssemblyAI tries to download them.

## Bedrock routes: maxDuration = 300
**Decision:** All routes calling Bedrock must export `maxDuration = 300`.
**Why:** Vercel's default 10s timeout silently kills Bedrock calls. Brief generation consistently takes 15–45s.

## Video recording: cloud recording on join, not on booking
**Decision:** `enable_recording: 'cloud'` room property starts recording automatically when participants join. Do NOT call `startCloudRecording()` at booking time.
**Why:** Room is empty at booking. Calling startCloudRecording() on an empty room causes a conflict.

## Daily check-in: dev bypass for both GET and POST
**Decision:** Both check-in routes return mock data immediately in `NODE_ENV === 'development'`.
**Why:** Daily check-in has a one-per-day uniqueness constraint. Testing without bypass required resetting the DB every session.

## Patient dashboard: no presentation gate
**Decision:** Any submitted intake unlocks the full patient dashboard immediately.
**Why:** Patient feedback. The presentation-first gate added friction with no measurable benefit to activation.

## Engagement emails: neutral subjects
**Decision:** PHI-adjacent subjects kept neutral (score-drop → "A message from your care team").
**Why:** HIPAA. Medication names in email subjects are not permitted without a signed BAA. BAA with Resend is in progress.

## Vercel env vars: printf, not echo
**Decision:** Always use `printf '%s' 'value' | vercel env add NAME production`.
**Why:** `echo` appends a `\n` which silently breaks AWS SDK calls. Produced misleading "not authorized" / "invalid header" errors that were extremely hard to diagnose.
```

- [ ] **Step 3: Write `Bugs/Known-Issues.md`**

```markdown
# Known Issues & Edge Cases

Format: **Symptom → Root Cause → Fix**

---

## NULL ordering on intakes query

**Symptom:** Draft intake appears at top of provider queue, masking a real submitted intake.
**Root Cause:** `ORDER BY submitted_at DESC` puts NULLs first in PostgreSQL. Draft intakes have `submitted_at = null`.
**Fix:** Always add `ne(intakes.status, 'draft')` to intake queries. Both `/api/patient/me` and `/api/provider/patients/[id]` already do this.

---

## Vercel env vars with trailing newline

**Symptom:** AWS SDK calls return "not authorized" or "invalid header" with no obvious cause. Happens after adding env vars via Vercel UI or `echo`.
**Root Cause:** `echo` appends `\n` to the value. AWS SDK includes the newline in the Authorization header.
**Fix:** Always use `printf '%s' 'value' | vercel env add NAME production`.

---

## AssemblyAI gets 403 on S3 pre-signed URL

**Symptom:** AssemblyAI transcription fails with 403 on the download URL.
**Root Cause:** S3 client was using the default AWS credential chain. Vercel's `VERCEL_OIDC_TOKEN` poisons it, producing a URL signed with OIDC credentials instead of the IAM user's credentials. AssemblyAI can't use those.
**Fix:** S3 client in `src/lib/s3.ts` uses explicit credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

---

## Daily check-in shows "already checked in" after dev reset

**Symptom:** Check-in returns `{ checkedIn: true }` even after resetting the DB row.
**Root Cause:** Dev bypass in GET `/api/daily-checkin` returns mock data without hitting DB.
**Fix:** Both GET and POST check-in routes have dev bypass. To test real check-in logic, use production or disable the bypass locally.

---

## Bedrock call fails silently (no error, no brief)

**Symptom:** Patient submits intake but brief is never generated. No error in logs.
**Root Cause 1:** Route missing `export const maxDuration = 300`. Vercel kills the function at 10s before Bedrock responds.
**Root Cause 2:** `maxTokens` too low. If intake answers exceed token budget, Bedrock hard-errors.
**Fix:** All Bedrock routes export `maxDuration = 300`. Brief generation uses `maxTokens: 8192`.

---

## Dual-row account resolves as wrong role

**Symptom:** User with both `providers` and `patients` rows logs in and lands on patient dashboard.
**Root Cause:** `getServerSession()` was checking `patients` before `providers`.
**Fix:** `getServerSession()` checks providers first. `/api/auth/create-patient` guards against creating a patient row for a provider account.

---

## `visits.symptom_scores` type error

**Symptom:** TypeScript error or runtime crash when passing symptom scores to `computeLiveWMI()`.
**Root Cause:** Drizzle returns `visits.symptom_scores` as `unknown`.
**Fix:** Cast to `Record<string, number> | null` before use.
```

- [ ] **Step 4: Write `Bugs/_index.md`**

```markdown
# Bugs

## Notes
- [[Known-Issues]] — Recurring gotchas, edge cases, and failure modes with root causes and fixes
```

- [ ] **Step 5: Write `Project/Roadmap.md`**

```markdown
# Roadmap

## Completed

| Feature | Notes |
|---|---|
| Patient intake (54 questions) | Adaptive, branching, 10 sections |
| AI clinical brief (Bedrock) | 4-tab brief, IMS-grounded |
| Provider queue | Brief-gated, sorted by submission |
| Patient dashboard | Full unlock on any submitted intake |
| Daily check-in | Domain-specific inputs, wearable-adaptive |
| Pillar trend chart | 24-week SVG, 10 domains, milestone pins |
| WMI scoring | Intake-based + live rolling 7-day |
| Oura wearable integration | sleep_score, readiness_score |
| Video visits | Daily.co, HIPAA mode, cloud recording |
| Ambient recording | S3 → AssemblyAI → SOAP note |
| Scheduling system | Patient books, member pricing, Google Calendar sync |
| Stripe billing | $650 intake, $200/mo membership |
| Engagement system | Weekly nudge, monthly recap, daily scan, score-drop, lab result |
| Notification preferences | 3 categories, one-click unsubscribe |
| Onboarding flow | Welcome → plan select → signup → verify → intake → payment |
| SOAP note generation | Bedrock from visit transcription |
| Prescriptions | Provider writes from patient profile |
| Lab orders | Provider orders, results surface in patient record |

## Active / In Progress

(Update this section when starting new work)

## Upcoming Priorities

| Feature | Priority | Notes |
|---|---|---|
| Patient care presentation | High | Animated scroll-driven per-patient summary after visit |
| Canvas Medical EHR integration | Medium | E-prescribing and lab ordering via Canvas FHIR API |
| Menkind sub-brand | Low | Shared identity layer, isolated medical records |
| Employer portal | Low | B2B billing, utilization reports |
| Licensure-aware routing | Low | Patient state → eligible provider matching |
```

- [ ] **Step 6: Write `Project/_index.md`**

```markdown
# Project

## Notes
- [[Roadmap]] — Completed features, active work, upcoming priorities
```

- [ ] **Step 7: Write `AI/Claude-Onboarding.md`**

```markdown
# Claude Onboarding

Paste this at the start of any Claude session to orient quickly:

---

> Read brain/CONTEXT.md. Don't summarize — just confirm you're oriented.

---

After confirming orientation, Claude can be directed to specific notes:

> Read brain/Technical/Database-Schema.md and brain/Technical/API-Routes.md before touching any backend code.

> Read brain/Clinical/AI-Brief.md and brain/Clinical/WMI-Scoring.md before touching any AI or scoring logic.

> Read brain/Business/Legal-Structure.md before any billing, pricing, or compliance decisions.

---

## Keeping the Vault Up to Date

After any session where significant decisions were made:
1. Add a dated decision log to `Decisions/` if an architectural or product decision was made
2. Update `Bugs/Known-Issues.md` if a new edge case was discovered
3. Update `Project/Roadmap.md` if a feature shipped or priorities changed
4. Update the relevant Technical/Product/Clinical/Business note if the implementation changed

Claude can write vault updates directly — they're just markdown files in `~/Projects/WOMENKIND/brain/`.
```

- [ ] **Step 8: Write `AI/_index.md`**

```markdown
# AI

Claude session onboarding and vault maintenance instructions.

## Notes
- [[Claude-Onboarding]] — Paste-ready prompt for starting any Claude session
```

- [ ] **Step 9: Commit**

```bash
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind add /Users/deriklolli/Projects/WOMENKIND/brain/
git -C /Users/deriklolli/Projects/WOMENKIND/WomenKind commit -m "feat: add Decisions, Bugs, Project, AI vault notes"
```

---

### Task 8: Register vault in Obsidian

**Files:** Modify `~/Library/Application Support/obsidian/obsidian.json`

- [ ] **Step 1: Read current obsidian.json**

```bash
cat ~/Library/Application\ Support/obsidian/obsidian.json
```

Note the existing vault hash keys (e.g., `4d19b071e6a7b012`, `b38ce0ac1811037b`, `3e287ec1d949ffbf`).

- [ ] **Step 2: Generate a new vault hash and add the entry**

The hash is a random 16-character hex string. Generate one and add the vault:

```bash
HASH=$(openssl rand -hex 8)
TIMESTAMP=$(date +%s)000
python3 -c "
import json, sys
with open('$HOME/Library/Application Support/obsidian/obsidian.json', 'r') as f:
    data = json.load(f)
data['vaults']['$HASH'] = {
    'path': '/Users/deriklolli/Projects/WOMENKIND/brain',
    'ts': $TIMESTAMP
}
with open('$HOME/Library/Application Support/obsidian/obsidian.json', 'w') as f:
    json.dump(data, f, indent=2)
print('Added vault with hash: $HASH')
"
```

- [ ] **Step 3: Verify the entry was added**

```bash
cat ~/Library/Application\ Support/obsidian/obsidian.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(v['path']) for v in d['vaults'].values()]"
```

Expected output includes:
```
/Users/deriklolli/Projects/WOMENKIND/brain
```

- [ ] **Step 4: Restart Obsidian or open the vault**

The vault will appear in Obsidian's vault switcher after restart. Open it and confirm `CONTEXT.md` loads correctly.

---

## Self-Review

**Spec coverage check:**
- ✅ Vault location (`/WOMENKIND/brain/`) — Task 1
- ✅ All 8 folder sections created with `_index.md` — Tasks 3–7
- ✅ All 22 content files created with real content — Tasks 2–7
- ✅ CONTEXT.md with vault map + onboarding prompt — Task 2
- ✅ Content synthesized from existing docs (no inventions) — All tasks
- ✅ Obsidian registration — Task 8

**No placeholders:** All file contents are written in full.

**Type consistency:** No code — N/A. Wiki links use consistent `[[Note]]` format throughout.
