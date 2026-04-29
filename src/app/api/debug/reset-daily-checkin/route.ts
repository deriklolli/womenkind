import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { visits, patients, profiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
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

  const day = new Date().getDay()
  const monday = new Date()
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day))
  const weekStart = monday.toISOString().split('T')[0]

  const deleted = await db.delete(visits)
    .where(and(
      eq(visits.patient_id, patient.id),
      eq(visits.visit_date, weekStart),
      eq(visits.source, 'weekly')
    ))
    .returning({ id: visits.id })

  return NextResponse.json({ deleted: deleted.length, weekStart })
}
