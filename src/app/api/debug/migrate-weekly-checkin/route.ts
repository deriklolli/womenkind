import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * POST /api/debug/migrate-weekly-checkin
 * One-time migration: replaces the per-day uniqueness index with a per-week index.
 * Existing source='daily' rows are preserved.
 * Safe to run multiple times (uses IF EXISTS / IF NOT EXISTS).
 */
export async function POST() {
  try {
    await db.execute(sql`
      DROP INDEX IF EXISTS visits_patient_daily_unique
    `)

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS visits_patient_weekly_unique
        ON visits (patient_id, visit_date)
        WHERE source = 'weekly'
    `)

    const result = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'visits'
        AND indexname IN ('visits_patient_daily_unique', 'visits_patient_weekly_unique')
    `)

    return NextResponse.json({
      ok: true,
      message: 'visits_patient_weekly_unique index created, daily index dropped',
      indexes: [...result],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, detail: err.detail, code: err.code }, { status: 500 })
  }
}
