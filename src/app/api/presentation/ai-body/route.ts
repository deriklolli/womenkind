import { NextResponse } from 'next/server'

export const maxDuration = 60

import { db } from '@/lib/db'
import { patients, intakes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { getComponent } from '@/lib/presentation-components'
import { generateSingleComponentBody } from '@/lib/intake-component-bodies'

/**
 * POST /api/presentation/ai-body
 *
 * On-demand body-copy generator. Used as:
 *  1. The Regenerate button in the presentation-create UI.
 *  2. Lazy fallback when a patient's intake predates bodies pre-generation
 *     (or pre-generation failed for this component at submit time).
 *
 * The happy path is pre-generation at /api/intake/submit, which populates
 * intakes.ai_brief.component_bodies for all 10 components in one shot.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    const { patientId, componentKey } = await req.json()
    if (!patientId || !componentKey) {
      return NextResponse.json({ error: 'Missing patientId or componentKey' }, { status: 400 })
    }

    const component = getComponent(componentKey)
    if (!component) {
      return NextResponse.json({ error: 'Unknown component' }, { status: 400 })
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

    const firstName = (patientRow as any)?.profiles?.first_name ?? null
    const answers = (intakeRow?.answers as Record<string, any>) || {}
    const aiBrief = intakeRow?.ai_brief as any

    try {
      const draft = await generateSingleComponentBody(component, answers, aiBrief, firstName)
      return NextResponse.json({ draft })
    } catch (err) {
      console.error('Bedrock error (ai-body):', err)
      return NextResponse.json({ draft: component.defaultExplanation })
    }
  } catch (err) {
    console.error('AI body error:', err)
    return NextResponse.json({ error: 'Failed to generate body text' }, { status: 500 })
  }
}
