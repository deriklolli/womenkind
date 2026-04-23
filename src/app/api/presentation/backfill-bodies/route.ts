import { NextResponse } from 'next/server'

export const maxDuration = 300

import { db } from '@/lib/db'
import { patients, intakes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { generateComponentBodies } from '@/lib/intake-component-bodies'

/**
 * POST /api/presentation/backfill-bodies
 * Body: { patientId: string, force?: boolean }
 *
 * Generates all 10 personalized component body paragraphs for a patient's
 * latest intake and stores them under intakes.ai_brief.component_bodies.
 *
 * For intakes submitted before pre-generation was wired into /api/intake/submit.
 * Skips patients who already have bodies unless `force: true`.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    const { patientId, force = false } = await req.json()
    if (!patientId) {
      return NextResponse.json({ error: 'Missing patientId' }, { status: 400 })
    }

    const [patientRow, intakeRow] = await Promise.all([
      db.query.patients.findFirst({
        where: eq(patients.id, patientId),
        with: { profiles: { columns: { first_name: true } } },
      }),
      db.query.intakes.findFirst({
        where: eq(intakes.patient_id, patientId),
        orderBy: (intakes, { desc }) => [desc(intakes.submitted_at)],
      }),
    ])

    if (!intakeRow) {
      return NextResponse.json({ error: 'No intake found for patient' }, { status: 404 })
    }

    const aiBrief = (intakeRow.ai_brief as any) ?? null
    if (!aiBrief) {
      return NextResponse.json({ error: 'Intake has no ai_brief yet — run brief generation first' }, { status: 400 })
    }

    const existing = aiBrief.component_bodies
    if (existing && Object.keys(existing).length >= 10 && !force) {
      return NextResponse.json({
        skipped: true,
        reason: 'Bodies already exist. Pass force: true to regenerate.',
        count: Object.keys(existing).length,
      })
    }

    const firstName = (patientRow as any)?.profiles?.first_name ?? null
    const answers = (intakeRow.answers as Record<string, any>) || {}

    const bodies = await generateComponentBodies(answers, aiBrief, firstName)

    const merged = { ...aiBrief, component_bodies: bodies }
    await db.update(intakes).set({ ai_brief: merged }).where(eq(intakes.id, intakeRow.id))

    return NextResponse.json({
      success: true,
      count: Object.keys(bodies).length,
      keys: Object.keys(bodies),
    })
  } catch (err: any) {
    console.error('Backfill bodies error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to backfill bodies' }, { status: 500 })
  }
}
