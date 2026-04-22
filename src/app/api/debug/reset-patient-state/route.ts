import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles, care_presentations } from '@/lib/db/schema'
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

  // Remove presentation so dashboard shows the booking banner
  await db
    .delete(care_presentations)
    .where(eq(care_presentations.patient_id, patient.id))

  return NextResponse.json({ ok: true, patientId: patient.id })
}
