-- Track whether a 24-hour reminder has been sent for each appointment
-- Used by /api/reminders/appointments to avoid duplicate sends
alter table appointments
  add column if not exists reminder_sent_at timestamptz default null;
