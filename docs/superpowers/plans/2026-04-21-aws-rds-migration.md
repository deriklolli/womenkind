# Phase 3: AWS RDS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Supabase database queries with AWS RDS PostgreSQL via Drizzle ORM across ~42 API routes, while keeping Supabase Auth unchanged.

**Architecture:** Two RDS PostgreSQL 16 instances (staging + production) in us-west-2. A new `src/lib/db/` module provides the Drizzle client and schema. Every API route that called `getServiceSupabase()` or `createClient()` for database queries is updated to use the Drizzle `db` client instead. Auth files (`getServerSession.ts`, browser/server Supabase clients) are unchanged except for the DB lookup in `getServerSession.ts`.

**Tech Stack:** `drizzle-orm`, `drizzle-kit`, `postgres` (npm), AWS RDS PostgreSQL 16

---

## File Map

**Create:**
- `src/lib/db/schema.ts` — all table definitions (Drizzle pgTable)
- `src/lib/db/relations.ts` — all Drizzle relations (enables `with:` queries)
- `src/lib/db/index.ts` — Drizzle client export
- `drizzle.config.ts` — Drizzle Kit config

**Modify:**
- `src/lib/getServerSession.ts` — DB lookup: Supabase → Drizzle
- `src/lib/phi-audit.ts` — phi_access_log insert: Supabase → Drizzle
- `src/lib/oura.ts` — all DB operations: Supabase → Drizzle
- All ~42 API routes (listed in tasks below)

**No change:**
- `src/lib/supabase.ts` — still used by Supabase Auth
- `src/lib/supabase-browser.ts` — still used by Supabase Auth
- `src/lib/supabase-server.ts` — DELETE after all routes migrated (Task 17)
- `src/lib/scheduling.ts` — pure business logic, no DB calls

---

## Task 1: Install Packages + Drizzle Config

**Files:**
- Modify: `package.json`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Install Drizzle packages**

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

Expected: `package.json` now lists `drizzle-orm`, `postgres` in dependencies and `drizzle-kit` in devDependencies.

- [ ] **Step 2: Create drizzle.config.ts**

```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts
git commit -m "feat: install drizzle-orm and drizzle-kit"
```

---

## Task 2: Write Drizzle Schema

**Files:**
- Create: `src/lib/db/schema.ts`

All column property names use snake_case to match DB column names — this preserves the response shapes that API clients expect, minimizing frontend changes.

- [ ] **Step 1: Create src/lib/db/schema.ts**

