import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await db.execute(sql`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS last_md_review_at        timestamp WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS last_meaningful_touch_at timestamp WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS current_plan             text,
        ADD COLUMN IF NOT EXISTS next_step                text;
    `)

    await db.execute(sql`
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
      )
    `)

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS rx_changes_patient_id_idx ON prescription_changes(patient_id)
    `)

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS rx_changes_prescription_id_idx ON prescription_changes(prescription_id)
    `)

    return NextResponse.json({ ok: true, message: 'Build 17 migration complete' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
