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
  canceled_by:             text('canceled_by'),
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
  provider_notes:   text('provider_notes'),
  reviewed_at:      timestamp('reviewed_at', { withTimezone: true }),
  wmi_scores:       json('wmi_scores'),
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

// ── Provider Calendar Connections ─────────────────────────────────────────────
export const provider_calendar_connections = pgTable('provider_calendar_connections', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  provider_id:             uuid('provider_id').notNull().references(() => providers.id),
  google_email:            text('google_email'),
  google_calendar_id:      text('google_calendar_id').notNull().default('primary'),
  access_token_encrypted:  text('access_token_encrypted').notNull(),
  refresh_token_encrypted: text('refresh_token_encrypted').notNull(),
  token_expires_at:        timestamp('token_expires_at', { withTimezone: true }).notNull(),
  timezone:                text('timezone').notNull().default('America/Denver'),
  is_active:               boolean('is_active').notNull().default(true),
  synced_at:               timestamp('synced_at', { withTimezone: true }),
  created_at:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.provider_id),
}))

// ── Calendar Event Logs ───────────────────────────────────────────────────────
export const calendar_event_logs = pgTable('calendar_event_logs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  provider_id:    uuid('provider_id').notNull().references(() => providers.id),
  google_event_id: text('google_event_id'),
  action:         text('action').notNull(),
  error_message:  text('error_message'),
  created_at:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Care Presentations ────────────────────────────────────────────────────────
export const care_presentations = pgTable('care_presentations', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  patient_id:          uuid('patient_id').notNull().references(() => patients.id),
  provider_id:         uuid('provider_id').notNull().references(() => providers.id),
  intake_id:           uuid('intake_id').references(() => intakes.id),
  appointment_id:      uuid('appointment_id').references(() => appointments.id),
  selected_components: json('selected_components'),
  component_notes:     json('component_notes'),
  welcome_message:     text('welcome_message'),
  closing_message:     text('closing_message'),
  status:              text('status').notNull().default('draft'),
  viewed_at:           timestamp('viewed_at', { withTimezone: true }),
  created_at:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