```ts
import {
  pgTable, uuid, text, integer, boolean, timestamp, real, json, unique
} from 'drizzle-orm/pg-core'

// ── Profiles ────────────────────────────────────────────────────────────────
// id matches auth.users.id in Supabase (logical reference, no FK across DBs)
export const profiles = pgTable('profiles', {
  id:         uuid('id').primaryKey(),
  first_name: text('first_name'),
  last_name:  text('last_name'),
  email:      text('email'),
  home_lat:   real('home_lat'),
  home_lng:   real('home_lng'),
  home_zip:   text('home_zip'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Patients ─────────────────────────────────────────────────────────────────
export const patients = pgTable('patients', {
  id:            uuid('id').primaryKey().defaultRandom(),
  profile_id:    uuid('profile_id').notNull().references(() => profiles.id),
  date_of_birth: text('date_of_birth'),
  state:         text('state'),
  phone:         text('phone'),
  is_active:     boolean('is_active').notNull().default(true),
  created_at:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Providers ─────────────────────────────────────────────────────────────────
export const providers = pgTable('providers', {
  id:         uuid('id').primaryKey().defaultRandom(),
  profile_id: uuid('profile_id').notNull().references(() => profiles.id),
  is_active:  boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Appointment Types ─────────────────────────────────────────────────────────
export const appointment_types = pgTable('appointment_types', {
  id:               uuid('id').primaryKey().defaultRandom(),
  provider_id:      uuid('provider_id').references(() => providers.id),
  name:             text('name').notNull(),
  duration_minutes: integer('duration_minutes').notNull(),
  price_cents:      integer('price_cents').notNull().default(0),
  color:            text('color'),
  created_at:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Appointments ──────────────────────────────────────────────────────────────
export const appointments = pgTable('appointments', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  provider_id:             uuid('provider_id').notNull().references(() => providers.id),
  patient_id:              uuid('patient_id').notNull().references(() => patients.id),
  appointment_type_id:     uuid('appointment_type_id').references(() => appointment_types.id),
  starts_at:               timestamp('starts_at', { withTimezone: true }).notNull(),
  ends_at:                 timestamp('ends_at', { withTimezone: true }).notNull(),
  status:                  text('status').notNull().default('confirmed'),
  is_paid:                 boolean('is_paid').default(false),
  amount_cents:            integer('amount_cents').default(0),
  patient_notes:           text('patient_notes'),
  provider_notes:          text('provider_notes'),
  stripe_session_id:       text('stripe_session_id'),
  video_room_url:          text('video_room_url'),
  video_room_name:         text('video_room_name'),
  google_calendar_event_id: text('google_calendar_event_id'),
  reminder_sent_at:        timestamp('reminder_sent_at', { withTimezone: true }),
  completed_at:            timestamp('completed_at', { withTimezone: true }),
  canceled_at:             timestamp('canceled_at', { withTimezone: true }),
  created_at:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Provider Availability ─────────────────────────────────────────────────────
export const provider_availability = pgTable('provider_availability', {
  id:          uuid('id').primaryKey().defaultRandom(),
  provider_id: uuid('provider_id').notNull().references(() => providers.id),
  day_of_week: integer('day_of_week').notNull(),
  start_time:  text('start_time').notNull(),
  end_time:    text('end_time').notNull(),
  is_active:   boolean('is_active').notNull().default(true),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Availability Overrides ────────────────────────────────────────────────────
export const availability_overrides = pgTable('availability_overrides', {
  id:           uuid('id').primaryKey().defaultRandom(),
  provider_id:  uuid('provider_id').notNull().references(() => providers.id),
  date:         text('date').notNull(),
  start_time:   text('start_time'),
  end_time:     text('end_time'),
  is_available: boolean('is_available').notNull().default(false),
  created_at:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Visits ────────────────────────────────────────────────────────────────────
export const visits = pgTable('visits', {
  id:             uuid('id').primaryKey().defaultRandom(),
  patient_id:     uuid('patient_id').notNull().references(() => patients.id),
  provider_id:    uuid('provider_id').notNull().references(() => providers.id),
  appointment_id: uuid('appointment_id').references(() => appointments.id),
  visit_type:     text('visit_type').notNull(),
  visit_date:     text('visit_date').notNull(),
  symptom_scores: json('symptom_scores'),
  checked_in_at:  timestamp('checked_in_at', { withTimezone: true }),
  created_at:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Encounter Notes ───────────────────────────────────────────────────────────
export const encounter_notes = pgTable('encounter_notes', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  patient_id:              uuid('patient_id').notNull().references(() => patients.id),
  provider_id:             uuid('provider_id').notNull().references(() => providers.id),
  appointment_id:          uuid('appointment_id').references(() => appointments.id),
  source:                  text('source').notNull(),
  recording_storage_path:  text('recording_storage_path'),
  recording_url:           text('recording_url'),
  status:                  text('status').notNull().default('transcribing'),
  assemblyai_transcript_id: text('assemblyai_transcript_id'),
  transcript:              text('transcript'),
  chief_complaint:         text('chief_complaint'),
  hpi:                     text('hpi'),
  ros:                     text('ros'),
  assessment:              text('assessment'),
  plan:                    text('plan'),
  created_at:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Intakes ───────────────────────────────────────────────────────────────────
export const intakes = pgTable('intakes', {
  id:               uuid('id').primaryKey().defaultRandom(),
  patient_id:       uuid('patient_id').references(() => patients.id),
  provider_id:      uuid('provider_id').references(() => providers.id),
  status:           text('status').notNull().default('draft'),
  answers:          json('answers'),
  ai_brief:         json('ai_brief'),
  submitted_at:     timestamp('submitted_at', { withTimezone: true }),
  paid:             boolean('paid').default(false),
  paid_at:          timestamp('paid_at', { withTimezone: true }),
  stripe_session_id: text('stripe_session_id'),
  started_at:       timestamp('started_at', { withTimezone: true }).defaultNow(),
  created_at:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Prescriptions ─────────────────────────────────────────────────────────────
export const prescriptions = pgTable('prescriptions', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  patient_id:          uuid('patient_id').notNull().references(() => patients.id),
  provider_id:         uuid('provider_id').notNull().references(() => providers.id),
  medication_name:     text('medication_name').notNull(),
  dosage:              text('dosage').notNull(),
  frequency:           text('frequency').notNull(),
  quantity_dispensed:  integer('quantity_dispensed'),
  doses_per_day:       integer('doses_per_day'),
  refills:             integer('refills').default(0),
  refills_used:        integer('refills_used').default(0),
  prescribed_at:       timestamp('prescribed_at', { withTimezone: true }).notNull().defaultNow(),
  last_filled_at:      timestamp('last_filled_at', { withTimezone: true }),
  runs_out_at:         timestamp('runs_out_at', { withTimezone: true }),
  status:              text('status').notNull().default('active'),
  updated_at:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  created_at:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Refill Requests ───────────────────────────────────────────────────────────
export const refill_requests = pgTable('refill_requests', {
  id:              uuid('id').primaryKey().defaultRandom(),
  prescription_id: uuid('prescription_id').notNull().references(() => prescriptions.id),
  patient_id:      uuid('patient_id').notNull().references(() => patients.id),
  provider_id:     uuid('provider_id').notNull().references(() => providers.id),
  patient_note:    text('patient_note'),
  provider_note:   text('provider_note'),
  status:          text('status').notNull().default('pending'),
  reviewed_at:     timestamp('reviewed_at', { withTimezone: true }),
  updated_at:      timestamp('updated_at', { withTimezone: true }),
  created_at:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Messages ──────────────────────────────────────────────────────────────────
export const messages = pgTable('messages', {
  id:           uuid('id').primaryKey().defaultRandom(),
  thread_id:    uuid('thread_id').notNull(),
  sender_type:  text('sender_type').notNull(),
  sender_id:    uuid('sender_id').notNull(),
  recipient_id: uuid('recipient_id').notNull(),
  subject:      text('subject'),
  body:         text('body').notNull(),
  read_at:      timestamp('read_at', { withTimezone: true }),
  created_at:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id:         uuid('id').primaryKey().defaultRandom(),
  patient_id: uuid('patient_id').notNull().references(() => patients.id),
  type:       text('type').notNull(),
  title:      text('title').notNull(),
  body:       text('body').notNull(),
  link_view:  text('link_view'),
  is_read:    boolean('is_read').default(false),
  dismissed:  boolean('dismissed').default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Subscriptions ─────────────────────────────────────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  patient_id:             uuid('patient_id').notNull().references(() => patients.id),
  stripe_customer_id:     text('stripe_customer_id'),
  stripe_subscription_id: text('stripe_subscription_id'),
  plan_type:              text('plan_type').notNull(),
  status:                 text('status').notNull(),
  intake_id:              uuid('intake_id').references(() => intakes.id),
  current_period_end:     timestamp('current_period_end', { withTimezone: true }),
  created_at:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Clinics ───────────────────────────────────────────────────────────────────
export const clinics = pgTable('clinics', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       text('name').notNull(),
  address:    text('address').notNull(),
  city:       text('city').notNull(),
  state:      text('state').notNull(),
  zip:        text('zip').notNull(),
  lat:        real('lat').notNull(),
  lng:        real('lng').notNull(),
  phone:      text('phone'),
  timezone:   text('timezone').notNull().default('America/Denver'),
  active:     boolean('active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Clinic Providers ──────────────────────────────────────────────────────────
export const clinic_providers = pgTable('clinic_providers', {
  id:          uuid('id').primaryKey().defaultRandom(),
  clinic_id:   uuid('clinic_id').notNull().references(() => clinics.id),
  provider_id: uuid('provider_id').notNull().references(() => providers.id),
  active:      boolean('active').notNull().default(true),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.clinic_id, t.provider_id),
}))

// ── Clinic Appointment Requests ───────────────────────────────────────────────
export const clinic_appointment_requests = pgTable('clinic_appointment_requests', {
  id:              uuid('id').primaryKey().defaultRandom(),
  patient_id:      uuid('patient_id').notNull().references(() => patients.id),
  clinic_id:       uuid('clinic_id').notNull().references(() => clinics.id),
  preferred_dates: text('preferred_dates'),
  preferred_time:  text('preferred_time'),
  notes:           text('notes'),
  contact_phone:   text('contact_phone'),
  status:          text('status').notNull().default('pending'),
  created_at:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── PHI Access Log ────────────────────────────────────────────────────────────
export const phi_access_log = pgTable('phi_access_log', {
  id:          uuid('id').primaryKey().defaultRandom(),
  provider_id: uuid('provider_id'),
  patient_id:  uuid('patient_id').references(() => patients.id),
  record_type: text('record_type').notNull(),
  record_id:   uuid('record_id'),
  action:      text('action').notNull(),
  api_route:   text('api_route'),
  ip_address:  text('ip_address'),
  user_agent:  text('user_agent'),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Lab Orders ────────────────────────────────────────────────────────────────
export const lab_orders = pgTable('lab_orders', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  patient_id:           uuid('patient_id').notNull().references(() => patients.id),
  provider_id:          uuid('provider_id').references(() => providers.id),
  visit_id:             uuid('visit_id').references(() => visits.id),
  canvas_order_id:      text('canvas_order_id'),
  lab_partner:          text('lab_partner').notNull().default('quest'),
  tests:                json('tests'),
  clinical_indication:  text('clinical_indication'),
  status:               text('status').notNull().default('sent'),
  ordered_at:           text('ordered_at'),
  created_at:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Provider Notes ────────────────────────────────────────────────────────────
export const provider_notes = pgTable('provider_notes', {
  id:          uuid('id').primaryKey().defaultRandom(),
  patient_id:  uuid('patient_id').notNull().references(() => patients.id),
  provider_id: uuid('provider_id').notNull().references(() => providers.id),
  content:     text('content'),
  note_type:   text('note_type'),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Patient Wearable Connections ──────────────────────────────────────────────
export const patient_wearable_connections = pgTable('patient_wearable_connections', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  patient_id:              uuid('patient_id').notNull().references(() => patients.id),
  provider:                text('provider').notNull(),
  access_token_encrypted:  text('access_token_encrypted'),
  refresh_token_encrypted: text('refresh_token_encrypted'),
  token_expires_at:        timestamp('token_expires_at', { withTimezone: true }).notNull(),
  device_user_id:          text('device_user_id'),
  connected_at:            timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  last_synced_at:          timestamp('last_synced_at', { withTimezone: true }),
  is_active:               boolean('is_active').notNull().default(true),
  updated_at:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.patient_id, t.provider),
}))

// ── Wearable Metrics ──────────────────────────────────────────────────────────
export const wearable_metrics = pgTable('wearable_metrics', {
  id:            uuid('id').primaryKey().defaultRandom(),
  patient_id:    uuid('patient_id').notNull().references(() => patients.id),
  connection_id: uuid('connection_id').notNull().references(() => patient_wearable_connections.id),
  metric_type:   text('metric_type').notNull(),
  metric_date:   text('metric_date').notNull(),
  value:         real('value').notNull(),
  synced_at:     timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.patient_id, t.metric_date, t.metric_type),
}))

// ── Wearable Sync Log ─────────────────────────────────────────────────────────
export const wearable_sync_log = pgTable('wearable_sync_log', {
  id:              uuid('id').primaryKey().defaultRandom(),
  connection_id:   uuid('connection_id').notNull().references(() => patient_wearable_connections.id),
  records_fetched: integer('records_fetched').notNull().default(0),
  status:          text('status').notNull(),
  error_message:   text('error_message'),
  created_at:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Care Presentations ────────────────────────────────────────────────────────
export const care_presentations = pgTable('care_presentations', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  patient_id:          uuid('patient_id').notNull().references(() => patients.id),
  provider_id:         uuid('provider_id').notNull().references(() => providers.id),
  intake_id:           uuid('intake_id').references(() => intakes.id),
  selected_components: json('selected_components'),
  component_notes:     json('component_notes'),
  welcome_message:     text('welcome_message'),
  closing_message:     text('closing_message'),
  status:              text('status').notNull().default('draft'),
  viewed_at:           timestamp('viewed_at', { withTimezone: true }),
  created_at:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add Drizzle schema for all RDS tables"
```

---

## Task 3: Write Drizzle Relations

**Files:**
- Create: `src/lib/db/relations.ts`

Relations enable `db.query.*` with `with:` for nested queries. Relation names intentionally match Supabase table names (e.g. `appointment_types`, `patients`) so API response shapes are preserved.

- [ ] **Step 1: Create src/lib/db/relations.ts**

