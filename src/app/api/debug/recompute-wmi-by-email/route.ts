import { NextRequest, NextResponse } from 'next/server'
import { computeWMI } from '@/lib/wmi-scoring'
import { db } from '@/lib/db'
import { intakes, patients, profiles } from '@/lib/db/schema'
import { eq, desc, and, ne } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.email, email),
    columns: { id: true },
  })
  if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 404 })

  const patient = await db.query.patients.findFirst({
    where: eq(patients.profile_id, profile.id),
    columns: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'patient not found' }, { status: 404 })

  const intake = await db.query.intakes.findFirst({
    where: and(eq(intakes.patient_id, patient.id), ne(intakes.status, 'draft')),
    columns: { id: true, answers: true, wmi_scores: true },
    orderBy: [desc(intakes.submitted_at)],
  })
  if (!intake?.answers) return NextResponse.json({ error: 'no submitted intake with answers' }, { status: 404 })

  const wmiScores = computeWMI(intake.answers as Record<string, any>)
  await db.update(intakes).set({ wmi_scores: wmiScores }).where(eq(intakes.id, intake.id))

  // Read back to verify the write persisted
  const verify = await db.query.intakes.findFirst({
    where: eq(intakes.id, intake.id),
    columns: { id: true, wmi_scores: true },
  })

  return NextResponse.json({
    ok: true,
    intakeId: intake.id,
    computed: { wmi: wmiScores.wmi, wmi_label: wmiScores.wmi_label, phenotype: wmiScores.phenotype },
    persisted_wmi: (verify?.wmi_scores as any)?.wmi ?? null,
    wmi_scores_null: verify?.wmi_scores === null,
  })
}
