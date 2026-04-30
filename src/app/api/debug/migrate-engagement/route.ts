import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS engagement_log (
      id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id   uuid        NOT NULL REFERENCES patients(id),
      trigger_type text        NOT NULL,
      channel      text        NOT NULL DEFAULT 'email',
      sent_at      timestamptz NOT NULL DEFAULT now(),
      metadata     jsonb
    );
    CREATE INDEX IF NOT EXISTS engagement_log_patient_trigger_idx
      ON engagement_log(patient_id, trigger_type, sent_at DESC);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id        uuid        NOT NULL UNIQUE REFERENCES patients(id),
      checkin_reminders boolean     NOT NULL DEFAULT true,
      progress_updates  boolean     NOT NULL DEFAULT true,
      care_alerts       boolean     NOT NULL DEFAULT true,
      updated_at        timestamptz NOT NULL DEFAULT now()
    );
  `)

  return NextResponse.json({ ok: true, message: 'engagement_log and notification_preferences created' })
}
