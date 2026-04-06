# Oura Ring Integration — Build Plan

**Goal:** Let patients connect their Oura Ring so Womenkind can pull sleep, skin temperature, HRV, and resting heart rate data — giving providers objective biometric trends between visits and giving patients visibility into how their body is responding to treatment.

**Why these four metrics:**
- **Skin temperature** — deviations correlate with hot flashes and hormonal shifts; Oura tracks nightly baseline deviation
- **Sleep staging** — sleep disruption is one of the top menopause complaints; deep/REM/light duration + efficiency score
- **HRV (Heart Rate Variability)** — sensitive to autonomic nervous system changes driven by estrogen decline; tracks stress resilience
- **Resting heart rate** — elevation can signal vasomotor episodes or anxiety; trending down indicates treatment response

---

## Phase 1: Database Schema

Create three new Supabase tables:

### `patient_wearable_connections`
Mirrors the existing `provider_calendar_connections` pattern.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | default gen_random_uuid() |
| patient_id | uuid (FK → patients.id) | |
| provider | text | 'oura' (extensible for future devices) |
| access_token_encrypted | text | encrypted at rest |
| refresh_token_encrypted | text | encrypted at rest |
| token_expires_at | timestamptz | |
| oura_user_id | text | nullable, from /personal_info |
| connected_at | timestamptz | default now() |
| last_synced_at | timestamptz | nullable |
| is_active | boolean | default true |

Unique constraint on `(patient_id, provider)` — one connection per device type per patient.

### `wearable_metrics`
Normalized table for all metric types. One row per metric per day.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | default gen_random_uuid() |
| patient_id | uuid (FK → patients.id) | |
| connection_id | uuid (FK → patient_wearable_connections.id) | |
| metric_date | date | the day this data covers |
| metric_type | text | 'sleep_score', 'sleep_deep_minutes', 'sleep_rem_minutes', 'sleep_light_minutes', 'sleep_efficiency', 'sleep_total_minutes', 'temperature_deviation', 'temperature_trend_deviation', 'hrv_average', 'resting_heart_rate' |
| value | numeric | the metric value |
| raw_payload | jsonb | nullable — full Oura response for that day (for debugging/future use) |
| synced_at | timestamptz | when we pulled this data |

Unique constraint on `(patient_id, metric_date, metric_type)` — upsert on re-sync.

Index on `(patient_id, metric_type, metric_date)` for time-range queries.

### `wearable_sync_log`
Lightweight audit trail for debugging sync issues.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| connection_id | uuid (FK) | |
| synced_at | timestamptz | |
| records_fetched | integer | |
| status | text | 'success', 'partial', 'error' |
| error_message | text | nullable |

---

## Phase 2: OAuth Flow (Authorization Code)

Follow the exact pattern from `/api/auth/google/` — initiate + callback routes with CSRF state encoding.

