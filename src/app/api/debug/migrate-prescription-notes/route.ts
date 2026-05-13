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
      CREATE TABLE IF NOT EXISTS prescription_notes (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id uuid        NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        patient_id      uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        note            text        NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS prescription_notes_prescription_id_idx ON prescription_notes(prescription_id);
      CREATE INDEX IF NOT EXISTS prescription_notes_patient_id_idx ON prescription_notes(patient_id);
    `)
    return NextResponse.json({ ok: true, message: 'prescription_notes table created' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
