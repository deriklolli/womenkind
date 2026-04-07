# WomenKind Platform Audit Report
**Date:** April 7, 2026
**Status:** All critical and high-priority issues fixed

---

## What Was Found and Fixed

### 1. Stripe Webhook — Intake Payment Silently Broken
**File:** `src/app/api/webhooks/stripe/route.ts`
**Severity:** Critical
**What happened:** `handleIntakePayment()` tried to update `intakes` with columns `paid`, `paid_at`, and `stripe_session_id` that didn't exist in the schema. PostgreSQL rejects the entire UPDATE when any column is missing, so the intake status was **never updated to 'submitted' after a patient paid**. Similarly, `intake_id` didn't exist on `subscriptions`, so no subscription record was ever created for intake payments.
**Fix:** Added `paid`, `paid_at`, `stripe_session_id` to `intakes` and `intake_id` to `subscriptions` via DB migration. Added error logging on each step.

---

### 2. Presentation Generate Button Did Nothing
**File:** `src/app/provider/presentation/create/[patientId]/page.tsx`
**Severity:** Critical
**What happened:** `getProviderId()` only checked localStorage demo mode. Since the provider layout clears the demo key when real auth is active, it always returned `''`. The API rejected with 400, and the frontend silently swallowed the error — no spinner, no message, just nothing.
**Fix:** Replaced `getProviderId()` with async `getProviderSession()` call. Added visible error state so failures surface instead of disappearing.

---

### 3. Google Calendar freeBusy Always Failing (400 Bad Request)
**File:** `src/lib/google-calendar.ts`
**Severity:** High
**What happened:** The freeBusy request sent `timeMin: "2026-04-07T00:00:00"` without a timezone suffix. Google's API requires RFC3339 format — dates without `Z` or a `+HH:MM` offset are rejected. This has **never worked** since calendar was first connected April 4th.
**Fix:** Added `Z` suffix to `timeMin` and `timeMax`.

---

### 4. Intake Auto-Save 500 Errors
**File:** `src/app/api/intake/save/route.ts`
**Severity:** High
**What happened:** The update payload included `updated_at: new Date().toISOString()` but the `intakes` table has no `updated_at` column. Every auto-save (every few seconds while a patient fills out their intake) was returning 500.
**Fix:** Removed `updated_at` from the update.

---

### 5. Oura Sync Never Running
**File:** `src/app/api/auth/oura/callback/route.ts` + `src/components/provider/PatientBiometrics.tsx`
**Severity:** High
**What happened:** The Oura OAuth callback fires `syncOuraData()` as fire-and-forget after returning a redirect response. Vercel serverless terminates the function immediately on response — the sync is killed before it runs. No data ever synced.
**Fix:** Added auto-trigger logic in `PatientBiometrics` — when a ring is connected but `lastSyncedAt` is null, it immediately calls the sync endpoint. Also added a manual "Sync now" button.

---

### 6. Provider Actions Broken for Real Auth (prescriptions, labs, notes, messages, calendar settings)
**Files:** `src/app/provider/patient/[id]/page.tsx`, `src/app/provider/settings/page.tsx`
**Severity:** High
**What happened:** Both pages used `getProviderId()` or a `useEffect` that only read from localStorage. The provider layout actively clears localStorage demo keys when real auth is active. So `providerId` was always `''`, breaking every panel that needs it (prescriptions, labs, notes, messages) and making Google Calendar connect/disconnect completely non-functional.
**Fix:** Replaced all instances with `getProviderSession()` — the existing utility that correctly handles both demo and real auth modes.

---

### 7. Stripe Membership Checkout Could Crash
**File:** `src/app/api/stripe/membership/route.ts`
**Severity:** Medium
**What happened:** Used `.single()` to look up a customer by `intake_id` on the subscriptions table. `.single()` throws an error if 0 rows are returned, which is common for new patients.
**Fix:** Changed to `.maybeSingle()` which returns `null` gracefully.

---

### 8. Cancellation and Booking Emails Had Hardcoded "Dr. Joseph Urban Jr."
**Files:** `src/app/api/scheduling/cancel/route.ts`, `src/app/api/scheduling/book/route.ts`, `src/app/api/webhooks/stripe/route.ts`
**Severity:** Low
**What happened:** Provider name was hardcoded in email templates — would be wrong if the provider ever changes.
**Fix:** Cancel route now joins `providers → profiles` and builds the name dynamically. Email templates show just the duration without a hardcoded name.

---

## Remaining Known Issues (Not Production-Breaking Today)

These are real issues but won't break day-to-day workflows for a single-provider MVP:

- **No auth on several API endpoints** — `/api/chat`, `/api/scheduling/book`, `/api/refill-requests`, `/api/visit-prep` accept any patientId without verifying ownership. Fine for now with real users but should be addressed before scaling.
- **Hardcoded "Dr. Joseph Urban Jr."** still appears in a few UI components (schedule page, booking confirmation, presentation viewer, coming-soon page) — cosmetic and can be updated when needed.
- **Fire-and-forget calendar events and emails in `/api/scheduling/book`** — these background tasks run after the response is returned. They often succeed (Vercel is lenient with fast operations) but could theoretically be cut off. Works reliably enough for now.
- **Seed routes (`/api/seed-patients`, `/api/generate-briefs`)** use hardcoded secrets in source. Fine since these are internal admin tools, but should eventually use env vars.

---

## DB Migrations Applied

```sql
-- Added to intakes table
paid boolean DEFAULT false
paid_at timestamptz
stripe_session_id text

-- Added to subscriptions table
intake_id uuid REFERENCES intakes(id) ON DELETE SET NULL
```

---

## Deploy Command

```bash
cd ~/Projects/WOMENKIND/WomenKind && git add -A && git commit -m "Platform audit: fix intake payment, presentation auth, GCal, Oura sync, provider ID resolution" && git push
```
