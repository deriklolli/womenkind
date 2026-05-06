# WomenKind Obsidian Vault — Design Spec
**Date:** 2026-05-05
**Status:** Approved

---

## Goal

Create an Obsidian vault at `/Users/deriklolli/Projects/WOMENKIND/brain/` that serves as the project second brain for WomenKind. Mirrors the PAVER brain vault structure with two additions: a `Clinical/` folder for the care model and AI pipeline, and a `Business/` folder for legal, pricing, and competitive context. Content is synthesized from existing project docs — nothing invented.

---

## Vault Location

```
/Users/deriklolli/Projects/WOMENKIND/brain/
```

Sibling to the codebase (`WomenKind/`). Must be registered in Obsidian via `obsidian.json`.

---

## Folder Structure

```
brain/
├── CONTEXT.md
├── Technical/
│   ├── _index.md
│   ├── Stack.md
│   ├── Database-Schema.md
│   ├── API-Routes.md
│   ├── Auth-Flow.md
│   └── Recording-Pipeline.md
├── Product/
│   ├── _index.md
│   ├── Features.md
│   ├── Patient-Journey.md
│   ├── Provider-Workflow.md
│   └── Engagement-System.md
├── Clinical/
│   ├── _index.md
│   ├── Intake-Design.md
│   ├── AI-Brief.md
│   ├── WMI-Scoring.md
│   └── Care-Model.md
├── Business/
│   ├── _index.md
│   ├── Legal-Structure.md
│   ├── Pricing.md
│   ├── Infrastructure.md
│   └── Competitive.md
├── Decisions/
│   ├── _index.md
├── Bugs/
│   ├── _index.md
│   └── Known-Issues.md
├── Project/
│   ├── _index.md
│   └── Roadmap.md
└── AI/
    ├── _index.md
    └── Claude-Onboarding.md
```

---

## File Content Plan

### CONTEXT.md
Master entry point. Includes:
- What WomenKind is (1-2 sentences)
- Quick facts table (stack, URLs, auth, key env vars)
- Vault map with wiki links to every section's `_index.md`
- Paste-ready Claude onboarding prompt

### Technical/

**Stack.md** — Framework (Next.js 14 App Router), hosting (Vercel, auto-deploy from main), DB (Supabase Auth only + AWS RDS via Drizzle), AI (Bedrock with `us.anthropic.claude-sonnet-4-6`), S3, Resend. Key gotchas: `printf` not `echo` for Vercel env vars; `maxDuration` required on all Bedrock routes.

**Database-Schema.md** — All RDS tables (profiles, patients, providers, intakes, visits, appointments, prescriptions, engagement_log, notification_preferences, wearable_metrics, lab_orders, encounter_notes). Drizzle gotchas (NULL ordering, draft filtering). RDS is Vercel-network-only.

**API-Routes.md** — All route prefixes, auth requirements, `maxDuration` values, protected routes (CRON_SECRET, GENERATE_BRIEFS_SECRET). Includes cron schedule table.

**Auth-Flow.md** — Supabase Auth with RDS profile rows. Signup flow (server-side, `email_confirm: true`, skips SMTP). `getServerSession()` checks providers before patients. Test accounts.

**Recording-Pipeline.md** — In-office (browser → S3 → AssemblyAI → webhook) and video call (Daily cloud → webhook → AssemblyAI → Bedrock SOAP note) flows. WEBHOOK_SECRET, debug endpoints.

### Product/

**Features.md** — Full feature inventory: intake flow, AI clinical brief, provider queue, patient dashboard, daily check-in, pillar trend chart, WMI scoring, wearable integration (Oura), video visits, ambient recording, engagement/notification system, Stripe billing.

**Patient-Journey.md** — Signup → welcome → intake → Stripe payment → brief generation → patient dashboard → daily check-in loop. Phase logic: any submitted intake unlocks full dashboard immediately.

**Provider-Workflow.md** — Provider login → patient queue (brief required to appear) → brief review → visit → SOAP note generation. Video visit flow via Daily.

**Engagement-System.md** — Cron routes (weekly nudge, monthly recap, daily scan). Score-drop trigger. Lab result trigger. `engagement_log` deduplication. `notification_preferences` table. Unsubscribe token flow. Email PHI rules (BAA in progress with Resend).

### Clinical/

**Intake-Design.md** — 54 questions across 10 sections (About you, Goals, Reproductive history, Health basics, Medications, Medical history, Vasomotor, Mood & cognition, Vaginal & bladder, Body & bone, Treatment preferences). Adaptive branching logic. Consent gate (BAA, telehealth consent, state capture). HIPAA note: no PII in Bedrock prompt.

