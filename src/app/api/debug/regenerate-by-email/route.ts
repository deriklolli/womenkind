import { NextRequest, NextResponse } from 'next/server'
import { generateClinicalBrief } from '@/lib/intake-brief'
import { computeWMI } from '@/lib/wmi-scoring'
import { db } from '@/lib/db'
import { intakes, patients, profiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export const maxDuration = 300

/**
 * POST /api/debug/regenerate-by-email
 * Body: { secret, email }
 * Looks up the patient by email, finds their most recent submitted intake,
 * recomputes WMI scores + AI brief using the latest pipeline, and persists.
 */
export async function POST(req: NextRequest) {
  try {
    const { secret, email } = await req.json()
    const expected = process.env.GENERATE_BRIEFS_SECRET
    if (!expected || !secret || secret !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
      where: eq(intakes.patient_id, patient.id),
      orderBy: [desc(intakes.submitted_at)],
      columns: { id: true, answers: true, status: true },
    })
    if (!intake?.answers) return NextResponse.json({ error: 'no intake with answers found' }, { status: 404 })

    const answers = intake.answers as Record<string, any>
    const wmiScores = computeWMI(answers)
    await db.update(intakes).set({ wmi_scores: wmiScores }).where(eq(intakes.id, intake.id))

    const aiBrief = await generateClinicalBrief(answers, wmiScores)
    await db.update(intakes).set({ ai_brief: aiBrief }).where(eq(intakes.id, intake.id))

    return NextResponse.json({
      success: true,
      intakeId: intake.id,
      wmi: wmiScores.wmi,
      wmi_label: wmiScores.wmi_label,
      phenotype: wmiScores.phenotype,
    })
  } catch (err: any) {
    console.error('[regenerate-by-email] error:', err)
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
