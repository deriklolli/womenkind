import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { generateClinicalBrief } from '@/lib/intake-brief'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider' && session.role !== 'patient') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { intakeId } = await req.json()
  if (!intakeId) return NextResponse.json({ error: 'intakeId required' }, { status: 400 })

  const intake = await db.query.intakes.findFirst({
    where: eq(intakes.id, intakeId),
    columns: { answers: true, patient_id: true },
  })

  // Patients may only regenerate their own intake
  if (session.role === 'patient' && intake?.patient_id !== session.patientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!intake?.answers) {
    return NextResponse.json({ error: 'Intake not found or has no answers' }, { status: 404 })
  }

  try {
    const aiBrief = await generateClinicalBrief(intake.answers as Record<string, any>)
    await db.update(intakes).set({ ai_brief: aiBrief }).where(eq(intakes.id, intakeId))
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[regenerate-brief] error:', err)
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
