import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { subscriptions, patients, profiles } from '@/lib/db/schema'
import { eq, ilike, or } from 'drizzle-orm'

// GET  ?name=casey   → search patients by name (for lookup)
// POST ?email=x@y.z  → activate membership for that patient
// POST (no params)   → activate dlolli@gmail.com (legacy)

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') || ''
  const rows = await db
    .select({ id: patients.id, email: profiles.email, first_name: profiles.first_name, last_name: profiles.last_name, onboarding_status: patients.onboarding_status })
    .from(patients)
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(or(ilike(profiles.last_name, `%${name}%`), ilike(profiles.first_name, `%${name}%`)))
    .limit(20)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') ?? 'dlolli@gmail.com'

  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(profiles.email, email))
    .limit(1)

  const patient = patientRows[0]
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Advance onboarding status to active
  await db
    .update(patients)
    .set({ onboarding_status: 'active' })
    .where(eq(patients.id, patient.id))

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.patient_id, patient.id),
  })

  const renewalDate = new Date()
  renewalDate.setFullYear(renewalDate.getFullYear() + 1)

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

  return NextResponse.json({ ok: true, email, patientId: patient.id, renewal: renewalDate })
}
