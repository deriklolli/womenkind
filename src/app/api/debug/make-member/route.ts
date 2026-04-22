import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { subscriptions, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(profiles.email, 'dlolli@gmail.com'))
    .limit(1)

  const patient = patientRows[0]
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.patient_id, patient.id),
  })

  const renewalDate = new Date()
  renewalDate.setMonth(renewalDate.getMonth() + 1)

  if (existing) {
    await db
      .update(subscriptions)
      .set({ status: 'active', plan_type: 'membership', current_period_end: renewalDate })
      .where(eq(subscriptions.patient_id, patient.id))
  } else {
    await db.insert(subscriptions).values({
      patient_id: patient.id,
      status: 'active',
      plan_type: 'membership',
      current_period_end: renewalDate,
    })
  }

  return NextResponse.json({ ok: true, patientId: patient.id, renewal: renewalDate })
}
