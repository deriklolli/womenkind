import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { intakes, patients } from '@/lib/db/schema'
import { eq, and, ne, desc } from 'drizzle-orm'
import { invokeModel } from '@/lib/bedrock'

export const maxDuration = 60

function scoreBand(score: number) {
  if (score >= 80) return 'Stable / Optimized'
  if (score >= 70) return 'Improving / Mild Strain'
  if (score >= 55) return 'Active Rebuild Zone'
  if (score >= 40) return 'Stabilization Priority'
  return 'High Support Zone'
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'patient' || !session.patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { score } = await req.json()
    if (typeof score !== 'number') {
      return NextResponse.json({ error: 'score is required' }, { status: 400 })
    }

    // Get the patient's most recent submitted intake for context
    const intakeRows = await db
      .select({ id: intakes.id, ai_brief: intakes.ai_brief })
      .from(intakes)
      .where(and(
        eq(intakes.patient_id, session.patientId),
        ne(intakes.status, 'draft'),
      ))
      .orderBy(desc(intakes.submitted_at))
      .limit(1)

    const intake = intakeRows[0]
    if (!intake) return NextResponse.json({ error: 'No intake found' }, { status: 404 })

    const brief = typeof intake.ai_brief === 'string'
      ? JSON.parse(intake.ai_brief)
      : intake.ai_brief as any

    const prevOverview: string | undefined =
      brief?.patient_blueprint?.overview ?? brief?.summary

    const band = scoreBand(score)

    const prompt = `Generate a brief status update for a menopause care patient.

Current Womenkind Menopause Index (WMI) score: ${Math.round(score)}/100
Score band: ${band}
${prevOverview ? `Previous overview: "${prevOverview}"` : ''}

Rules:
- headlinePrefix: 2-4 words that pair with headlineSuffix as "prefix & suffix" (e.g. "Needs attention &", "Early progress &", "Responding &")
- headlineSuffix: 1-2 words (e.g. "monitoring", "building", "improving")
- The combined headline must honestly reflect the score band
- overview: Exactly 2 sentences max, patient-facing, warm but direct, under 200 characters, no markdown, no preamble

Respond with ONLY this JSON object, nothing else:
{"headlinePrefix":"...","headlineSuffix":"...","overview":"..."}`

    const raw = await invokeModel({
      maxTokens: 256,
      system: 'You generate JSON status updates for a menopause patient portal. Return only the requested JSON, no other text.',
      messages: [{ role: 'user', content: prompt }],
    })

    // Parse Bedrock response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in Bedrock response')
    const { headlinePrefix, headlineSuffix, overview } = JSON.parse(jsonMatch[0])

    // Persist to ai_brief.live_status
    const updatedBrief = {
      ...(brief ?? {}),
      live_status: {
        headlinePrefix,
        headlineSuffix,
        overview,
        score: Math.round(score),
        generated_at: new Date().toISOString(),
      },
    }
    await db.update(intakes)
      .set({ ai_brief: updatedBrief })
      .where(eq(intakes.id, intake.id))

    return NextResponse.json({ headlinePrefix, headlineSuffix, overview })
  } catch (err: any) {
    console.error('refresh-summary error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
