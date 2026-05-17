-- Build 17: Patient Cockpit + Medication Change Tracker

-- 1. Add plan/review columns to patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS last_md_review_at        timestamp WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_meaningful_touch_at timestamp WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_plan             text,
  ADD COLUMN IF NOT EXISTS next_step                text;

-- 2. Prescription changes table
CREATE TABLE IF NOT EXISTS prescription_changes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id  uuid NOT NULL REFERENCES prescriptions(id),
  patient_id       uuid NOT NULL REFERENCES patients(id),
  provider_id      uuid NOT NULL REFERENCES providers(id),
  change_type      text NOT NULL,
  previous_dosage  text,
  new_dosage       text,
  previous_status  text,
  new_status       text,
  reason           text,
  created_at       timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rx_changes_patient_id_idx ON prescription_changes(patient_id);
CREATE INDEX IF NOT EXISTS rx_changes_prescription_id_idx ON prescription_changes(prescription_id);
