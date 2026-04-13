-- ───────────────────────────────────────────────────────────────────────────────
-- ENCOUNTER NOTES
-- Clinical documentation table for ambient (in-office) and telehealth visits.
-- Created separately so the RLS policies in 20260411_rls_core_tables.sql
-- apply correctly once this table exists.
-- ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS encounter_notes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id             UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  appointment_id          UUID REFERENCES appointments(id) ON DELETE SET NULL,

  -- Origin of the recording
  source                  TEXT NOT NULL CHECK (source IN ('in_office', 'telehealth')),

  -- Storage references (one or the other depending on source)
  recording_storage_path  TEXT,   -- Supabase Storage path for ambient recordings
  recording_url           TEXT,   -- Daily.co S3 URL for telehealth recordings

  -- Transcription lifecycle
  status                  TEXT NOT NULL DEFAULT 'transcribing'
                            CHECK (status IN ('transcribing', 'draft', 'signed', 'failed')),
  assemblyai_transcript_id TEXT,

  -- Raw transcript (speaker-labeled)
  transcript              TEXT,

  -- Structured SOAP note fields
  chief_complaint         TEXT,
  hpi                     TEXT,
  ros                     TEXT,
  assessment              TEXT,
  plan                    TEXT,

  -- Audit fields
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION update_encounter_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encounter_notes_updated_at ON encounter_notes;
CREATE TRIGGER trg_encounter_notes_updated_at
  BEFORE UPDATE ON encounter_notes
  FOR EACH ROW EXECUTE FUNCTION update_encounter_notes_updated_at();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_encounter_notes_patient    ON encounter_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounter_notes_provider   ON encounter_notes(provider_id);
CREATE INDEX IF NOT EXISTS idx_encounter_notes_appointment ON encounter_notes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_encounter_notes_status     ON encounter_notes(status);
CREATE INDEX IF NOT EXISTS idx_encounter_notes_assemblyai ON encounter_notes(assemblyai_transcript_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Mirrors the conditional policies in 20260411_rls_core_tables.sql now that
-- the table actually exists.
-- ───────────────────────────────────────────────────────────────────────────────

ALTER TABLE encounter_notes ENABLE ROW LEVEL SECURITY;

-- Patients read their own; providers read all of their patients' notes
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

-- Only providers can create notes
DROP POLICY IF EXISTS "encounter_notes_insert_provider" ON encounter_notes;
CREATE POLICY "encounter_notes_insert_provider"
  ON encounter_notes FOR INSERT TO authenticated
  WITH CHECK (
    provider_id IN (
      SELECT id FROM providers WHERE profile_id = auth.uid()
    )
  );

-- Only the note's provider can update it
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
