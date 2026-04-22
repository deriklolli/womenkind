import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * POST /api/debug/add-canceled-by-column
 * One-time migration: adds `canceled_by` text column to appointments table.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
export async function POST() {
  try {
    await db.execute(sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS canceled_by TEXT`)
    return NextResponse.json({ ok: true, message: 'canceled_by column added (or already existed)' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