```ts
import { relations } from 'drizzle-orm'
import {
  profiles, patients, providers, appointments, appointment_types,
  provider_availability, availability_overrides, visits, encounter_notes,
  intakes, prescriptions, refill_requests, messages, notifications,
  subscriptions, clinics, clinic_providers, clinic_appointment_requests,
  phi_access_log, lab_orders, provider_notes,
  patient_wearable_connections, wearable_metrics, wearable_sync_log,
  care_presentations,
} from './schema'

export const profilesRelations = relations(profiles, ({ one }) => ({
  patients: one(patients, { fields: [profiles.id], references: [patients.profile_id] }),
  providers: one(providers, { fields: [profiles.id], references: [providers.profile_id] }),
}))

export const patientsRelations = relations(patients, ({ one, many }) => ({
  profiles: one(profiles, { fields: [patients.profile_id], references: [profiles.id] }),
  appointments: many(appointments),
  visits: many(visits),
  intakes: many(intakes),
  prescriptions: many(prescriptions),
  refill_requests: many(refill_requests),
  messages: many(messages),
  notifications: many(notifications),
  subscriptions: many(subscriptions),
  lab_orders: many(lab_orders),
  provider_notes: many(provider_notes),
  patient_wearable_connections: many(patient_wearable_connections),
  clinic_appointment_requests: many(clinic_appointment_requests),
  care_presentations: many(care_presentations),
}))

export const providersRelations = relations(providers, ({ one, many }) => ({
  profiles: one(profiles, { fields: [providers.profile_id], references: [profiles.id] }),
  appointments: many(appointments),
  appointment_types: many(appointment_types),
  provider_availability: many(provider_availability),
  availability_overrides: many(availability_overrides),
  clinic_providers: many(clinic_providers),
}))

export const appointmentTypesRelations = relations(appointment_types, ({ one, many }) => ({
  providers: one(providers, { fields: [appointment_types.provider_id], references: [providers.id] }),
  appointments: many(appointments),
}))

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  appointment_types: one(appointment_types, {
    fields: [appointments.appointment_type_id],
    references: [appointment_types.id],
  }),
  patients: one(patients, { fields: [appointments.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [appointments.provider_id], references: [providers.id] }),
}))

export const providerAvailabilityRelations = relations(provider_availability, ({ one }) => ({
  providers: one(providers, { fields: [provider_availability.provider_id], references: [providers.id] }),
}))

export const visitsRelations = relations(visits, ({ one }) => ({
  patients: one(patients, { fields: [visits.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [visits.provider_id], references: [providers.id] }),
  appointments: one(appointments, { fields: [visits.appointment_id], references: [appointments.id] }),
}))

export const encounterNotesRelations = relations(encounter_notes, ({ one }) => ({
  patients: one(patients, { fields: [encounter_notes.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [encounter_notes.provider_id], references: [providers.id] }),
}))

export const intakesRelations = relations(intakes, ({ one }) => ({
  patients: one(patients, { fields: [intakes.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [intakes.provider_id], references: [providers.id] }),
}))

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  patients: one(patients, { fields: [prescriptions.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [prescriptions.provider_id], references: [providers.id] }),
  refill_requests: many(refill_requests),
}))

export const refillRequestsRelations = relations(refill_requests, ({ one }) => ({
  prescriptions: one(prescriptions, { fields: [refill_requests.prescription_id], references: [prescriptions.id] }),
  patients: one(patients, { fields: [refill_requests.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [refill_requests.provider_id], references: [providers.id] }),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  patients: one(patients, { fields: [subscriptions.patient_id], references: [patients.id] }),
}))

export const clinicsRelations = relations(clinics, ({ many }) => ({
  clinic_providers: many(clinic_providers),
  clinic_appointment_requests: many(clinic_appointment_requests),
}))

export const clinicProvidersRelations = relations(clinic_providers, ({ one }) => ({
  clinics: one(clinics, { fields: [clinic_providers.clinic_id], references: [clinics.id] }),
  providers: one(providers, { fields: [clinic_providers.provider_id], references: [providers.id] }),
}))

export const clinicAppointmentRequestsRelations = relations(clinic_appointment_requests, ({ one }) => ({
  patients: one(patients, { fields: [clinic_appointment_requests.patient_id], references: [patients.id] }),
  clinics: one(clinics, { fields: [clinic_appointment_requests.clinic_id], references: [clinics.id] }),
}))

export const labOrdersRelations = relations(lab_orders, ({ one }) => ({
  patients: one(patients, { fields: [lab_orders.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [lab_orders.provider_id], references: [providers.id] }),
  visits: one(visits, { fields: [lab_orders.visit_id], references: [visits.id] }),
}))

export const providerNotesRelations = relations(provider_notes, ({ one }) => ({
  patients: one(patients, { fields: [provider_notes.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [provider_notes.provider_id], references: [providers.id] }),
}))

export const patientWearableConnectionsRelations = relations(patient_wearable_connections, ({ one, many }) => ({
  patients: one(patients, { fields: [patient_wearable_connections.patient_id], references: [patients.id] }),
  wearable_metrics: many(wearable_metrics),
  wearable_sync_log: many(wearable_sync_log),
}))

export const wearableMetricsRelations = relations(wearable_metrics, ({ one }) => ({
  patients: one(patients, { fields: [wearable_metrics.patient_id], references: [patients.id] }),
  patient_wearable_connections: one(patient_wearable_connections, {
    fields: [wearable_metrics.connection_id],
    references: [patient_wearable_connections.id],
  }),
}))

export const wearableSyncLogRelations = relations(wearable_sync_log, ({ one }) => ({
  patient_wearable_connections: one(patient_wearable_connections, {
    fields: [wearable_sync_log.connection_id],
    references: [patient_wearable_connections.id],
  }),
}))

export const carePresentationsRelations = relations(care_presentations, ({ one }) => ({
  patients: one(patients, { fields: [care_presentations.patient_id], references: [patients.id] }),
  providers: one(providers, { fields: [care_presentations.provider_id], references: [providers.id] }),
  intakes: one(intakes, { fields: [care_presentations.intake_id], references: [intakes.id] }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/relations.ts
git commit -m "feat: add Drizzle relations for nested queries"
```

---

## Task 4: Create Drizzle Client

**Files:**
- Create: `src/lib/db/index.ts`

- [ ] **Step 1: Create src/lib/db/index.ts**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import * as relations from './relations'

const client = postgres(process.env.DATABASE_URL!, {
  max: 3,
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
})

