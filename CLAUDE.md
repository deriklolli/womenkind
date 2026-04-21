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
- IAM user: `womenkind-app` (account `695385417786`), `AmazonBedrockFullAccess`
- Env vars on Vercel: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=us-west-2`, `BEDROCK_MODEL_ID`
- `src/lib/bedrock.ts` uses **explicit** credentials, not the default chain (Vercel's `VERCEL_OIDC_TOKEN` interferes)
- Brief pipeline: `/api/intake/regenerate-brief` → `generateClinicalBrief()` → `invokeModel()` → writes `intakes.ai_brief`

## Auth / test accounts
- Provider: `josephurbanmd@gmail.com` / `password123`
- Patient `dlolli@gmail.com` password is **not** `password123` — ask the user if you need to log in as that account

## Working style
- User is a solo, non-developer founder. Keep explanations short. Do the work, don't narrate plans.
- Never ask the user to edit `.env.local` or paste keys into Vercel UI — do it from the CLI.
- Tight debug loops: when stuck, write a debug endpoint that dumps all suspect values in one response rather than probing fields one at a time.
- Don't promise "I'll wake up in N seconds" — just take the next action.
