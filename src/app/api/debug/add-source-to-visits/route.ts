import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * POST /api/debug/add-source-to-visits
 * One-time migration: adds `source` text column to visits table with default 'appointment',
 * and creates a partial unique index for daily check-ins (one per patient per day).
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
export async function POST() {
  try {
    await db.execute(sql`
      ALTER TABLE visits
        ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'appointment'
    `)

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS visits_patient_daily_unique
        ON visits (patient_id, visit_date)
        WHERE source = 'daily'
    `)

    // Verify
    const result = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'visits' AND column_name = 'source'
    `)

    return NextResponse.json({
      ok: true,
      message: 'source column and visits_patient_daily_unique index added (or already existed)',
      column: [...result],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, detail: err.detail, code: err.code, stack: err.stack }, { status: 500 })
  }
}
