-- Build 1: Patient symptom check-in
-- Adds appointment linkage and check-in tracking to visits table

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS visits_appointment_id_unique
  ON visits(appointment_id)
  WHERE appointment_id IS NOT NULL;