export const db = drizzle(client, { schema: { ...schema, ...relations } })
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/index.ts
git commit -m "feat: add Drizzle client"
```

---

## Task 5: Create RDS Instances (Manual AWS Steps)

This task is performed in the AWS Console. No code changes.

- [ ] **Step 1: Create staging RDS instance**

1. Go to AWS Console → RDS → Create database
2. Engine: PostgreSQL 16
3. Template: Free tier (or Dev/Test)
4. DB instance identifier: `womenkind-staging`
5. Master username: `postgres`
6. Master password: Auto-generate → copy it
7. Instance class: `db.t3.micro`
8. Storage: 20 GB gp2
9. VPC: Default VPC
10. Public access: Yes
11. VPC security group: Create new → allow inbound port 5432 from anywhere (0.0.0.0/0) — tighten to Vercel IP ranges later
12. Database name: `womenkind`
13. Click Create

Wait ~5 minutes for it to be available.

- [ ] **Step 2: Note the endpoint**

Copy the endpoint hostname. It looks like: `womenkind-staging.xxxxxxxx.us-west-2.rds.amazonaws.com`

- [ ] **Step 3: Store credentials in AWS Secrets Manager**

1. Go to AWS Secrets Manager → Store a new secret
2. Type: Other
3. Key/value pairs: `password` → the auto-generated password
4. Name: `womenkind/staging/db-credentials`
5. Create

- [ ] **Step 4: Repeat for production**

Repeat steps 1-3, naming the instance `womenkind-production` and the secret `womenkind/production/db-credentials`.

---

## Task 6: Add Environment Variables

- [ ] **Step 1: Add DATABASE_URL to .env.local**

Add this line to `.env.local`:
```
DATABASE_URL=postgresql://postgres:YOUR_STAGING_PASSWORD@womenkind-staging.xxxxxxxx.us-west-2.rds.amazonaws.com:5432/womenkind?sslmode=require
```

Replace `YOUR_STAGING_PASSWORD` and the hostname with the actual values from Task 5.

- [ ] **Step 2: Add DATABASE_URL to Vercel (staging branch)**

1. Go to Vercel → womenkind project → Settings → Environment Variables
2. Add: `DATABASE_URL` → staging connection string
3. Environment: Preview, branch = staging

- [ ] **Step 3: Add DATABASE_URL to Vercel (production)**

1. Add: `DATABASE_URL` → production connection string
2. Environment: Production

---

## Task 7: Push Schema to Both RDS Instances

- [ ] **Step 1: Push schema to staging**

Ensure `.env.local` has the staging `DATABASE_URL`, then:

```bash
npx drizzle-kit push
```

Expected output: lists all tables created successfully on staging RDS.

- [ ] **Step 2: Create the Haversine function on staging**

Connect to staging RDS via psql or a DB GUI (e.g., TablePlus):

```
psql postgresql://postgres:PASSWORD@womenkind-staging.xxx.us-west-2.rds.amazonaws.com:5432/womenkind
```

Then run:

```sql
CREATE OR REPLACE FUNCTION get_nearby_clinics(
  patient_lat   float,
  patient_lng   float,
  radius_miles  float DEFAULT 60
)
RETURNS TABLE (
  id             uuid,
  name           text,
  address        text,
  city           text,
  state          text,
  zip            text,
  phone          text,
  timezone       text,
  distance_miles float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.name, c.address, c.city, c.state, c.zip, c.phone, c.timezone,
    (
      3958.8 * acos(
        LEAST(1.0,
          cos(radians(patient_lat)) * cos(radians(c.lat)) *
          cos(radians(c.lng) - radians(patient_lng)) +
          sin(radians(patient_lat)) * sin(radians(c.lat))
        )
      )
    )::float AS distance_miles
  FROM clinics c
  WHERE c.active = true
  AND (
    3958.8 * acos(
      LEAST(1.0,
        cos(radians(patient_lat)) * cos(radians(c.lat)) *
        cos(radians(c.lng) - radians(patient_lng)) +
        sin(radians(patient_lat)) * sin(radians(c.lat))
      )
    )
  ) <= radius_miles
  ORDER BY distance_miles ASC;
END;
$$;
```

- [ ] **Step 3: Push schema to production**

Temporarily update `.env.local` `DATABASE_URL` to the production connection string, run `npx drizzle-kit push`, then restore to staging. Or run:

```bash
DATABASE_URL="postgresql://postgres:PROD_PASS@womenkind-production.xxx.us-west-2.rds.amazonaws.com:5432/womenkind?sslmode=require" npx drizzle-kit push
```

- [ ] **Step 4: Create Haversine function on production**

Repeat Step 2 with the production psql connection string.

- [ ] **Step 5: Seed the Womenkind SLC clinic on both instances**

Run on both staging and production:

```sql
INSERT INTO clinics (name, address, city, state, zip, lat, lng, phone, timezone)
VALUES (
  'Womenkind Salt Lake City',
  '123 South Main Street',
  'Salt Lake City', 'UT', '84101',
  40.7608, -111.8910, NULL, 'America/Denver'
)
ON CONFLICT DO NOTHING;
```

---

## Task 8: Update getServerSession.ts

Replace the Supabase DB lookup (patients/providers) with Drizzle.

**Files:**
- Modify: `src/lib/getServerSession.ts`

- [ ] **Step 1: Rewrite the file**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { patients, providers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export interface ServerSession {
  userId: string
  patientId: string | null
  providerId: string | null
  role: 'patient' | 'provider' | 'unknown'
}

export async function getServerSession(): Promise<ServerSession | null> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const patient = await db.query.patients.findFirst({
    where: eq(patients.profile_id, user.id),
    columns: { id: true },
  })

  if (patient) {
    return { userId: user.id, patientId: patient.id, providerId: null, role: 'patient' }
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.profile_id, user.id),
    columns: { id: true },
  })

  if (provider) {
    return { userId: user.id, patientId: null, providerId: provider.id, role: 'provider' }
  }

  return { userId: user.id, patientId: null, providerId: null, role: 'unknown' }
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: existing tests that mock `@/lib/supabase-server` still pass (getServerSession is not directly tested by those tests).

- [ ] **Step 3: Commit**

```bash
git add src/lib/getServerSession.ts
git commit -m "feat: update getServerSession to query RDS via Drizzle"
```

---

## Task 9: Update phi-audit.ts

**Files:**
- Modify: `src/lib/phi-audit.ts`

- [ ] **Step 1: Rewrite the file**

```ts
import { db } from '@/lib/db'
import { phi_access_log } from '@/lib/db/schema'
import { NextRequest } from 'next/server'

export type PhiRecordType =
  | 'encounter_note' | 'patient_profile' | 'appointment'
  | 'message' | 'prescription' | 'lab_result' | 'intake'

export type PhiAction =
  | 'create' | 'read' | 'update' | 'delete' | 'sign' | 'export' | 'transcribe'

export interface PhiAuditParams {
  providerId?: string | null
  patientId?: string | null
  recordType: PhiRecordType
  recordId?: string | null
  action: PhiAction
  route: string
  req?: NextRequest
}

export function logPhiAccess(params: PhiAuditParams): void {
  const { providerId, patientId, recordType, recordId, action, route, req } = params

  ;(async () => {
    try {
      const ipAddress = req
        ? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null
        : null
      const userAgent = req ? req.headers.get('user-agent') : null

      await db.insert(phi_access_log).values({
        provider_id: providerId ?? null,
        patient_id:  patientId  ?? null,
        record_type: recordType,
        record_id:   recordId   ?? null,
        action,
        api_route:   route,
        ip_address:  ipAddress,
        user_agent:  userAgent,
      })
    } catch (err) {
      console.error('[phi-audit] Failed to write audit log:', err)
    }
  })()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/phi-audit.ts
git commit -m "feat: update phi-audit to write to RDS via Drizzle"
```

---

## Task 10: Migrate Auth/Profile Routes

**Files:**
- Modify: `src/app/api/auth/create-patient/route.ts`
- Modify: `src/app/api/auth/welcome/route.ts`

- [ ] **Step 1: Rewrite create-patient/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { userId } = await req.json()

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    if (userId !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const existing = await db.query.patients.findFirst({
      where: eq(patients.profile_id, userId),
      columns: { id: true },
    })

    if (existing) return NextResponse.json({ patientId: existing.id })

    const [patient] = await db.insert(patients).values({ profile_id: userId }).returning({ id: patients.id })

    return NextResponse.json({ patientId: patient.id })
  } catch (err: any) {
    console.error('Create patient error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Read welcome/route.ts and update any DB calls**

```bash
cat src/app/api/auth/welcome/route.ts
```

Update any `createClient()` / `getServiceSupabase()` DB calls to use `db` from `@/lib/db`. If the route only handles email sending with no DB, it may need no changes.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/create-patient/route.ts src/app/api/auth/welcome/route.ts
git commit -m "feat: migrate auth routes to Drizzle"
```

---

## Task 11: Migrate Scheduling Routes

**Files:**
- Modify: `src/app/api/scheduling/appointments/route.ts`
- Modify: `src/app/api/scheduling/appointment-types/route.ts`
- Modify: `src/app/api/scheduling/availability/route.ts`
- Modify: `src/app/api/scheduling/book/route.ts`
- Modify: `src/app/api/scheduling/cancel/route.ts`
- Modify: `src/app/api/scheduling/calendar-export/route.ts`

- [ ] **Step 1: Rewrite appointments/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { eq, neq, gte, lte, and, SQL } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

export async function GET(req: NextRequest) {
  try {
    const providerId = req.nextUrl.searchParams.get('providerId')
    const patientId  = req.nextUrl.searchParams.get('patientId')
    const startDate  = req.nextUrl.searchParams.get('startDate')
    const endDate    = req.nextUrl.searchParams.get('endDate')
    const status     = req.nextUrl.searchParams.get('status')

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (patientId && session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (providerId && session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conditions: SQL[] = []
    if (providerId) conditions.push(eq(appointments.provider_id, providerId))
    if (patientId)  conditions.push(eq(appointments.patient_id, patientId))
    if (startDate)  conditions.push(gte(appointments.starts_at, new Date(`${startDate}T00:00:00`)))
    if (endDate)    conditions.push(lte(appointments.starts_at, new Date(`${endDate}T23:59:59`)))
    if (status)     conditions.push(eq(appointments.status, status))
    else            conditions.push(neq(appointments.status, 'canceled'))

    const data = await db.query.appointments.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      with: {
        appointment_types: { columns: { name: true, duration_minutes: true, price_cents: true, color: true } },
        patients: {
          columns: { id: true },
          with: {
            profiles: { columns: { first_name: true, last_name: true, email: true } },
            subscriptions: { columns: { status: true, plan_type: true } },
          },
        },
      },
      orderBy: (a, { asc }) => [asc(a.starts_at)],
    })

    return NextResponse.json({ appointments: data })
  } catch (err: any) {
    console.error('Failed to fetch appointments:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })

    const { appointmentId, status, providerNotes } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })

    const updates: Record<string, any> = { updated_at: new Date() }
    if (status) {
      updates.status = status
      if (status === 'completed') updates.completed_at = new Date()
      if (status === 'canceled')  updates.canceled_at  = new Date()
    }
    if (providerNotes !== undefined) updates.provider_notes = providerNotes

    const [appointment] = await db
      .update(appointments)
      .set(updates)
      .where(eq(appointments.id, appointmentId))
      .returning()

    return NextResponse.json({ appointment })
  } catch (err: any) {
    console.error('Failed to update appointment:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Rewrite appointment-types/route.ts**

Read the current file first:
```bash
cat src/app/api/scheduling/appointment-types/route.ts
```

Replace `getServiceSupabase()` with `db` from `@/lib/db`. Pattern: reads become `db.query.appointment_types.findMany(...)`, inserts become `db.insert(appointment_types).values(...).returning()`.

- [ ] **Step 3: Rewrite availability/route.ts**

Read the current file:
```bash
cat src/app/api/scheduling/availability/route.ts
```

Replace Supabase queries with Drizzle. The route fetches `provider_availability` and `availability_overrides` and `appointments` to compute slots — same data, just different client.

- [ ] **Step 4: Rewrite book/route.ts**

The booking route uses `getServiceSupabase()` for all DB calls. Replace each one with Drizzle.

Key replacements:
```ts
// Before
const { data: appointmentType } = await supabase.from('appointment_types').select('*').eq('id', appointmentTypeId).single()

// After
import { db } from '@/lib/db'
import { appointment_types, appointments, provider_availability, subscriptions, patients } from '@/lib/db/schema'
import { eq, neq, and, gte, lte } from 'drizzle-orm'

const appointmentType = await db.query.appointment_types.findFirst({
  where: eq(appointment_types.id, appointmentTypeId),
})
```

```ts
// Before (insert returning)
const { data: appointment } = await supabase.from('appointments').insert({...}).select().single()

// After
const [appointment] = await db.insert(appointments).values({...}).returning()
```

```ts
// Before (update in background)
await supabase.from('appointments').update({ video_room_url: videoRoom.url, ... }).eq('id', appointment.id)

// After
await db.update(appointments).set({ video_room_url: videoRoom.url, ... }).where(eq(appointments.id, appointment.id))
```

- [ ] **Step 5: Rewrite cancel/route.ts and calendar-export/route.ts**

Read each file and apply the same Supabase → Drizzle pattern.

- [ ] **Step 6: Run tests**

```bash
npm test -- --testPathPattern="scheduling"
```

The tests mock `@/lib/supabase-server`. Update the mocks to mock `@/lib/db` instead:

In `src/app/api/scheduling/__tests__/book.test.ts`, replace:
```ts
jest.mock('@/lib/supabase-server', () => ({
  getServiceSupabase: jest.fn(() => ({ from: mockSupabaseFrom })),
}))
```
with:
```ts
const mockDbQuery = { appointment_types: { findFirst: jest.fn() }, ... }
const mockDbInsert = jest.fn(() => ({ values: jest.fn(() => ({ returning: jest.fn() })) }))
const mockDbUpdate = jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn() })) }))

jest.mock('@/lib/db', () => ({
  db: {
    query: mockDbQuery,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}))
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/scheduling/
git commit -m "feat: migrate scheduling routes to Drizzle"
```

---

## Task 12: Migrate Clinical/Visit Routes

**Files:**
- Modify: `src/app/api/checkin/route.ts`
- Modify: `src/app/api/visits/ambient-recording/route.ts`
- Modify: `src/app/api/visits/webhook/transcription/route.ts`
- Modify: `src/app/api/visits/webhook/recording/route.ts`
- Modify: `src/app/api/visit-prep/route.ts`

- [ ] **Step 1: Rewrite checkin/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments, visits } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { logPhiAccess } from '@/lib/phi-audit'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointmentId, scores } = await req.json()
    if (!appointmentId || !scores) {
      return NextResponse.json({ error: 'appointmentId and scores are required' }, { status: 400 })
    }

    const REQUIRED_DOMAINS = ['vasomotor', 'sleep', 'energy', 'mood', 'gsm', 'overall']
    for (const domain of REQUIRED_DOMAINS) {
      const val = scores[domain]
      if (typeof val !== 'number' || val < 1 || val > 5) {
        return NextResponse.json({ error: `Score for "${domain}" must be a number between 1 and 5` }, { status: 400 })
      }
    }

    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
      columns: { id: true, patient_id: true, provider_id: true, starts_at: true, status: true },
    })

    if (!appointment) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    if (session.role === 'patient' && session.patientId !== appointment.patient_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (appointment.status === 'canceled') {
      return NextResponse.json({ error: 'Cannot check in for a canceled appointment' }, { status: 400 })
    }

    const now = new Date()
    const visitDate = appointment.starts_at.toISOString().split('T')[0]

    const existing = await db.query.visits.findFirst({
      where: eq(visits.appointment_id, appointmentId),
      columns: { id: true },
    })

    let visit
    if (existing) {
      ;[visit] = await db.update(visits)
        .set({ symptom_scores: scores, checked_in_at: now })
        .where(eq(visits.id, existing.id))
        .returning()
    } else {
      ;[visit] = await db.insert(visits).values({
        patient_id:     appointment.patient_id,
        provider_id:    appointment.provider_id,
        appointment_id: appointmentId,
        visit_type:     'follow_up',
        visit_date:     visitDate,
        symptom_scores: scores,
        checked_in_at:  now,
      }).returning()
    }

    logPhiAccess({ providerId: appointment.provider_id, patientId: appointment.patient_id, recordType: 'appointment', recordId: appointmentId, action: 'create', route: '/api/checkin', req })
    return NextResponse.json({ visit }, { status: 200 })
  } catch (err: any) {
    console.error('Check-in error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appointmentId = req.nextUrl.searchParams.get('appointmentId')
    if (!appointmentId) return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })

    const visit = await db.query.visits.findFirst({
      where: eq(visits.appointment_id, appointmentId),
      columns: { id: true, checked_in_at: true, symptom_scores: true },
    })

    return NextResponse.json({ checkedIn: !!visit?.checked_in_at, visit })
  } catch (err: any) {
    console.error('Check-in GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Rewrite ambient-recording/route.ts**

Replace the inline `createClient()` with `db` from `@/lib/db`:

```ts
import { db } from '@/lib/db'
import { encounter_notes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
```

Replace:
```ts
const { data: note, error: noteErr } = await supabase.from('encounter_notes').insert({...}).select('id').single()
```
with:
```ts
const [note] = await db.insert(encounter_notes).values({
  patient_id: patientId,
  provider_id: providerId,
  source: 'in_office',
  recording_storage_path: recordingStoragePath,
  status: 'transcribing',
}).returning({ id: encounter_notes.id })
```

Replace all subsequent `supabase.from('encounter_notes').update({...}).eq('id', note.id)` with:
```ts
await db.update(encounter_notes).set({...}).where(eq(encounter_notes.id, note.id))
```

Remove the `getSupabase` function and Supabase imports at the top.

- [ ] **Step 3: Rewrite visits/webhook/transcription/route.ts**

Replace the inline `getSupabase()` / `createClient()` with `db` from `@/lib/db`. The `notifyProvider` function also needs the patient lookup updated:

```ts
// Before (in notifyProvider)
const { data: patient } = await supabase.from('patients').select('profiles(first_name, last_name)').eq('id', patientId).single()

// After
const patient = await db.query.patients.findFirst({
  where: eq(patients.id, patientId),
  with: { profiles: { columns: { first_name: true, last_name: true } } },
})
```

The `notifyProvider` function signature changes from `supabase: ReturnType<typeof getSupabase>` to no DB parameter (it imports `db` directly):

```ts
async function notifyProvider(providerId: string, patientId: string, noteId: string) {
  // ... uses db directly instead of supabase parameter
}
```

- [ ] **Step 4: Rewrite visit-prep/route.ts**

Read and update all Supabase calls to Drizzle. The route does multiple lookups: appointment, visits, intakes, prescriptions, lab_orders, provider_notes.

- [ ] **Step 5: Rewrite visits/webhook/recording/route.ts**

Read and update all Supabase calls.

- [ ] **Step 6: Run tests**

```bash
npm test -- --testPathPattern="transcription"
```

Update test mocks from Supabase to Drizzle (same pattern as Task 11 Step 6).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/checkin/ src/app/api/visits/
git commit -m "feat: migrate clinical/visit routes to Drizzle"
```

---

## Task 13: Migrate Intake Routes

**Files:**
- Modify: `src/app/api/intake/submit/route.ts`
- Modify: `src/app/api/intake/save/route.ts`
- Modify: `src/app/api/generate-briefs/route.ts`

- [ ] **Step 1: Rewrite intake/submit/route.ts**

Replace the inline `getSupabase()` function and all Supabase calls with Drizzle.

Key replacements:

```ts
// Before
const { data: providerRow } = await supabase.from('providers').select('id').eq('is_active', true).limit(1).maybeSingle()

// After
import { db } from '@/lib/db'
import { intakes, providers, patients } from '@/lib/db/schema'
import { eq, isNull } from 'drizzle-orm'

const providerRow = await db.query.providers.findFirst({
  where: eq(providers.is_active, true),
  columns: { id: true },
})
```

```ts
// Before
await supabase.from('intakes').update({ status: 'submitted', answers, submitted_at: ..., ... }).eq('id', intakeId)

// After
await db.update(intakes).set({ status: 'submitted', answers, submitted_at: new Date(), ... }).where(eq(intakes.id, intakeId))
```

The `sendIntakeEmails` function takes supabase as a parameter — change it to use `db` directly:

```ts
// Before
async function sendIntakeEmails(supabase: ReturnType<typeof getSupabase>, { patientId, intakeId }) {...}

// After
async function sendIntakeEmails({ patientId, intakeId }: { patientId: string; intakeId: string }) {
  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    with: { profiles: { columns: { first_name: true, last_name: true, email: true } } },
  })
  // rest of function unchanged
}
```

- [ ] **Step 2: Rewrite intake/save/route.ts**

Read and update all Supabase calls to Drizzle.

- [ ] **Step 3: Rewrite generate-briefs/route.ts**

Replace Supabase calls:

```ts
// Before
const { data: intakes } = await supabase.from('intakes').select('id, patient_id, answers, status').in('status', ['submitted','reviewed']).is('ai_brief', null)

