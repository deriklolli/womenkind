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

## Recording → Transcription Pipeline
- **In-office**: browser → pre-signed S3 PUT → `/api/visits/ambient-recording` → AssemblyAI → `/api/visits/webhook/transcription`
- **Video call**: Daily cloud records → Daily fires `recording.ready-to-download` webhook → `/api/visits/webhook/recording` → AssemblyAI → `/api/visits/webhook/transcription` → Bedrock SOAP note → `encounter_notes` table
- `WEBHOOK_SECRET` must be set in Vercel — AssemblyAI sends it as `x-webhook-secret`, Daily signs with HMAC-SHA256 (`x-daily-signature` + `x-daily-timestamp`)
- Daily webhook registered at: `https://api.daily.co/v1/webhooks` (no `event_types` filter — Daily API doesn't support it; all events go to one endpoint)
- Debug endpoints: `/api/debug/reprocess-transcripts` (re-fires stuck AssemblyAI jobs), `/api/debug/create-test-video-appointment` (creates Daily room + appointment for testing)
- Cloud recording starts automatically via Daily's `enable_recording: 'cloud'` room property when participants join — do NOT call `startCloudRecording()` at booking time (nobody is in the room yet, it conflicts)

## Auth / test accounts
- Provider: `josephurbanmd@gmail.com` / `password123`
- Patient `dlolli@gmail.com` password is **not** `password123` — ask the user if you need to log in as that account
- Signup flow is fully server-side (`/api/auth/signup`): admin client with `email_confirm: true` skips Supabase SMTP, creates RDS `profiles` + `patients` rows immediately, signs in server-side, sends welcome email via Resend
- Patient signup link on the login page goes to `womenkindhealth.com/signup` (marketing site), not the in-app `/signup` route

## Working style
- User is a solo, non-developer founder. Keep explanations short. Do the work, don't narrate plans.
- Never ask the user to edit `.env.local` or paste keys into Vercel UI — do it from the CLI.
- Tight debug loops: when stuck, write a debug endpoint that dumps all suspect values in one response rather than probing fields one at a time.
- Don't promise "I'll wake up in N seconds" — just take the next action.
- **Verify all work before asking the user to take any action.** Run tsc, check logs, confirm DB state, trace the full end-to-end flow. Never ask the user to test something until every step has been verified independently. Incomplete fixes that require follow-up user testing waste the user's time.