**AI-Brief.md** — Bedrock pipeline: `/api/intake/submit` → `generateClinicalBrief()` → `invokeModel()` → writes `intakes.ai_brief`. Model: `us.anthropic.claude-sonnet-4-6`. `maxTokens: 8192`. Output JSON structure (symptom_summary, risk_flags, treatment_pathway, suggested_provider_questions, priority_domains, overall_complexity). Prompt grounded in IMS 2024 white paper + 2023 Practitioner's Toolkit. Recovery: `/api/generate-briefs` with `GENERATE_BRIEFS_SECRET`.

**WMI-Scoring.md** — `computeWMI(answers)` from intake. `computeLiveWMI(checkins, wearableMetrics?)` rolling 7-day. Per-domain normalization rules. Wearable-first for sleep/energy. `liveWmi` prop flow: `liveWmi → intakeWmi → visitOverall`. Backfill: `/api/debug/recompute-wmi-by-email`.

**Care-Model.md** — Menopause/midlife telehealth. 10 health domains (Vasomotor, Sleep, Energy, Mood, Hormonal, Cognition, Bone Health, Metabolism, Libido, Cardiovascular). Treatment pathways (systemic MHT, local estrogen only, non-hormonal, combination). Key references: IMS 2024 white paper, 2023 Practitioner's Toolkit, FDA 2026 labeling changes.

### Business/

**Legal-Structure.md** — Operator: Dr. Joseph Urban (physician principal) + Derik (CTO). Entity: Iron Gate Management Services LLC (Delaware MSO). MSO/physician-practice model. Fee pass-through logic. Frier Levitt memo is controlling legal document — treat as confidential. BAA with Anthropic required before real patient data.

**Pricing.md** — $650 intake visit (covers Initial Consultation at $0). $200/month membership (ongoing care, messaging, titration). Members pay $0 for all follow-ups. Non-members charged for follow-ups. Stripe pass-through accounting: provider fee tracked separately from MSO management fee.

**Infrastructure.md** — Assembled, not built: OpenLoop Health (provider network, pharmacy, compliance), Daily.co (video + cloud recording), AssemblyAI (transcription), Resend (email, BAA in progress), Stripe (billing), Sentry (error tracking: org `lolliprojects`, project `javascript-nextjs`).

**Competitive.md** — Direct competitors: Midi Health, Alloy, Gennev, Evernow, Winona. Differentiation: premium long-form intake, physician-led (not NP-only), evidence-based (not compounded-hormone-first), subscription continuity, AI clinical depth. Reference: Medvi/Matthew Gallagher model ($401M ARR, 2 employees, OpenLoop distribution layer).

### Decisions/
Dated decision logs in format `YYYY-MM-DD-<topic>.md`. Each log records what was decided, why, and any alternatives rejected. Seeded with key past decisions synthesized from existing build plans.

### Bugs/

**Known-Issues.md** — Known edge cases, gotchas, and recurring failure modes synthesized from CLAUDE.md and build history. Format mirrors PAVER's Known-Edge-Cases.md: symptom → root cause → fix.

### Project/

**Roadmap.md** — Completed features, active work, upcoming priorities. Synthesized from WOMENKIND_MVP_PLAN.md and recent commit history.

### AI/

**Claude-Onboarding.md** — Onboarding prompt to paste at the start of any Claude session. Instructions for keeping vault up to date.

---

## Registration

After creating the vault files, register the vault in Obsidian by adding an entry to:
```
~/Library/Application Support/obsidian/obsidian.json
```

Format matches existing entries:
```json
"<hash>": {"path": "/Users/deriklolli/Projects/WOMENKIND/brain", "ts": <epoch_ms>}
```

---

## Content Sources

All content synthesized from:
- `/Users/deriklolli/Projects/WOMENKIND/WomenKind/CLAUDE.md`
- `/Users/deriklolli/Projects/WOMENKIND/womenkind-project.md`
- `/Users/deriklolli/Projects/WOMENKIND/WomenKind/WOMENKIND_MVP_PLAN.md`
- `/Users/deriklolli/Projects/WOMENKIND/WomenKind/BRAND_SPECS.md`
- `/Users/deriklolli/Projects/WOMENKIND/WomenKind/FIGMA_DESIGN_SPEC.md`
- `/Users/deriklolli/Projects/WOMENKIND/WomenKind/SCHEDULING_BUILD_PLAN.md`
- `/Users/deriklolli/Projects/WOMENKIND/WomenKind/OURA_INTEGRATION_PLAN.md`
- `/Users/deriklolli/Projects/WOMENKIND/WomenKind/build-15-patient-follow-up-engine.md`
- Recent git commit history

---

## Out of Scope

- Obsidian plugins configuration (Dataview, Templater, etc.) — plain markdown only for now
- Syncing vault to git (can be added later)
- Brand assets / images in vault
