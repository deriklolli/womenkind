import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { visits, patients, profiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, all } = body
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const [profile] = await db.select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1)

  if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 404 })

  const [patient] = await db.select({ id: patients.id })
    .from(patients)
    .where(eq(patients.profile_id, profile.id))
    .limit(1)

  if (!patient) return NextResponse.json({ error: 'patient not found' }, { status: 404 })

  let deleted
  if (all) {
    deleted = await db.delete(visits)
      .where(and(eq(visits.patient_id, patient.id), eq(visits.source, 'daily')))
      .returning({ id: visits.id })
  } else {
    const today = new Date().toISOString().split('T')[0]
    deleted = await db.delete(visits)
      .where(and(
        eq(visits.patient_id, patient.id),
        eq(visits.visit_date, today),
        eq(visits.source, 'daily')
      ))
      .returning({ id: visits.id })
  }

  return NextResponse.json({ deleted: deleted.length })
}
