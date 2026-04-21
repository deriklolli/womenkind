# Phase 3: AWS RDS Migration Design

**Date:** 2026-04-21
**Goal:** Move all application database tables from Supabase PostgreSQL to AWS RDS PostgreSQL so the data layer is covered under the AWS HIPAA BAA. Supabase Auth remains in place.

---

## Context

Phases 1 & 2 migrated the AI layer (Anthropic API → AWS Bedrock) and file storage (Supabase Storage → AWS S3). Phase 3 completes the AWS consolidation by moving the database. There is no production data to preserve — the migration is a full rebuild on RDS.

---

## Scope

### What moves to RDS
All application tables:
- `profiles`, `patients`, `providers`
- `appointments`, `appointment_types`, `provider_availability`, `availability_overrides`
- `visits`, `encounter_notes`, `intakes`
- `prescriptions`, `refill_requests`
- `messages`, `notifications`
- `clinics`, `clinic_providers`, `clinic_appointment_requests`
- `phi_access_log`, `subscriptions`, `lab_orders`, `provider_notes`

### What stays on Supabase
- `auth.users` — Supabase Auth continues managing login, sessions, Google OAuth, and Oura OAuth. No changes to auth flows.

### Cross-database reference
The `profiles.id` column is a UUID that matches `auth.users.id` in Supabase. On RDS this is stored as a plain UUID — no foreign key constraint across databases, just a logical reference. `getServerSession.ts` reads the Supabase auth session to get the user UUID, then queries RDS for the profile/role.

---

## Infrastructure

### RDS Instances
- **Engine:** PostgreSQL 16 (standard RDS, not Aurora)
- **Region:** `us-west-2` (matches S3 bucket)
- **Access:** Public endpoint with SSL required
- **Credentials:** IAM master password stored in AWS Secrets Manager
- **Two instances:**
  - `womenkind-staging` — used by Vercel staging branch
  - `womenkind-production` — used by Vercel main branch
- **HIPAA coverage:** Both instances covered under the existing AWS HIPAA BAA

### Environment Variables
Added to Vercel (branch-specific) and `.env.local`:
- `DATABASE_URL` — RDS connection string with SSL (`?sslmode=require`)

---

## ORM: Drizzle

### Packages
- `drizzle-orm` — query builder
- `drizzle-kit` — migrations CLI
- `postgres` — PostgreSQL connection driver

### New files
- `src/lib/db/schema.ts` — TypeScript definitions for all RDS tables
- `src/lib/db/index.ts` — exports the Drizzle client (`db`)
- `drizzle.config.ts` — Drizzle Kit config pointing at `DATABASE_URL`

### Schema notes
- The `get_nearby_clinics(lat, lng, radius_miles)` Haversine stored procedure is recreated on RDS via a migration.
- All JSONB fields (`answers`, `ai_brief`) are preserved as-is.
- All enum-like status fields are stored as `text` with check constraints (same as Supabase).

---

## Route Migration

### Pattern
Every API route that currently uses `getServiceSupabase()` or `createClient()` for database queries is updated to use the Drizzle client instead.

**Before:**
```ts
const supabase = getServiceSupabase()
const { data, error } = await supabase
  .from('appointments')
  .select('*, patients(*)')
  .eq('id', id)
  .single()
```

**After:**
```ts
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'

const result = await db.query.appointments.findFirst({
  where: eq(appointments.id, id),
  with: { patient: true }
})
```

### What does NOT change in routes
- Auth session checks — still use `getServerSession` → Supabase
- Business logic, response shapes, error handling
- PHI audit logging pattern (fire-and-forget, non-blocking)

### Affected helpers
- `src/lib/getServerSession.ts` — reads Supabase auth session, then queries RDS for profile/role via Drizzle
- `src/lib/phi-audit.ts` — rewritten to write `phi_access_log` via Drizzle (same fire-and-forget pattern)
- `src/lib/scheduling.ts` — business logic unchanged; underlying queries updated to Drizzle

### Routes to migrate (~42 total)
| Group | Routes |
|-------|--------|
| Auth/Profile | `/api/auth/create-patient`, `/api/auth/welcome` |
| Scheduling | `/api/scheduling/appointments`, `/api/scheduling/appointment-types`, `/api/scheduling/availability`, `/api/scheduling/book`, `/api/scheduling/cancel`, `/api/scheduling/calendar-export` |
| Clinical | `/api/visits/webhook/transcription`, `/api/visits/ambient-recording`, `/api/visits/webhook/recording`, `/api/visit-prep`, `/api/checkin` |
| Intake | `/api/intake/submit`, `/api/intake/save`, `/api/generate-briefs` |
| Messaging | `/api/messages`, `/api/notifications` |
| Prescriptions | `/api/prescriptions`, `/api/refill-requests` |
| Chat | `/api/chat` |
| Clinics | `/api/clinics/nearby`, `/api/clinics/geocode`, `/api/clinics/request` |
| Stripe | `/api/stripe/checkout`, `/api/stripe/cancel`, `/api/stripe/membership`, `/api/stripe/portal`, `/api/webhooks/stripe` |
| Wearables | `/api/wearables/sync`, `/api/wearables/status`, `/api/wearables/metrics` |
| Google OAuth | `/api/auth/google/initiate`, `/api/auth/google/callback`, `/api/auth/google/status`, `/api/auth/google/disconnect`, `/api/auth/google/debug` |
| Oura OAuth | `/api/auth/oura/initiate`, `/api/auth/oura/callback`, `/api/auth/oura/disconnect` |
| Canvas | `/api/canvas/labs/order`, `/api/canvas/prescribe` |
| Presentations | `/api/presentations/viewed`, `/api/presentation/generate`, `/api/presentation/ai-notes` |
| Reminders | `/api/reminders/appointments` |
| Dev/Seed | `/api/seed-patients`, `/api/seed-labs` |

---

## Deployment

### Approach
Full migration in one shot — no incremental rollout. No production data to preserve.

### Steps
1. Create both RDS instances (staging + production) in AWS Console
2. Store credentials in Secrets Manager; add `DATABASE_URL` to Vercel env vars (branch-specific) and `.env.local`
3. Run Drizzle migrations to create schema on both instances
4. Deploy to `staging` branch → verify on staging URL
5. Manually test: patient login, booking, messaging, intake, ambient recording/transcription
6. Deploy to `main` → production live on RDS
7. After confirming production works: drop unused application tables from Supabase (keep `auth.*` schema)

### Supabase after migration
- Supabase project stays active (auth only)
- Application data tables can be dropped to reduce cost
- `auth.users`, `auth.sessions`, and related auth schema remain untouched