// After
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { inArray, isNull } from 'drizzle-orm'

const intakeRows = await db.select({
  id: intakes.id,
  patient_id: intakes.patient_id,
  answers: intakes.answers,
  status: intakes.status,
}).from(intakes)
  .where(and(inArray(intakes.status, ['submitted', 'reviewed']), isNull(intakes.ai_brief)))
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="intake|generate-briefs"
```

Update test mocks from Supabase to Drizzle.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/intake/ src/app/api/generate-briefs/
git commit -m "feat: migrate intake routes to Drizzle"
```

---

## Task 14: Migrate Messaging and Notifications

**Files:**
- Modify: `src/app/api/messages/route.ts`
- Modify: `src/app/api/notifications/route.ts`

- [ ] **Step 1: Rewrite messages/route.ts**

The messages route has complex query-and-group logic. Replace Supabase calls with Drizzle, preserving all business logic.

```ts
import { db } from '@/lib/db'
import { messages, patients, providers, notifications } from '@/lib/db/schema'
import { eq, or, and, isNull, inArray } from 'drizzle-orm'
```

Key patterns:

```ts
// GET thread messages
const data = await db.select().from(messages)
  .where(eq(messages.thread_id, threadId))
  .orderBy(asc(messages.created_at))
```

```ts
// GET patient name lookup for senders
const patientRows = await db.query.patients.findMany({
  where: inArray(patients.id, patientSenderIds),
  columns: { id: true },
  with: { profiles: { columns: { first_name: true, last_name: true } } },
})
```

