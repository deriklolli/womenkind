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
- Brief pipeline: `/api/intake/regenerate-brief` → `generateClinicalBrief()` → `invokeModel()` → writes `intakes.ai_brief`

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
- Cloud recording starts automatically via `startCloudRecording()` at room creation — providers do NOT need to hit record

## Auth / test accounts
- Provider: `josephurbanmd@gmail.com` / `password123`
- Patient `dlolli@gmail.com` password is **not** `password123` — ask the user if you need to log in as that account

## Working style
- User is a solo, non-developer founder. Keep explanations short. Do the work, don't narrate plans.
- Never ask the user to edit `.env.local` or paste keys into Vercel UI — do it from the CLI.
- Tight debug loops: when stuck, write a debug endpoint that dumps all suspect values in one response rather than probing fields one at a time.
- Don't promise "I'll wake up in N seconds" — just take the next action.
