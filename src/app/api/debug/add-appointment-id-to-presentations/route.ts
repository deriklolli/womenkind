import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * POST /api/debug/add-appointment-id-to-presentations
 * One-time migration: adds `appointment_id` uuid column to care_presentations table.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
export async function POST() {
  try {
    await db.execute(
      sql`ALTER TABLE care_presentations ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id)`
    )
    return NextResponse.json({ ok: true, message: 'appointment_id column added (or already existed)' })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