```ts
// GET thread summaries
const data = await db.select().from(messages)
  .where(
    patientId ? or(eq(messages.sender_id, patientId), eq(messages.recipient_id, patientId))
    : providerId ? or(eq(messages.sender_id, providerId), eq(messages.recipient_id, providerId))
    : undefined
  )
  .orderBy(desc(messages.created_at))
```

```ts
// POST insert message
const [message] = await db.insert(messages).values({
  thread_id: actualThreadId,
  sender_type: senderType,
  sender_id: senderId,
  recipient_id: recipientId,
  subject: subject || null,
  body,
}).returning()
```

```ts
// POST insert notification
await db.insert(notifications).values({
  patient_id: recipientId,
  type: 'new_message',
  title: `New message from ${senderName}`,
  body: body.length > 80 ? body.slice(0, 80) + '…' : body,
  link_view: 'message',
  is_read: false,
  dismissed: false,
})
```

```ts
// POST provider name lookup
const providerRow = await db.query.providers.findFirst({
  where: eq(providers.id, senderId),
  with: { profiles: { columns: { first_name: true, last_name: true } } },
})
```

```ts
// PATCH mark read
await db.update(messages)
  .set({ read_at: new Date() })
  .where(and(
    eq(messages.thread_id, threadId),
    eq(messages.recipient_id, readerId),
    isNull(messages.read_at),
  ))
```

- [ ] **Step 2: Rewrite notifications/route.ts**

Read the file:
```bash
cat src/app/api/notifications/route.ts
```

Replace Supabase calls with Drizzle. Pattern: `getServiceSupabase().from('notifications')` → `db.query.notifications.findMany(...)` or `db.update(notifications).set(...)`.

- [ ] **Step 3: Run tests**

```bash
npm test -- --testPathPattern="messages"
```

