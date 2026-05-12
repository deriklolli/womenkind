import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles, subscriptions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const rows = await db.select({ id: patients.id }).from(patients)
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(profiles.email, 'joe@womenkindhealth.com')).limit(1)
  const patient = rows[0]
  if (!patient) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await db.update(patients).set({ onboarding_status: 'active' }).where(eq(patients.id, patient.id))
  const renewal = new Date(); renewal.setFullYear(renewal.getFullYear() + 1)
  const existing = await db.query.subscriptions.findFirst({ where: eq(subscriptions.patient_id, patient.id) })
  if (existing) {
    await db.update(subscriptions).set({ status: 'active', plan_type: 'vitality', current_period_end: renewal }).where(eq(subscriptions.patient_id, patient.id))
  } else {
    await db.insert(subscriptions).values({ patient_id: patient.id, status: 'active', plan_type: 'vitality', current_period_end: renewal })
  }
  return NextResponse.json({ ok: true })
}
