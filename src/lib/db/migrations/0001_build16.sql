-- Build 16: Multi-Staff Clinical Command Center

-- 1. Add role fields to providers
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS specialty text;

-- 2. Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                  uuid NOT NULL REFERENCES patients(id),
  title                       text NOT NULL,
  body                        text,
  category                    text NOT NULL,
  priority                    text NOT NULL,
  status                      text NOT NULL DEFAULT 'new',
  owner_staff_id              uuid REFERENCES providers(id),
  backup_owner_staff_id       uuid REFERENCES providers(id),
  source                      text NOT NULL,
  source_ref                  text,
  message_category            text,
  due_at                      timestamp WITH TIME ZONE,
  acknowledged_at             timestamp WITH TIME ZONE,
  acknowledged_by             uuid REFERENCES providers(id),
  closed_at                   timestamp WITH TIME ZONE,
  closed_by                   uuid REFERENCES providers(id),
  closeout_what_was_done      text,
  closeout_plan               text,
  closeout_followup_who       uuid REFERENCES providers(id),
  closeout_followup_when      timestamp WITH TIME ZONE,
  closeout_followup_how       text,
  closeout_safety_open        boolean DEFAULT false,
  closeout_no_followup_reason text,
  follow_up_task_id           uuid REFERENCES tasks(id),
  requires_md_signoff         boolean NOT NULL DEFAULT false,
  patient_notified            boolean NOT NULL DEFAULT false,
  contact_attempts            integer NOT NULL DEFAULT 0,
  last_contact_attempt        timestamp WITH TIME ZONE,
  created_at                  timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at                  timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_patient_id_idx ON tasks(patient_id);
CREATE INDEX IF NOT EXISTS tasks_owner_staff_id_idx ON tasks(owner_staff_id);
CREATE INDEX IF NOT EXISTS tasks_status_priority_idx ON tasks(status, priority);
CREATE INDEX IF NOT EXISTS tasks_due_at_idx ON tasks(due_at) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX IF NOT EXISTS tasks_message_category_idx ON tasks(message_category) WHERE message_category IS NOT NULL;

-- 3. Audit events table
CREATE TABLE IF NOT EXISTS audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  staff_id      uuid REFERENCES providers(id),
  patient_id    uuid REFERENCES patients(id),
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   text,
  metadata      jsonb,
  ip            text,
  user_agent    text,
  created_at    timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_patient_id_idx ON audit_events(patient_id);
CREATE INDEX IF NOT EXISTS audit_events_staff_id_idx ON audit_events(staff_id);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events(created_at DESC);
