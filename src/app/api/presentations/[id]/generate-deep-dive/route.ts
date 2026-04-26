import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { care_presentations, intakes, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { generateAllDeepDives } from '@/lib/deep-dive-generation'

export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Provider auth required
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    // 1. Get presentation
    const presentation = await db.query.care_presentations.findFirst({
      where: eq(care_presentations.id, params.id),
    })
    if (!presentation) {
      return NextResponse.json({ error: 'Presentation not found' }, { status: 404 })
    }

    const selectedComponents = (presentation.selected_components as string[] | null) ?? []
    if (!selectedComponents.length) {
      return NextResponse.json({ error: 'No selected components' }, { status: 400 })
    }

    // 2. Get intake (optional — generation degrades gracefully without it)
    let answers: Record<string, unknown> = {}
    let aiBrief: unknown = null

    if (presentation.intake_id) {
      const intake = await db.query.intakes.findFirst({
        where: eq(intakes.id, presentation.intake_id),
        columns: { answers: true, ai_brief: true },
      })
      if (intake) {
        answers = (intake.answers as Record<string, unknown>) ?? {}
        aiBrief = intake.ai_brief ?? null
      }
    }

    // 3. Get patient first name
    let firstName: string | null = null
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, presentation.patient_id),
      columns: { profile_id: true },
    })
    if (patient?.profile_id) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, patient.profile_id),
        columns: { first_name: true },
      })
      firstName = profile?.first_name ?? null
    }

    // 4. Generate deep dives (never throws — returns fallbacks for failed components)
    const generated = await generateAllDeepDives(selectedComponents, {
      firstName,
      answers,
      aiBrief: aiBrief as Parameters<typeof generateAllDeepDives>[1]['aiBrief'],
    })

    // 5. Merge into existing component_notes
    const existingNotes = (presentation.component_notes as Record<string, Record<string, unknown>> | null) ?? {}
    const mergedNotes: Record<string, Record<string, unknown>> = { ...existingNotes }

    for (const key of Object.keys(generated)) {
      mergedNotes[key] = {
        ...(mergedNotes[key] ?? {}),
        deep_dive: generated[key],
      }
    }

    // 6. Persist
    await db
      .update(care_presentations)
      .set({ component_notes: mergedNotes })
      .where(eq(care_presentations.id, params.id))

    return NextResponse.json({
      success: true,
      generated: Object.keys(generated),
    })
  } catch (err: unknown) {
    console.error('POST generate-deep-dive error:', err)
    // Return partial success shape even on unexpected error
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err), generated: [] },
      { status: 500 }
    )
  }
}
