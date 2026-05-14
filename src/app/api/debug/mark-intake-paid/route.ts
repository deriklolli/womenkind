import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { secret, intakeId } = await req.json()
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!intakeId) return NextResponse.json({ error: 'intakeId required' }, { status: 400 })

  await db.update(intakes).set({ paid: true, paid_at: new Date() }).where(eq(intakes.id, intakeId))
  return NextResponse.json({ ok: true, intakeId })
}
