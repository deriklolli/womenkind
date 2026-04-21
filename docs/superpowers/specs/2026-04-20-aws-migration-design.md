# AWS Migration Design

**Date:** 2026-04-20  
**Status:** Approved  
**Goal:** Replace Anthropic direct API, Supabase Storage, and Supabase DB with AWS services to achieve HIPAA compliance via a single free AWS BAA — eliminating ~$599+/mo in Supabase Team plan costs.

---

## Context

Womenkind is a HIPAA-regulated telehealth platform. All vendors that touch PHI require a signed BAA. Supabase requires upgrading to Team ($599/mo) for a BAA. Anthropic requires an Enterprise agreement (~$5k/mo). AWS provides a single free BAA that covers Bedrock (Claude), S3, and RDS — replacing all three at a fraction of the cost.

**Supabase Auth is NOT being migrated.** Auth data (login credentials, session tokens) is not PHI and does not require a BAA. It stays on Supabase Pro ($25/mo).

---

## Approach

Phased migration — one service at a time, lowest risk to highest:

1. **Phase 1 — AWS Bedrock** (replaces Anthropic API) — 7 files
2. **Phase 2 — AWS S3** (replaces Supabase Storage) — 3 files
3. **Phase 3 — AWS RDS Postgres** (replaces Supabase DB) — env vars + connection layer

Each phase is independently deployable and rollback-safe.

---

## Phase 1 — AWS Bedrock

**What changes:** All 7 API routes that call `https://api.anthropic.com/v1/messages` are updated to call AWS Bedrock instead.

**New shared helper:** `src/lib/bedrock.ts`  
Wraps the AWS SDK's `BedrockRuntimeClient` + `InvokeModelCommand`. All 7 routes call this helper instead of doing their own fetch. This centralises auth, model ID, and error handling.

**Routes affected:**
- `src/app/api/chat/route.ts`
- `src/app/api/generate-briefs/route.ts`
- `src/app/api/intake/submit/route.ts`
- `src/app/api/presentation/ai-notes/route.ts`
- `src/app/api/visit-prep/route.ts`
- `src/app/api/visits/webhook/transcription/route.ts`
- `src/app/api/seed-patients/route.ts`

**Model:** `anthropic.claude-sonnet-4-20250514-v1:0` (Bedrock model ID for Claude Sonnet 4)

**Auth:** AWS IAM credentials via environment variables — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`. An IAM user with `AmazonBedrockFullAccess` policy is created in the AWS console.

**Env vars removed:** `ANTHROPIC_API_KEY`  
**Env vars added:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

**Request format:** Bedrock uses the same Messages API structure as the direct Anthropic API. The `system`, `messages`, `max_tokens`, and `model` fields are identical. Only the HTTP endpoint, auth header, and model ID string change.

**Testing:** Existing unit tests for routes that mock the Anthropic fetch are updated to mock the Bedrock SDK call instead.

---

## Phase 2 — AWS S3

**What changes:** Audio recordings uploaded by AmbientRecorder are stored in an S3 bucket instead of Supabase Storage. Signed URL generation moves to AWS.

**S3 bucket:** `womenkind-recordings` (private, us-west-1, server-side encryption AES-256 enabled)

**Files affected:**
- `src/components/provider/AmbientRecorder.tsx` — upload via S3 pre-signed PUT URL
- `src/lib/recording-context.tsx` — same
- `src/app/api/visits/ambient-recording/route.ts` — generate S3 pre-signed GET URL for AssemblyAI

**Upload flow:**
1. Client requests a pre-signed PUT URL from a new API route: `POST /api/storage/recording-upload-url`
2. Server generates a pre-signed S3 PUT URL (5-minute expiry) using `@aws-sdk/s3-request-presigner`
3. Client uploads directly to S3 using the pre-signed URL (no data passes through the Next.js server)
4. Client notifies `/api/visits/ambient-recording` with the S3 key
5. Server generates a pre-signed GET URL (1-hour expiry) and submits to AssemblyAI

**New helper:** `src/lib/s3.ts` — wraps `S3Client`, `PutObjectCommand`, `GetObjectCommand`, and `getSignedUrl` from the AWS SDK.

**Env vars added:** `AWS_S3_BUCKET` (value: `womenkind-recordings`)  
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are shared with Phase 1.

**Supabase Storage migration SQL:** The `recordings` bucket migration (`20260420_recordings_bucket_private.sql`) remains in place until Phase 3 fully cuts over — it does no harm.

---

## Phase 3 — AWS RDS Postgres

**What changes:** The Postgres database moves from Supabase to AWS RDS. Supabase Auth remains on Supabase Pro and is unaffected.

**RDS instance:** `db.t4g.small` (2 vCPU, 2GB RAM), Postgres 17, us-west-1, encrypted at rest, single-AZ (upgrade to Multi-AZ when revenue warrants).

**Data migration steps:**
1. `pg_dump` from Supabase to a `.sql` file
2. Provision RDS instance via AWS Console
3. `pg_restore` into RDS
4. Run all existing migrations against RDS to confirm schema parity
5. Smoke test against RDS with staging traffic
6. Cut over by swapping `DATABASE_URL` env var in Vercel
7. Verify, then cancel Supabase Team plan (keep Pro for Auth)

**Connection layer:** Replace `createClient` from `@supabase/supabase-js` with the `postgres` npm package (a lightweight Postgres client). A new `src/lib/db.ts` exports a single shared connection pool used by all API routes.

**RLS policies:** Supabase RLS is a Postgres-native feature and migrates as-is via `pg_dump`. The existing migration files in `supabase/migrations/` are run against RDS unchanged.

**RPC function:** `get_nearby_clinics` (used in `/api/clinics/nearby/route.ts`) is a Postgres function and migrates as-is with `pg_dump`. No Lambda needed.

**Env vars removed:** `SUPABASE_SERVICE_ROLE_KEY` (no longer needed — DB access goes through `DATABASE_URL`)  
**Env vars added:** `DATABASE_URL` (standard Postgres connection string)  
**Env vars kept:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` (still needed for Supabase Auth in the browser and middleware)

**Files affected:** All API routes that use `getServiceSupabase()` or `createClient` for DB access — approximately 42 routes. These are updated to use `src/lib/db.ts` instead. This is the highest-volume change but is mechanical: find/replace the client initialisation and query syntax differences between the Supabase JS client and the `postgres` package.

**Testing:** Run the full existing test suite against RDS before cutting over.

---

## Cost After Migration

| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro (Auth only) | $25 |
| AWS RDS db.t4g.small | ~$40 |
| AWS S3 (recordings) | ~$5 |
| AWS Bedrock (Claude usage) | ~$20–80 |
| **Total** | **~$90–150/mo** |

vs. Supabase Team + Anthropic Enterprise: **$599+/mo**

---

## AWS Account Setup (one-time, before any phase)

1. Create AWS account (or use existing)
2. Sign the AWS HIPAA BAA: AWS Console → My Account → AWS Artifact → Business Associate Agreement
3. Create IAM user `womenkind-app` with policies:
   - `AmazonBedrockFullAccess`
   - `AmazonS3FullAccess` (scoped to `womenkind-recordings` bucket)
   - `AmazonRDSFullAccess` (or scoped connection policy)
4. Generate access keys → add to Vercel env vars

---

## What Is Not Changing

- Supabase Auth (login, signup, sessions, middleware) — stays on Supabase Pro
- Daily.co (video visits)
- AssemblyAI (transcription)
- Resend (email)
- Vercel (hosting)
- Stripe (payments)
- All existing database migrations and RLS policies