Update test mocks.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/messages/ src/app/api/notifications/
git commit -m "feat: migrate messaging and notifications routes to Drizzle"
```

---

## Task 15: Migrate Prescription Routes

**Files:**
- Modify: `src/app/api/prescriptions/route.ts`
- Modify: `src/app/api/refill-requests/route.ts`

- [ ] **Step 1: Rewrite prescriptions/route.ts**

```ts
import { db } from '@/lib/db'
import { prescriptions } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { logPhiAccess } from '@/lib/phi-audit'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get('patientId')
    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 })

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await db.select().from(prescriptions)
      .where(and(eq(prescriptions.patient_id, patientId), eq(prescriptions.status, 'active')))
      .orderBy(asc(prescriptions.runs_out_at))

    const now = new Date()
    const rxList = (data || []).map((rx) => {
      const runsOutAt = rx.runs_out_at ? new Date(rx.runs_out_at) : null
      const daysRemaining = runsOutAt
        ? Math.max(0, Math.ceil((runsOutAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0
      const refillsRemaining = (rx.refills || 0) - (rx.refills_used || 0)
      return {
        id: rx.id,
        medicationName: rx.medication_name,
        dosage: rx.dosage,
        frequency: rx.frequency,
        quantityDispensed: rx.quantity_dispensed,
        refillsAuthorized: rx.refills || 0,
        refillsUsed: rx.refills_used || 0,
        refillsRemaining,
        prescribedAt: rx.prescribed_at,
        lastFilledAt: rx.last_filled_at,
        runsOutAt: rx.runs_out_at,
        daysRemaining,
        needsRefillSoon: daysRemaining <= 10,
        status: rx.status,
      }
    })

    logPhiAccess({ patientId, recordType: 'prescription', action: 'read', route: '/api/prescriptions', req })
    return NextResponse.json({ prescriptions: rxList })
  } catch (err: any) {
    console.error('Failed to fetch prescriptions:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Rewrite refill-requests/route.ts**

```ts
import { db } from '@/lib/db'
import { refill_requests, prescriptions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { NextRequest, NextResponse } from 'next/server'
```

GET: replace `.from('refill_requests').select('*, prescriptions(...), patients(...)') ` with:
```ts
const data = await db.query.refill_requests.findMany({
  where: and(
    patientId  ? eq(refill_requests.patient_id, patientId)   : undefined,
    providerId ? eq(refill_requests.provider_id, providerId) : undefined,
    status     ? eq(refill_requests.status, status)          : undefined,
  ),
  with: {
    prescriptions: { columns: { medication_name: true, dosage: true, frequency: true } },
    patients: {
      columns: { id: true },
      with: { profiles: { columns: { first_name: true, last_name: true, email: true } } },
    },
  },
  orderBy: (r, { desc }) => [desc(r.created_at)],
})
```

POST insert:
```ts
const [data] = await db.insert(refill_requests).values({
  prescription_id: prescriptionId,
  patient_id: patientId,
  provider_id: providerId,
  patient_note: patientNote || null,
  status: 'pending',
}).returning()
```

PATCH update + prescription update:
```ts
const [request] = await db.update(refill_requests)
  .set({ status, provider_note: providerNote || null, reviewed_at: new Date(), updated_at: new Date() })
  .where(eq(refill_requests.id, requestId))
  .returning()

// then join to get prescription via query:
const fullRequest = await db.query.refill_requests.findFirst({
  where: eq(refill_requests.id, requestId),
  with: { prescriptions: true },
})

if (status === 'approved' && fullRequest?.prescriptions) {
  const rx = fullRequest.prescriptions
  const newRefillsUsed = (rx.refills_used || 0) + 1
  const now = new Date()
  const daysSupply = Math.ceil((rx.quantity_dispensed || 30) / (rx.doses_per_day || 1))
  const newRunsOutAt = new Date(now.getTime() + daysSupply * 24 * 60 * 60 * 1000)

  await db.update(prescriptions).set({
    refills_used: newRefillsUsed,
    last_filled_at: now,
    runs_out_at: newRunsOutAt,
    updated_at: now,
  }).where(eq(prescriptions.id, rx.id))
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/prescriptions/ src/app/api/refill-requests/
git commit -m "feat: migrate prescription routes to Drizzle"
```

---

## Task 16: Migrate Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Update getPatientContext in chat/route.ts**

The chat route uses `getServiceSupabase()` for multiple patient context lookups. Replace all of them:

```ts
import { db } from '@/lib/db'
import { patients, intakes, visits, prescriptions, lab_orders, provider_notes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
```

Replace `getServiceSupabase()` calls throughout with Drizzle equivalents. Remove the `getServiceSupabase` import at the top.

The `getPatientContext` function:
```ts
async function getPatientContext(patientId: string) {
  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    with: { profiles: true },
  })

  const intake = await db.query.intakes.findFirst({
    where: eq(intakes.patient_id, patientId),
    orderBy: (i, { desc }) => [desc(i.started_at)],
  })

  const visitRows = await db.query.visits.findMany({
    where: eq(visits.patient_id, patientId),
    orderBy: (v, { desc }) => [desc(v.visit_date)],
    limit: 5,
  })

  const prescriptionRows = await db.query.prescriptions.findMany({
    where: eq(prescriptions.patient_id, patientId),
    orderBy: (p, { desc }) => [desc(p.created_at)],
  })

  const labOrderRows = await db.query.lab_orders.findMany({
    where: eq(lab_orders.patient_id, patientId),
    orderBy: (l, { desc }) => [desc(l.created_at)],
  })

  const providerNoteRows = await db.query.provider_notes.findMany({
    where: eq(provider_notes.patient_id, patientId),
    orderBy: (n, { desc }) => [desc(n.created_at)],
  })

  return { patient, intake, visits: visitRows, prescriptions: prescriptionRows, labOrders: labOrderRows, providerNotes: providerNoteRows }
}
```

- [ ] **Step 2: Update executeAction in chat/route.ts**

The `add_risk_flag` action writes to `intakes.ai_brief`. Replace:
```ts
await supabase.from('intakes').update({ ai_brief: updatedBrief }).eq('id', intakeId)
```
with:
```ts
await db.update(intakes).set({ ai_brief: updatedBrief }).where(eq(intakes.id, intakeId))
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: migrate chat route to Drizzle"
```

---

## Task 17: Migrate Clinic Routes

**Files:**
- Modify: `src/app/api/clinics/nearby/route.ts`
- Modify: `src/app/api/clinics/geocode/route.ts`
- Modify: `src/app/api/clinics/request/route.ts`

- [ ] **Step 1: Rewrite clinics/nearby/route.ts**

Read the current file:
```bash
cat src/app/api/clinics/nearby/route.ts
```

The nearby route calls the `get_nearby_clinics` RPC. With Drizzle, execute raw SQL for the stored procedure:

```ts
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = req.nextUrl.searchParams.get('patientId')
    const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '')
    const lng = parseFloat(req.nextUrl.searchParams.get('lng') || '')
    const radius = parseFloat(req.nextUrl.searchParams.get('radius') || '60')

    if (!patientId || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'patientId, lat, and lng are required' }, { status: 400 })
    }

    const clinics = await db.execute(
      sql`SELECT * FROM get_nearby_clinics(${lat}, ${lng}, ${radius})`
    )

    return NextResponse.json({ clinics: clinics.rows ?? clinics })
  } catch (err: any) {
    console.error('Clinics nearby error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Rewrite clinics/request/route.ts**

Read and update all Supabase calls to Drizzle using `db.insert(clinic_appointment_requests).values(...).returning()`.

- [ ] **Step 3: Rewrite clinics/geocode/route.ts**

Read and update any Supabase DB calls (may be none if it only calls a geocoding API).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clinics/
git commit -m "feat: migrate clinic routes to Drizzle"
```

---

## Task 18: Migrate Stripe Routes

**Files:**
- Modify: `src/app/api/stripe/checkout/route.ts`
- Modify: `src/app/api/stripe/cancel/route.ts`
- Modify: `src/app/api/stripe/membership/route.ts`
- Modify: `src/app/api/stripe/portal/route.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Rewrite webhooks/stripe/route.ts**

This is the most complex Stripe file. Replace `getServiceSupabase()` and all DB calls:

```ts
import { db } from '@/lib/db'
import { subscriptions, intakes, appointments, patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
```

In `handleIntakePayment`:
```ts
// Before
await supabase.from('intakes').update({status: 'submitted', paid: true, ...}).eq('id', intakeId)
await supabase.from('subscriptions').insert({...})

// After
await db.update(intakes).set({ status: 'submitted', paid: true, paid_at: new Date(), stripe_session_id: data.stripeSessionId }).where(eq(intakes.id, data.intakeId))
await db.insert(subscriptions).values({ patient_id: data.patientId, stripe_customer_id: data.stripeCustomerId, plan_type: 'intake', status: 'active', intake_id: data.intakeId || null })
```

In `handleAppointmentPayment`:
```ts
const appointment = await db.query.appointments.findFirst({
  where: eq(appointments.id, data.appointmentId),
  with: {
    appointment_types: { columns: { name: true, duration_minutes: true } },
    patients: { with: { profiles: { columns: { first_name: true, last_name: true, email: true } } } },
  },
})

await db.update(appointments).set({ status: 'confirmed', is_paid: true, stripe_session_id: data.stripeSessionId, updated_at: new Date() }).where(eq(appointments.id, data.appointmentId))
```

In `handleMembershipStart`:
```ts
if (!patientId && data.intakeId) {
  const intake = await db.query.intakes.findFirst({ where: eq(intakes.id, data.intakeId), columns: { patient_id: true } })
  patientId = intake?.patient_id || null
}
if (patientId) {
  await db.insert(subscriptions).values({ patient_id: patientId, stripe_customer_id: data.stripeCustomerId, stripe_subscription_id: data.stripeSubscriptionId, plan_type: 'membership', status: 'active' })
}
```

In event handlers `invoice.payment_succeeded` and `customer.subscription.*`:
```ts
await db.update(subscriptions).set({ status: 'active', current_period_end: ... }).where(eq(subscriptions.stripe_subscription_id, subscriptionId))
```

- [ ] **Step 2: Read and update stripe/checkout/route.ts**

```bash
cat src/app/api/stripe/checkout/route.ts
```

Replace Supabase DB calls with Drizzle.

- [ ] **Step 3: Read and update stripe/cancel/route.ts, membership/route.ts, portal/route.ts**

```bash
cat src/app/api/stripe/cancel/route.ts
cat src/app/api/stripe/membership/route.ts
cat src/app/api/stripe/portal/route.ts
```

Replace all Supabase DB calls with Drizzle in each.

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="stripe|webhook"
```

Update mocks.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stripe/ src/app/api/webhooks/
git commit -m "feat: migrate Stripe routes to Drizzle"
```

---

## Task 19: Migrate Wearable Routes (update oura.ts)

**Files:**
- Modify: `src/lib/oura.ts`
- Modify: `src/app/api/wearables/sync/route.ts`
- Modify: `src/app/api/wearables/status/route.ts`
- Modify: `src/app/api/wearables/metrics/route.ts`
- Modify: `src/app/api/auth/oura/initiate/route.ts`
- Modify: `src/app/api/auth/oura/callback/route.ts`
- Modify: `src/app/api/auth/oura/disconnect/route.ts`

- [ ] **Step 1: Rewrite src/lib/oura.ts**

Remove the `getSupabase()` function and all `createClient` / supabase-js imports. Add Drizzle imports:

```ts
import { db } from '@/lib/db'
import { patient_wearable_connections, wearable_metrics, wearable_sync_log } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt } from './encryption'
```

Replace all DB operations:

```ts
// getValidOuraToken — connection lookup
const conn = await db.query.patient_wearable_connections.findFirst({
  where: and(eq(patient_wearable_connections.id, connectionId), eq(patient_wearable_connections.is_active, true)),
})
if (!conn) throw new Error('No active Oura connection found')

// getValidOuraToken — token update
await db.update(patient_wearable_connections).set({
  access_token_encrypted: encrypt(tokens.access_token),
  refresh_token_encrypted: encrypt(tokens.refresh_token),
  token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
  updated_at: new Date(),
}).where(eq(patient_wearable_connections.id, conn.id))
```

```ts
// saveOuraConnection
await db.insert(patient_wearable_connections).values({
  patient_id: patientId,
  provider: 'oura',
  access_token_encrypted: encrypt(tokens.access_token),
  refresh_token_encrypted: encrypt(tokens.refresh_token),
  token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
  is_active: true,
  connected_at: new Date(),
  updated_at: new Date(),
}).onConflictDoUpdate({
  target: [patient_wearable_connections.patient_id, patient_wearable_connections.provider],
  set: {
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    is_active: true,
    updated_at: new Date(),
  },
})
const saved = await db.query.patient_wearable_connections.findFirst({
  where: and(eq(patient_wearable_connections.patient_id, patientId), eq(patient_wearable_connections.provider, 'oura')),
  columns: { id: true },
})
return saved!.id
```

```ts
// getOuraConnection
return db.query.patient_wearable_connections.findFirst({
  where: and(
    eq(patient_wearable_connections.patient_id, patientId),
    eq(patient_wearable_connections.provider, 'oura'),
    eq(patient_wearable_connections.is_active, true),
  ),
}) ?? null
```

```ts
// disconnectOura
await db.update(patient_wearable_connections).set({
  is_active: false,
  access_token_encrypted: null,
  refresh_token_encrypted: null,
  updated_at: new Date(),
}).where(and(eq(patient_wearable_connections.patient_id, patientId), eq(patient_wearable_connections.provider, 'oura')))
```

```ts
// syncOuraData — upsert metrics
await db.insert(wearable_metrics).values(rows).onConflictDoUpdate({
  target: [wearable_metrics.patient_id, wearable_metrics.metric_date, wearable_metrics.metric_type],
  set: { value: sql`excluded.value`, synced_at: sql`excluded.synced_at` },
})

// syncOuraData — update last_synced_at
await db.update(patient_wearable_connections).set({ last_synced_at: new Date(), updated_at: new Date() }).where(eq(patient_wearable_connections.id, connectionId))

// syncOuraData — write sync log
await db.insert(wearable_sync_log).values({ connection_id: connectionId, records_fetched: metrics.length, status: 'success' })
// or on error:
await db.insert(wearable_sync_log).values({ connection_id: connectionId, records_fetched: 0, status: 'error', error_message: err.message })
```

- [ ] **Step 2: Read and update wearables/status/route.ts and wearables/metrics/route.ts**

```bash
cat src/app/api/wearables/status/route.ts
cat src/app/api/wearables/metrics/route.ts
```

Replace any remaining Supabase calls with Drizzle.

- [ ] **Step 3: Read and update oura OAuth routes**

```bash
cat src/app/api/auth/oura/callback/route.ts
cat src/app/api/auth/oura/initiate/route.ts
cat src/app/api/auth/oura/disconnect/route.ts
```

These routes mainly use the `oura.ts` library functions (already updated in Step 1). Any direct DB calls should also be updated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/oura.ts src/app/api/wearables/ src/app/api/auth/oura/
git commit -m "feat: migrate oura/wearables to Drizzle"
```

---

## Task 20: Migrate Presentation and Remaining Routes

**Files:**
- Modify: `src/app/api/presentation/generate/route.ts`
- Modify: `src/app/api/presentation/ai-notes/route.ts`
- Modify: `src/app/api/presentations/viewed/route.ts`
- Modify: `src/app/api/canvas/labs/order/route.ts`
- Modify: `src/app/api/canvas/prescribe/route.ts`
- Modify: `src/app/api/reminders/appointments/route.ts`
- Modify: `src/app/api/seed-patients/route.ts`
- Modify: `src/app/api/seed-labs/route.ts`
- Modify: Google OAuth routes: `src/app/api/auth/google/*/route.ts`

- [ ] **Step 1: Rewrite presentations/viewed/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { care_presentations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(req: NextRequest) {
  try {
    const { presentationId } = await req.json()
    if (!presentationId) return NextResponse.json({ error: 'presentationId is required' }, { status: 400 })

    await db.update(care_presentations)
      .set({ status: 'viewed', viewed_at: new Date() })
      .where(eq(care_presentations.id, presentationId))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Failed to mark presentation viewed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Rewrite reminders/appointments/route.ts**

```ts
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { eq, and, gte, lte, isNull } from 'drizzle-orm'
```

Replace the Supabase complex select with:
```ts
const now = new Date()
const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000)
const windowEnd   = new Date(now.getTime() + 24.5 * 60 * 60 * 1000)

const appts = await db.query.appointments.findMany({
  where: and(
    eq(appointments.status, 'confirmed'),
    isNull(appointments.reminder_sent_at),
    gte(appointments.starts_at, windowStart),
    lte(appointments.starts_at, windowEnd),
  ),
  with: {
    appointment_types: { columns: { name: true, duration_minutes: true } },
    patients: {
      columns: { id: true },
      with: { profiles: { columns: { first_name: true, last_name: true, email: true } } },
    },
  },
})
```

Then in the send loop:
```ts
await db.update(appointments).set({ reminder_sent_at: new Date() }).where(eq(appointments.id, appointment.id))
```

- [ ] **Step 3: Rewrite canvas/labs/order/route.ts**

```ts
import { db } from '@/lib/db'
import { lab_orders } from '@/lib/db/schema'

const [data] = await db.insert(lab_orders).values({
  patient_id: patientId,
  provider_id: providerId || null,
  visit_id: visitId || null,
  canvas_order_id: result.canvasOrderId,
  lab_partner: labPartner || 'quest',
  tests,
  clinical_indication: clinicalIndication || '',
  status: 'sent',
  ordered_at: result.sentAt,
}).returning()
```

- [ ] **Step 4: Read and update all remaining routes**

For each remaining route, read it then replace Supabase calls with Drizzle:

```bash
cat src/app/api/presentation/generate/route.ts
cat src/app/api/presentation/ai-notes/route.ts
cat src/app/api/canvas/prescribe/route.ts
cat src/app/api/seed-patients/route.ts
cat src/app/api/seed-labs/route.ts
cat src/app/api/auth/google/callback/route.ts
cat src/app/api/auth/google/status/route.ts
cat src/app/api/auth/google/disconnect/route.ts
cat src/app/api/auth/google/debug/route.ts
```

Apply the same pattern: `getServiceSupabase()` or inline `createClient()` → `db` from `@/lib/db`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/presentation/ src/app/api/presentations/ src/app/api/canvas/ src/app/api/reminders/ src/app/api/seed-patients/ src/app/api/seed-labs/ src/app/api/auth/google/
git commit -m "feat: migrate remaining routes to Drizzle"
```

---

## Task 21: Remove Supabase Server Client + Run All Tests

**Files:**
- Delete: `src/lib/supabase-server.ts` (no longer needed)

- [ ] **Step 1: Verify no imports remain**

```bash
grep -r "supabase-server" src/app/api/ src/lib/
```

Expected: no output. If any files still import from `supabase-server`, update them now.

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/supabase-server.ts
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass or fail only due to needing mock updates (not runtime errors). Fix any failing test mocks by replacing Supabase mocks with Drizzle mocks using the pattern from Task 11 Step 6.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove Supabase DB client, complete RDS migration"
```

---

## Task 22: Deploy to Staging and Verify

- [ ] **Step 1: Push to staging branch**

```bash
git push origin main:staging
```

- [ ] **Step 2: Monitor Vercel build**

Go to Vercel → Deployments. Wait for the staging deployment to succeed. If it fails, check build logs.

- [ ] **Step 3: Test on staging URL**

Open `https://womenkind-git-staging-dlolli-2486s-projects.vercel.app` and test these flows:

1. Patient login (Supabase Auth — should be unchanged)
2. Submit intake
3. Book an appointment
4. Send a message
5. Check in for an appointment
6. Trigger ambient recording (creates encounter note)
7. Check notifications

- [ ] **Step 4: Verify RDS connectivity**

If any route returns 500, check Vercel function logs for `DATABASE_URL` or SSL connection errors. Common fix: ensure `?sslmode=require` is in the connection string and the RDS security group allows traffic from Vercel's IPs (or 0.0.0.0/0 for now).

---

## Task 23: Deploy to Production

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Monitor Vercel build**

Wait for production deployment to succeed.

- [ ] **Step 3: Test production**

Test the same flows as Task 22 on the production URL.

- [ ] **Step 4: Clean up Supabase**

After confirming production works for 24 hours:

1. Go to Supabase → womenkind project → Table Editor
2. Drop all application tables (keep `auth.*` schema entirely — DO NOT touch it):
   - Drop: `appointments`, `appointment_types`, `provider_availability`, `availability_overrides`, `visits`, `encounter_notes`, `intakes`, `prescriptions`, `refill_requests`, `messages`, `notifications`, `subscriptions`, `clinics`, `clinic_providers`, `clinic_appointment_requests`, `phi_access_log`, `lab_orders`, `provider_notes`, `patient_wearable_connections`, `wearable_metrics`, `wearable_sync_log`, `care_presentations`, `profiles`, `patients`, `providers`
3. This reduces Supabase DB usage (auth schema remains for login)

---

## Spec Coverage Check

| Spec Section | Covered By |
|---|---|
| Infrastructure: 2 RDS instances (us-west-2, PostgreSQL 16) | Tasks 5, 6, 7 |
| Drizzle ORM + `postgres` npm package | Tasks 1, 2, 3, 4 |
| `profiles.id` as plain UUID (no FK to auth.users) | Task 2 (schema) |
| `get_nearby_clinics` stored procedure on RDS | Task 7 |
| `getServerSession.ts` — DB lookup via Drizzle | Task 8 |
| `phi-audit.ts` — writes via Drizzle | Task 9 |
| All ~42 API routes migrated | Tasks 10–20 |
| `oura.ts` updated | Task 19 |
| `supabase-server.ts` removed | Task 21 |
| Staging deploy + verification | Task 22 |
| Production deploy | Task 23 |
| Supabase cleanup | Task 23 Step 4 |
