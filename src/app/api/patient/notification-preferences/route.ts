import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { notification_preferences } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const DEFAULT_PREFS = { checkin_reminders: true, progress_updates: true, care_alerts: true }

export async function GET() {
  const session = await getServerSession()
  if (!session || session.role !== 'patient' || !session.patientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await db.select()
    .from(notification_preferences)
    .where(eq(notification_preferences.patient_id, session.patientId))
    .limit(1)
  return NextResponse.json(rows[0] ?? { ...DEFAULT_PREFS, patient_id: session.patientId })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession()
  if (!session || session.role !== 'patient' || !session.patientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const allowed = ['checkin_reminders', 'progress_updates', 'care_alerts'] as const
  const update: Partial<Record<typeof allowed[number], boolean>> = {}
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') update[key] = body[key]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }
  await db.insert(notification_preferences)
    .values({ patient_id: session.patientId, ...DEFAULT_PREFS, ...update })
    .onConflictDoUpdate({
      target: notification_preferences.patient_id,
      set: { ...update, updated_at: new Date() },
    })
  return NextResponse.json({ ok: true })
}
