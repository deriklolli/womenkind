# Build 9: Scheduling System

## Overview

Add a full appointment scheduling system to WomenKind. Patients book time with their provider from within the patient portal. Members book free; non-members pay via Stripe at booking. Provider manages appointment types and weekly availability from the dashboard. Google Calendar integration ensures real-time conflict checking and auto-creates calendar events on booking.

**Architecture principle:** All tables include `provider_id` — this is a single-provider build that's multi-provider ready from day one.

---

## Database Schema

### New Tables

```sql
-- Appointment types a provider offers (e.g., "Initial Consultation", "Follow-Up")
CREATE TABLE appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  name TEXT NOT NULL,                    -- "Initial Consultation"
  description TEXT,                      -- "Comprehensive first visit..."
  duration_minutes INT NOT NULL,         -- 60
  price_cents INT NOT NULL DEFAULT 0,    -- 25000 = $250.00 (0 = free for members)
  color TEXT DEFAULT '#944fed',          -- Calendar color
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Provider's recurring weekly availability windows
CREATE TABLE provider_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  day_of_week INT NOT NULL,             -- 0=Sun, 1=Mon, ..., 6=Sat
  start_time TIME NOT NULL,             -- '09:00'
  end_time TIME NOT NULL,               -- '17:00'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual appointments (booked, canceled, completed)
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_type_id UUID NOT NULL REFERENCES appointment_types(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | canceled | completed | no_show
  -- Billing
  is_paid BOOLEAN DEFAULT false,
  amount_cents INT DEFAULT 0,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  -- Google Calendar
  google_calendar_event_id TEXT,
  -- Notes
  patient_notes TEXT,                    -- Patient's reason for visit
  provider_notes TEXT,                   -- Provider's pre/post-appointment notes
  -- Timestamps
  canceled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Provider-specific date overrides (block off a day, add extra hours)
CREATE TABLE availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  override_date DATE NOT NULL,
  is_unavailable BOOLEAN DEFAULT false,  -- true = block entire day
  start_time TIME,                       -- custom hours for this day
  end_time TIME,
  reason TEXT,                           -- "Conference", "Vacation"
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies (applied to all new tables)

- Patients can SELECT their own appointments
- Providers can SELECT/INSERT/UPDATE their own data across all scheduling tables
- Service role bypasses for API routes

---

## Build Steps

### Step 1: Database Migration
Create all four tables, indexes, and RLS policies via Supabase migration.

**Files:**
- Supabase migration SQL (run via MCP or dashboard)

---

### Step 2: Seed Demo Data
Seed appointment types and availability for Dr. Urban, plus a couple of demo appointments for Sarah Mitchell.

**Appointment types to seed:**
| Name | Duration | Price | Description |
|------|----------|-------|-------------|
| Initial Consultation | 60 min | $250 | Comprehensive first visit with full health assessment |
| Follow-Up Visit | 30 min | $150 | Treatment check-in and plan adjustment |
| Quick Check-In | 15 min | $75 | Brief symptom review or medication question |

**Availability to seed (Dr. Urban):**
- Monday: 9:00 AM – 4:00 PM
- Tuesday: 9:00 AM – 4:00 PM
- Wednesday: 10:00 AM – 3:00 PM
- Thursday: 9:00 AM – 4:00 PM
- Friday: 9:00 AM – 12:00 PM

**Demo appointments for Sarah:**
- 1 completed follow-up (last week)
- 1 confirmed upcoming initial consultation (next week)

**Files:**
- `scripts/seed-scheduling.ts`

---

### Step 3: API Routes — Availability Engine

**`GET /api/scheduling/availability`**
Query params: `providerId`, `date` (or `startDate`/`endDate`), `appointmentTypeId`

Logic:
1. Load provider's weekly availability for the requested date's day-of-week
2. Check for date overrides (blocked days, custom hours)
3. Divide available windows into slots based on appointment type duration
4. Subtract already-booked appointments (query `appointments` where status != 'canceled')
5. *(Phase 2)* Subtract Google Calendar busy times via Google Calendar API
6. Return array of available `{ start, end }` slots

**`GET /api/scheduling/appointment-types`**
Query params: `providerId`
Returns active appointment types for the provider.

**Files:**
- `src/app/api/scheduling/availability/route.ts`
- `src/app/api/scheduling/appointment-types/route.ts`
- `src/lib/scheduling.ts` (shared availability computation logic)

---

### Step 4: API Routes — Booking & Payment

**`POST /api/scheduling/book`**
Body: `{ patientId, providerId, appointmentTypeId, startsAt, patientNotes? }`

Logic:
1. Verify the slot is still available (prevent double-booking)
2. Check patient's membership status (query `subscriptions` for active membership)
3. **If member:** Create appointment with `is_paid: true, amount_cents: 0` → return `{ appointment, status: 'confirmed' }`
4. **If non-member:** Create appointment with `status: 'pending_payment'` → create Stripe Checkout Session with appointment metadata → return `{ appointment, checkoutUrl }`
5. *(Phase 2)* Create Google Calendar event

**`POST /api/scheduling/cancel`**
Body: `{ appointmentId, reason? }`
Sets status to `canceled`, canceled_at timestamp. *(Phase 2: Stripe refund logic)*

**Stripe Webhook Addition:**
Extend existing `/api/webhooks/stripe/route.ts` to handle `metadata.type === 'appointment'`:
- On `checkout.session.completed`: update appointment `is_paid: true`, `status: 'confirmed'`

**Files:**
- `src/app/api/scheduling/book/route.ts`
- `src/app/api/scheduling/cancel/route.ts`
- Update `src/app/api/webhooks/stripe/route.ts` (add appointment case)

---

### Step 5: Provider UI — Appointment Types & Availability

Add a new **"Schedule"** tab to the `ProviderNav` (alongside Intake Queue and My Patients).

**Schedule tab contains two sub-sections:**

**5a. Appointment Types Manager**
- Card list of appointment types with name, duration, price, description, color dot
- Add/edit modal (form: name, duration dropdown, price input, description textarea, color picker)
- Toggle active/inactive
- Drag to reorder (nice-to-have, skip for MVP)

**5b. Weekly Availability Editor**
- 7-day grid (Mon–Sun) showing time windows
- Each day: toggle on/off, set start/end time
- Date override section: block specific dates, add custom hours

**Files:**
- `src/app/provider/schedule/page.tsx` (main schedule management page)
- `src/components/provider/AppointmentTypesManager.tsx`
- `src/components/provider/AvailabilityEditor.tsx`
- Update `src/components/provider/ProviderNav.tsx` (add Schedule tab)

---

### Step 6: Provider UI — Appointments List

On the same Schedule tab, show upcoming appointments in a day/list view.

- Default: today + next 7 days
- Each appointment card: patient name, type, time, status badge, notes preview
- Click → navigate to patient profile (`/provider/patient/[id]`)
- Quick actions: mark complete, cancel

**Files:**
- `src/components/provider/AppointmentsList.tsx`
- `src/app/api/scheduling/appointments/route.ts` (GET: list provider's appointments)

---

### Step 7: Patient UI — Booking Page

New page at `/patient/schedule` accessible from the patient dashboard.

**Booking flow (3 steps):**

1. **Select appointment type** — Cards showing name, duration, price (shows "Included with membership" or "$X" for non-members)
2. **Pick a date & time** — Calendar date picker → show available time slots for that day. Slots load from `/api/scheduling/availability`
3. **Confirm & book** — Summary card. Optional "reason for visit" textarea.
   - Member: "Book Appointment" → immediate confirmation
   - Non-member: "Proceed to Payment" → Stripe Checkout → redirect back on success

**Post-booking:** Confirmation screen with appointment details, date/time, and a "Add to Calendar" link (generates .ics file).

**Files:**
- `src/app/patient/schedule/page.tsx`
- `src/components/patient/AppointmentTypeSelector.tsx`
- `src/components/patient/TimeSlotPicker.tsx`
- `src/components/patient/BookingConfirmation.tsx`

---

### Step 8: Patient Dashboard — Upcoming Appointments

Add an "Upcoming Appointments" section to the existing patient dashboard page.

- Show next 1-2 appointments with type, date/time, provider name
- "Schedule New" button links to `/patient/schedule`
- "Cancel" option on each appointment

**Files:**
- Update `src/app/patient/dashboard/page.tsx`

---

### Step 9: Google Calendar Integration (Mocked for Demo)

For the demo, mock Google Calendar integration with realistic behavior:
- Availability engine includes a `googleCalendarBusyTimes()` function that returns mock busy blocks
- When an appointment is booked, log "Google Calendar event created" with event details
- Provider schedule page shows a "Google Calendar: Connected ✓" badge

**Production-ready interface** (implement the abstraction, mock the implementation):
- `src/lib/google-calendar.ts` — exports `getProviderBusyTimes(providerId, start, end)` and `createCalendarEvent(...)` and `cancelCalendarEvent(...)`
- Swap mock for real Google Calendar API OAuth flow in Phase 2

**Files:**
- `src/lib/google-calendar.ts` (mock implementation with real interface)

---

### Step 10: Seed Demo Flow & Verify

- Seed everything needed for investor demo walkthrough
- Test full flow: provider sets types/availability → patient books → member skips payment → non-member pays → appointment shows on both sides
- Verify provider nav, patient nav, all new pages render correctly

---

## File Summary

### New Files (13)
```
src/app/api/scheduling/availability/route.ts
src/app/api/scheduling/appointment-types/route.ts
src/app/api/scheduling/book/route.ts
src/app/api/scheduling/cancel/route.ts
src/app/api/scheduling/appointments/route.ts
src/app/provider/schedule/page.tsx
src/app/patient/schedule/page.tsx
src/components/provider/AppointmentTypesManager.tsx
src/components/provider/AvailabilityEditor.tsx
src/components/provider/AppointmentsList.tsx
src/components/patient/AppointmentTypeSelector.tsx
src/components/patient/TimeSlotPicker.tsx
src/components/patient/BookingConfirmation.tsx
src/lib/scheduling.ts
src/lib/google-calendar.ts
scripts/seed-scheduling.ts
```

### Modified Files (3)
```
src/components/provider/ProviderNav.tsx        — add "Schedule" tab
src/app/patient/dashboard/page.tsx             — add upcoming appointments section
src/app/api/webhooks/stripe/route.ts           — handle appointment payment events
```

---

## Out of Scope (Phase 2)

- Real Google Calendar OAuth flow (currently mocked)
- Email/SMS appointment reminders
- Rescheduling flow (cancel + rebook for now)
- Recurring appointments
- Multi-provider calendar view / provider selection
- Stripe refunds on cancellation
- Waitlist / cancellation backfill
- Video call link generation (Zoom/Google Meet integration)
- Timezone handling beyond provider's local timezone
