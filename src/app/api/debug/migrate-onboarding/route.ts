import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await db.execute(sql`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS membership_plan text;
    `)
    return NextResponse.json({ ok: true, message: 'onboarding_status and membership_plan columns added' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
