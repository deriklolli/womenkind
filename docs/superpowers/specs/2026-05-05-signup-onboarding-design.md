# Signup & Onboarding Redesign

**Date:** 2026-05-05  
**Status:** Approved

## Overview

Redesign the new patient funnel into a single linear flow: plan selection → account creation → email verification → payment → welcome → intake → dashboard. Replaces the current fragmented flow (`/get-started` + `/intake` dark theme + implicit state inference) with an explicit state machine and clear URL structure.

## Funnel Flow

```
/join → /signup → /signup/verify → [email link] → /signup/verified → /signup/resume → Stripe → /signup/resume → /welcome → /intake → /patient/dashboard
```

Returning patients who abandoned mid-funnel land on `/signup/resume`, which reads their `onboarding_status` and shows the correct next step.

## URL Structure

### New pages

| Route | Purpose |
|---|---|
| `/join` | Plan selection — 3 membership cards, public |
| `/signup` | Create account (name, email, password) |
| `/signup/verify` | "Check your inbox" waiting screen with resend link |
| `/signup/verified` | Email link landing — verifies token, advances status, redirects to `/signup/resume` |
| `/signup/resume` | Resumption screen — reads status, shows correct next step |
| `/welcome` | One-screen pre-intake context screen |
| `/intake` | Light-theme intake form (currently `/intake2`) |

### Pages removed

- `/get-started` — replaced by `/join`
- `/intake` dark theme (`/intake/page.tsx`) — replaced by light theme
- `/intake2` — becomes the new `/intake`
- `/intake/payment` and `/intake/payment2` — payment now happens before intake

## Patient State Machine

`onboarding_status` column added to the `patients` table.

| Status | Meaning |
|---|---|
| `unverified` | Account created, email not verified |
| `verified` | Email verified, payment not made |
| `paid` | Payment complete, intake not submitted |
| `active` | Intake submitted, on the dashboard |

**Transitions:**

| Trigger | Transition |
|---|---|
| Account created | `null → unverified` |
| Email verification link clicked | `unverified → verified` |
| Stripe `checkout.session.completed` webhook | `verified → paid` |
| Intake submission + brief generated | `paid → active` |

**Middleware rule:** Any patient with status `unverified`, `verified`, or `paid` who hits a protected route is redirected to `/signup/resume` instead.

## Database Changes

### `patients` table — new columns

| Column | Type | Purpose |
|---|---|---|
| `onboarding_status` | enum/text | Current funnel state (see state machine above) |
| `stripe_customer_id` | text | Set on Stripe webhook |
| `stripe_subscription_id` | text | Set on Stripe webhook |
| `membership_plan` | text | Plan selected at `/join`, confirmed on webhook |

### Record creation timing

| Step | DB write |
|---|---|
| Signup (`/api/auth/signup`) | Create `profiles` + `patients` (status: `unverified`) |
| Email verified (`/signup/verified`) | `patients.onboarding_status = verified` |
| Stripe webhook (`checkout.session.completed`) | `patients.onboarding_status = paid` + Stripe IDs + plan |
| Intake submitted (`/api/intake/submit`) | `intakes.status = submitted` → brief generated → `patients.onboarding_status = active` |

The clinical brief is generated at intake submission — after all answers are collected. Brief completion triggers the `paid → active` transition and the redirect to `/patient/dashboard`.

## Screen Specifications

### `/join` — Plan selection

- Three membership cards (content TBD)
- Each card: name, price, key benefits, "Get started" button
- Clicking a card navigates to `/signup?plan=<plan_key>`; the signup page reads the param and stores it in a cookie (`wk_selected_plan`) so it survives the auth flow
- Public page — no auth required
- Already-`active` patients visiting this page are redirected to `/patient/dashboard`

### `/signup` — Create account

- Fields: first name, last name, email, password
- Password validation: 8+ chars, uppercase, lowercase, number (real-time feedback)
- On submit: creates Supabase auth user + `profiles` + `patients` (status: `unverified`)
- Sends verification email via Resend (not Supabase SMTP)
- Redirects to `/signup/verify`
- Reads `wk_selected_plan` cookie and passes plan to Stripe checkout via metadata
- Already-`active` patients visiting this page are redirected to `/patient/dashboard`

### `/signup/verify` — Check your inbox

- Static screen: "We sent a link to [email]. Click it to continue."
- Resend link — rate-limited to once per minute
- No auto-redirect; patient must click the email link

### `/signup/verified` — Email link landing

- Server verifies token
- Updates `onboarding_status` to `verified`
- Immediately redirects to `/signup/resume`

### `/signup/resume` — Resumption screen

Reads `onboarding_status` and renders the appropriate state:

| Status | Screen content |
|---|---|
| `unverified` | "Please verify your email first" + resend option |
| `verified` | "Complete your membership" + Stripe checkout button |
| `paid` | "Start your intake" + link to `/welcome` |

Stripe checkout is initiated from this screen. On Stripe success, Stripe redirects back to `/signup/resume?session_id=X`. The resume page calls the Stripe API to confirm the session synchronously and updates `onboarding_status` to `paid` immediately — this resolves the race condition where the webhook arrives after the redirect. The webhook also updates status to `paid` when it fires, but is idempotent (no-op if already paid).

### `/welcome` — Pre-intake screen

- Single screen, no carousel
- Copy: "Your intake takes about 15 minutes. Everything you share goes directly to Dr. Urban to prepare your first visit."
- Single "Begin Intake" button → `/intake`
- Only reachable when `onboarding_status = paid`

### `/intake` — Light-theme intake form

- Currently `/intake2` — moved to `/intake`, dark theme version removed
- No changes to form logic, questions, auto-save, or keyboard navigation
- On submission: generates WMI scores → triggers Bedrock clinical brief → updates `onboarding_status` to `active` → redirects to `/patient/dashboard`

## What Does Not Change

- Intake questions (`src/lib/intake-questions.ts`) — unchanged
- Auto-save logic (`/api/intake/save`) — unchanged
- Clinical brief generation (`generateClinicalBrief()` + Bedrock) — unchanged, still fires at intake submission
- Stripe checkout API (`/api/stripe/checkout`) — unchanged, called from `/signup/resume`
- Patient dashboard — unchanged
- Provider-side experience — unchanged

## Open Items

- Membership plan names, prices, and benefits (separate conversation)
- Plan stored on patient record at signup (from URL param) and confirmed/locked at Stripe webhook
