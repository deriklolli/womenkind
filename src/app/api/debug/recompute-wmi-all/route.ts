import { NextResponse } from 'next/server'
import { computeWMI } from '@/lib/wmi-scoring'
import { db } from '@/lib/db'
import { intakes, patients, profiles } from '@/lib/db/schema'
import { eq, ne, and, desc } from 'drizzle-orm'

export async function POST() {
  const allPatients = await db.query.patients.findMany({
    columns: { id: true, profile_id: true },
  })

  const results = []

  for (const patient of allPatients) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, patient.profile_id),
      columns: { email: true },
    })

    const intake = await db.query.intakes.findFirst({
      where: and(eq(intakes.patient_id, patient.id), ne(intakes.status, 'draft')),
      columns: { id: true, answers: true },
      orderBy: [desc(intakes.submitted_at)],
    })

    if (!intake?.answers) {
      results.push({ email: profile?.email, skipped: 'no submitted intake' })
      continue
    }

    const wmiScores = computeWMI(intake.answers as Record<string, any>)
    await db.update(intakes).set({ wmi_scores: wmiScores }).where(eq(intakes.id, intake.id))

    results.push({
      email: profile?.email,
      intakeId: intake.id,
      wmi: wmiScores.wmi,
      wmi_label: wmiScores.wmi_label,
      phenotype: wmiScores.phenotype,
    })
  }

  return NextResponse.json({ ok: true, results })
}