### Oura OAuth Details
- **Auth URL:** `https://cloud.ouraring.com/oauth/authorize`
- **Token URL:** `https://api.ouraring.com/oauth/token`
- **Scopes needed:** `daily heartrate personal`
  - `daily` → sleep, readiness (includes temperature deviation), activity
  - `heartrate` → time-series heart rate (we'll use for resting HR)
  - `personal` → user info (optional, for identity verification)
- **Grant type:** Authorization Code (server-side) — gives us refresh tokens
- **Token lifetime:** 30 days, with refresh token for silent renewal

### New env vars
```
OURA_CLIENT_ID=
OURA_CLIENT_SECRET=
OURA_REDIRECT_URI=https://womenkind.vercel.app/api/auth/oura/callback
```

### Routes to create

**`/api/auth/oura/initiate/route.ts`** (GET)
1. Verify patient is authenticated (Supabase auth check)
2. Generate CSRF state: `base64url({ patientId, nonce: crypto.randomUUID() })`
3. Build authorization URL:
   ```
   https://cloud.ouraring.com/oauth/authorize
     ?client_id=OURA_CLIENT_ID
     &redirect_uri=OURA_REDIRECT_URI
     &response_type=code
     &scope=daily+heartrate+personal
     &state={csrf_state}
   ```
4. Return redirect URL (or redirect directly)

**`/api/auth/oura/callback/route.ts`** (GET)
1. Extract `code` and `state` from query params
2. Decode state, validate nonce
3. Exchange code for tokens: POST to `https://api.ouraring.com/oauth/token` with `grant_type=authorization_code`
4. Encrypt access_token and refresh_token (same encryption approach as Google Calendar tokens)
5. Upsert into `patient_wearable_connections` (on conflict `patient_id, provider`)
6. Trigger initial data sync (last 30 days)
7. Redirect patient back to dashboard with success indicator

**`/api/auth/oura/disconnect/route.ts`** (POST)
1. Set `is_active = false` on the connection
2. Clear encrypted tokens
3. Optionally: keep historical metric data (it's the patient's data)

### Token refresh helper (`/src/lib/oura.ts`)
- `getValidOuraToken(connectionId)` — checks `token_expires_at`, refreshes if within 5-minute buffer (mirrors Google Calendar pattern)
- `encryptToken()` / `decryptToken()` — reuse existing encryption utils

---

## Phase 3: Data Sync API

### Oura API Endpoints We'll Hit

| Our metric | Oura endpoint | Fields to extract |
|---|---|---|
| Sleep score, staging, efficiency | `/v2/usercollection/daily_sleep` | score, deep_sleep_duration, rem_sleep_duration, light_sleep_duration, total_sleep_duration, contributors.efficiency, average_hrv, average_heart_rate, lowest_heart_rate |
| Temperature deviation | `/v2/usercollection/daily_readiness` | temperature_deviation, temperature_trend_deviation, score |
| HRV (daily average) | From daily_sleep response | average_hrv field |
| Resting heart rate | From daily_sleep response | lowest_heart_rate field |

Note: Sleep endpoint already includes average_hrv and heart rate data, so we may only need two API calls (daily_sleep + daily_readiness) per sync.

### Routes to create

**`/api/wearables/sync/route.ts`** (POST)
1. Auth check — patient must be logged in
2. Look up active wearable connection
3. Get valid token (refresh if needed)
4. Fetch data from Oura (default: last 7 days; initial connect: last 30 days)
5. Parse and normalize into `wearable_metrics` rows
6. Upsert all rows (on conflict `patient_id, metric_date, metric_type`)
7. Update `last_synced_at` on connection
8. Log to `wearable_sync_log`
9. Return summary: `{ synced: true, days: 7, metrics: 42 }`

**`/api/wearables/metrics/route.ts`** (GET)
1. Auth check
2. Query params: `patientId`, `metricType` (optional), `startDate`, `endDate`
3. Query `wearable_metrics` with filters
4. Return sorted by metric_date ascending (ready for charting)
5. Provider access: if requester is a provider, allow fetching any patient's metrics

### Sync strategy
- **On connect:** Pull last 30 days immediately
- **On dashboard load:** If `last_synced_at` is more than 6 hours ago, trigger a background sync for the last 7 days
- **Manual refresh:** Patient can tap a "Sync Now" button
- **Future (Phase 5):** Oura webhooks for real-time push

---

## Phase 4: Patient Dashboard — Wearable Data View

### Connect/Disconnect UI
Add to patient dashboard as a new section or within an existing health view:
- **Not connected state:** "Connect Your Oura Ring" card with brief explanation of what data will be tracked and why. "Connect" button triggers `/api/auth/oura/initiate`
- **Connected state:** Shows last synced time, "Sync Now" button, "Disconnect" option
- Follow existing light theme: cream background, white cards, violet accents, no glows

### Biometric Trends Component (`/src/components/patient/WearableTrends.tsx`)
Uses Recharts (already in the project) to display:

**Layout:** 2×2 grid of small trend charts (responsive, stacks on mobile)

1. **Sleep Quality** — Line chart of sleep score (0-100) over last 30 days, with colored bands for good/fair/poor. Below the chart: average deep sleep and REM minutes as small stat cards.

2. **Skin Temperature** — Line chart of temperature_deviation over last 30 days. Highlight spikes (potential hot flash nights). Baseline at 0°, deviations in ±°C/°F.

3. **HRV** — Line chart of average_hrv over last 30 days. Higher is generally better. Show trend arrow (improving/declining).

4. **Resting Heart Rate** — Line chart of lowest_heart_rate over last 30 days. Lower is generally better (with treatment response).

Each chart: clean, minimal, Plus Jakarta Sans labels, violet (#944fed) for the line color, subtle grid, tooltip on hover showing exact value + date.

### Where it lives in the dashboard
New `DashboardView` value: `'wearables'`
- Add to `QuickActions` or `SecondaryActions` as "My Biometrics" or "Health Trends"
- Accessible from the main dashboard view

---

## Phase 5: Provider View — Patient Biometrics Tab

### Patient Record Integration
Add a "Biometrics" tab to `/provider/patient/[id]/page.tsx` (alongside Visits, Prescriptions, Labs, Messages).

**`/src/components/provider/PatientBiometrics.tsx`**
- Same 2×2 chart grid as patient view, but with:
  - Date range selector (7d / 30d / 90d)
  - Overlay markers for visit dates (vertical dashed lines on charts showing when the patient had an appointment)
  - Overlay markers for prescription changes (e.g., "Started Estradiol 0.05mg" annotation)
- Summary stats at the top: "Sleep improving 12% over 30 days", "Temperature spikes down from 4/week to 1/week"
- This gives the provider objective data to discuss during follow-ups

### Clinical Brief Integration (future)
When generating AI clinical briefs, include wearable trend summary if data exists:
- "Patient's Oura data shows sleep efficiency improved from 72% to 84% over the past 30 days since starting estradiol. Temperature deviations have decreased. HRV trending upward."

---

## Phase 6: Oura Webhooks (Future)

Oura supports webhook subscriptions for near-real-time data push. This replaces polling.

**`/api/webhooks/oura/route.ts`** (POST)
- Receives webhook payloads when new data is available
- Validates webhook signature
- Triggers sync for the affected patient
- Updates `wearable_metrics` in real-time

This is a nice-to-have for post-MVP. The polling approach in Phase 3 is sufficient for investor demo.

---

## File Summary

| File | Action |
|---|---|
| `src/app/api/auth/oura/initiate/route.ts` | Create — OAuth initiation |
| `src/app/api/auth/oura/callback/route.ts` | Create — OAuth callback + initial sync |
| `src/app/api/auth/oura/disconnect/route.ts` | Create — Disconnect wearable |
| `src/app/api/wearables/sync/route.ts` | Create — Data sync endpoint |
| `src/app/api/wearables/metrics/route.ts` | Create — Metrics query endpoint |
| `src/lib/oura.ts` | Create — Token management, API helpers, data normalization |
| `src/components/patient/WearableTrends.tsx` | Create — 2×2 biometric chart grid |
| `src/components/patient/WearableConnect.tsx` | Create — Connect/disconnect/sync UI |
| `src/components/provider/PatientBiometrics.tsx` | Create — Provider view of patient wearable data |
| `src/app/patient/dashboard/page.tsx` | Modify — Add wearables view + QuickAction |
| `src/app/provider/patient/[id]/page.tsx` | Modify — Add Biometrics tab |
| Supabase migration | Create tables: patient_wearable_connections, wearable_metrics, wearable_sync_log |

### Env vars to add
```
OURA_CLIENT_ID=
OURA_CLIENT_SECRET=
OURA_REDIRECT_URI=http://localhost:3000/api/auth/oura/callback
```

Production redirect URI: `https://womenkind.vercel.app/api/auth/oura/callback`

---

## Build Order

1. **Schema first** — Create the three tables in Supabase
2. **OAuth flow** — initiate, callback, disconnect routes + `oura.ts` lib
3. **Data sync** — sync route + metrics query route
4. **Patient UI** — connect card + biometric trends charts
5. **Provider UI** — biometrics tab on patient record
6. **Polish** — demo data seeding, error states, loading states
7. **Webhooks** — real-time push (post-MVP)

Estimated effort: 2-3 sessions to get through Phases 1-5 with demo data.
