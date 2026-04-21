import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { generateClinicalBrief } from '@/lib/intake-brief'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/intake/regenerate-brief
 * Provider-only: regenerates the AI clinical brief for a given intake.
 * Used to recover intakes where the brief was missed during submission.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { intakeId } = await req.json()
  if (!intakeId) return NextResponse.json({ error: 'intakeId required' }, { status: 400 })

  const intake = await db.query.intakes.findFirst({
    where: eq(intakes.id, intakeId),
    columns: { answers: true },
  })

  if (!intake?.answers) {
    return NextResponse.json({ error: 'Intake not found or has no answers' }, { status: 404 })
  }

  const aiBrief = await generateClinicalBrief(intake.answers as Record<string, any>)
  await db.update(intakes).set({ ai_brief: aiBrief }).where(eq(intakes.id, intakeId))

  return NextResponse.json({ success: true })
}
