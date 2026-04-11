-- Build 11+: Comprehensive Row Level Security (RLS) policies for core Womenkind tables
-- Implements HIPAA-aligned access control for PHI and patient data.
--
-- Data model:
--   - profiles.id = auth.users.id (Supabase auth user)
--   - patients.profile_id = auth user ID (patient account link)
--   - providers.profile_id = auth user ID (provider account link)
--   - Most tables use patient_id and provider_id as FKs to patients/providers
--
-- Policy strategy:
--   - Since API routes use service role, RLS is defense-in-depth (secondary control)
--   - auth.uid() resolves the current user's auth ID
--   - Subqueries resolve patient/provider IDs from profile_id
--   - Drops existing policies before recreating (idempotent)

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- PROFILES TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Profiles are the auth user records; any authenticated user can read (for display).
-- Users update only their own profile.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_authenticated_read" ON profiles;
CREATE POLICY "profiles_authenticated_read"
  ON profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- PATIENTS TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Patients read/update only their own record.
-- Providers can read all patients (for matching, scheduling, etc.).

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patients_select_own" ON patients;
CREATE POLICY "patients_select_own"
  ON patients FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "patients_update_own" ON patients;
CREATE POLICY "patients_update_own"
  ON patients FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- PROVIDERS TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Any authenticated user can read all providers (needed for scheduling, display).
-- Providers update only their own record.

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "providers_authenticated_read" ON providers;
CREATE POLICY "providers_authenticated_read"
  ON providers FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "providers_update_own" ON providers;
CREATE POLICY "providers_update_own"
  ON providers FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- APPOINTMENTS TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Patients read their own appointments; providers read all.
-- Only providers can insert/update (they manage scheduling).

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_select_patient" ON appointments;
CREATE POLICY "appointments_select_patient"
  ON appointments FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "appointments_insert_provider" ON appointments;
CREATE POLICY "appointments_insert_provider"
  ON appointments FOR INSERT TO authenticated
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "appointments_update_provider" ON appointments;
CREATE POLICY "appointments_update_provider"
  ON appointments FOR UPDATE TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- VISITS TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Patients read their own visits; providers read all.
-- Only providers can insert/update (they record visits).

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visits_select_patient" ON visits;
CREATE POLICY "visits_select_patient"
  ON visits FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "visits_insert_provider" ON visits;
CREATE POLICY "visits_insert_provider"
  ON visits FOR INSERT TO authenticated
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "visits_update_provider" ON visits;
CREATE POLICY "visits_update_provider"
  ON visits FOR UPDATE TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- MESSAGES TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Users can read messages where they are sender or recipient.
-- For sender: patient messages have sender_id = patients.id, provider messages have sender_id = providers.id.
-- For recipient: can be either a patient ID or provider ID.
--
-- Insert: authenticated users (the API layer validates sender == current user).
-- Update: users can mark their own message as read; note: messages are generally not editable.

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT TO authenticated
  USING (
    -- Current user is the sender (patient)
    sender_type = 'patient'
    AND sender_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    -- Current user is the sender (provider)
    sender_type = 'provider'
    AND sender_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
    OR
    -- Current user is the recipient (patient)
    recipient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    -- Current user is the recipient (provider)
    recipient_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_authenticated" ON messages;
CREATE POLICY "messages_insert_authenticated"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "messages_update_mark_read" ON messages;
CREATE POLICY "messages_update_mark_read"
  ON messages FOR UPDATE TO authenticated
  USING (
    -- Only allow updates to own messages (mark as read)
    sender_type = 'patient'
    AND sender_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    sender_type = 'provider'
    AND sender_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_type = 'patient'
    AND sender_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    sender_type = 'provider'
    AND sender_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- PRESCRIPTIONS TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Patients read their own; providers read all.
-- Only providers can insert/update (they prescribe).

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescriptions_select_patient" ON prescriptions;
CREATE POLICY "prescriptions_select_patient"
  ON prescriptions FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prescriptions_insert_provider" ON prescriptions;
CREATE POLICY "prescriptions_insert_provider"
  ON prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prescriptions_update_provider" ON prescriptions;
CREATE POLICY "prescriptions_update_provider"
  ON prescriptions FOR UPDATE TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- REFILL_REQUESTS TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Patients read their own; providers read all (their queue).
-- Patients insert (they request refills); providers update (they approve/deny).

ALTER TABLE refill_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refill_requests_select_patient" ON refill_requests;
CREATE POLICY "refill_requests_select_patient"
  ON refill_requests FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "refill_requests_insert_patient" ON refill_requests;
CREATE POLICY "refill_requests_insert_patient"
  ON refill_requests FOR INSERT TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "refill_requests_update_provider" ON refill_requests;
CREATE POLICY "refill_requests_update_provider"
  ON refill_requests FOR UPDATE TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- INTAKES TABLE
-- ───────────────────────────────────────────────────────────────────────────────
-- Patients read/insert/update their own intakes.
-- Providers read all intakes and can update them (e.g. set status, add notes after review).

ALTER TABLE intakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intakes_select_patient" ON intakes;
CREATE POLICY "intakes_select_patient"
  ON intakes FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intakes_insert_patient" ON intakes;
CREATE POLICY "intakes_insert_patient"
  ON intakes FOR INSERT TO authenticated
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intakes_update_patient" ON intakes;
CREATE POLICY "intakes_update_patient"
  ON intakes FOR UPDATE TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "intakes_update_provider" ON intakes;
CREATE POLICY "intakes_update_provider"
  ON intakes FOR UPDATE TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- ENCOUNTER_NOTES TABLE (if it exists)
-- ───────────────────────────────────────────────────────────────────────────────
-- Patients read their own; providers read all.
-- Only providers can insert/update (they write clinical notes).

ALTER TABLE encounter_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encounter_notes_select_patient" ON encounter_notes;
CREATE POLICY "encounter_notes_select_patient"
  ON encounter_notes FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
    OR
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "encounter_notes_insert_provider" ON encounter_notes;
CREATE POLICY "encounter_notes_insert_provider"
  ON encounter_notes FOR INSERT TO authenticated
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "encounter_notes_update_provider" ON encounter_notes;
CREATE POLICY "encounter_notes_update_provider"
  ON encounter_notes FOR UPDATE TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- NOTIFICATIONS TABLE (if it exists)
-- ───────────────────────────────────────────────────────────────────────────────
-- Patients read only their own notifications.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE profile_id = auth.uid()
    )
  );

COMMIT;
