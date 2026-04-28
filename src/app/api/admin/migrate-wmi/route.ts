import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// One-time migration: adds wmi_scores column to intakes table.
// Protected by GENERATE_BRIEFS_SECRET (same secret used for /api/generate-briefs).
// Call once after deploy: GET /api/admin/migrate-wmi?secret=<GENERATE_BRIEFS_SECRET>

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.GENERATE_BRIEFS_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await db.execute(sql`
      ALTER TABLE intakes
      ADD COLUMN IF NOT EXISTS wmi_scores json
    `)
    return NextResponse.json({ ok: true, message: 'wmi_scores column added (or already existed)' })
  } catch (err: any) {
    console.error('Migration error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
