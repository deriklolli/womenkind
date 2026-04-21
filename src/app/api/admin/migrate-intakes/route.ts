import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: string[] = []

  for (const stmt of [
    `ALTER TABLE intakes ADD COLUMN IF NOT EXISTS provider_notes text`,
    `ALTER TABLE intakes ADD COLUMN IF NOT EXISTS reviewed_at timestamptz`,
  ]) {
    await db.execute(sql.raw(stmt))
    results.push(stmt)
  }

  return NextResponse.json({ ok: true, ran: results })
}
