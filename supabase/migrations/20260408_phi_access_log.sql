-- PHI Access Audit Log
-- HIPAA requires logging every access, creation, update, and deletion of PHI.
-- All writes are server-side via service role. Providers can read their own entries.

create table if not exists phi_access_log (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  provider_id  uuid        references auth.users(id) on delete set null,
  patient_id   uuid        references patients(id)   on delete set null,
  record_type  text        not null,  -- 'encounter_note' | 'patient_profile' | 'appointment' | 'message' | 'prescription' | 'lab_result' | 'intake'
  record_id    uuid,                  -- id of the specific record accessed
  action       text        not null,  -- 'create' | 'read' | 'update' | 'delete' | 'sign' | 'export' | 'transcribe'
  api_route    text,                  -- e.g. '/api/visits/ambient-recording'
  ip_address   text,
  user_agent   text
);

-- Index for common query patterns
create index phi_access_log_provider_idx  on phi_access_log(provider_id);
create index phi_access_log_patient_idx   on phi_access_log(patient_id);
create index phi_access_log_created_idx   on phi_access_log(created_at desc);
create index phi_access_log_record_idx    on phi_access_log(record_type, record_id);

-- RLS: service role bypasses automatically; providers can read their own entries
alter table phi_access_log enable row level security;

create policy "providers can read own audit entries"
  on phi_access_log for select
  using (provider_id = auth.uid());

-- No insert/update/delete policies — only service role writes to this table
