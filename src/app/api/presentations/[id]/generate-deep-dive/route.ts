import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  care_presentations,
  encounter_notes,
  intakes,
  patients,
  profiles,
  visits,
} from '@/lib/db/schema'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { generateAllDeepDives, type DeepDiveContent } from '@/lib/deep-dive-generation'
import { buildWearableSummary } from '@/lib/wearable-summary'

export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    // 2. Get intake (optional)
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

    // 4. Get consultation notes — prefer the appointment linked to this presentation,
    //    fall back to most recent draft/signed note for the patient
    const appointmentId = (presentation.appointment_id as string | null) ?? null
    const encounterNote = await db.query.encounter_notes.findFirst({
      where: and(
        eq(encounter_notes.patient_id, presentation.patient_id),
        inArray(encounter_notes.status, ['draft', 'signed']),
        ...(appointmentId ? [eq(encounter_notes.appointment_id, appointmentId)] : [])
      ),
      orderBy: (n, { desc }) => [desc(n.created_at)],
      columns: {
        chief_complaint: true,
        hpi: true,
        ros: true,
        assessment: true,
        plan: true,
      },
    })

    const consultationNotes = encounterNote
      ? {
          chiefComplaint: encounterNote.chief_complaint ?? undefined,
          hpi: encounterNote.hpi ?? undefined,
          ros: encounterNote.ros ?? undefined,
          assessment: encounterNote.assessment ?? undefined,
          plan: encounterNote.plan ?? undefined,
        }
      : null

    // 5. Get wearable summary (30-day rolling window)
    const wearableSummary = await buildWearableSummary(presentation.patient_id).catch((err) => {
      console.warn('[deep-dive] wearable summary failed:', err)
      return null
    })

    // 6. Detect follow-up: check for any prior presentation for this patient
    const previousPresentation = await db.query.care_presentations.findFirst({
      where: and(
        eq(care_presentations.patient_id, presentation.patient_id),
        ne(care_presentations.id, params.id)
      ),
      orderBy: (p, { desc }) => [desc(p.created_at)],
      columns: { component_notes: true },
    })

    const isFollowUp = !!previousPresentation
    const prevNotes = previousPresentation?.component_notes as Record<string, Record<string, unknown>> | null ?? null
    const previousDeepDives: Record<string, DeepDiveContent> | null = prevNotes
      ? Object.fromEntries(
          Object.entries(prevNotes)
            .filter(([, v]) => v?.deep_dive)
            .map(([k, v]) => [k, v.deep_dive as DeepDiveContent])
        )
      : null

    // 7. Get symptom check-in scores — linked appointment if available, else most recent
    const visitRecord = await db.query.visits.findFirst({
      where: and(
        eq(visits.patient_id, presentation.patient_id),
        ...(appointmentId ? [eq(visits.appointment_id, appointmentId)] : [])
      ),
      orderBy: (v, { desc }) => [desc(v.created_at)],
      columns: { symptom_scores: true },
    })

    const rawScores = visitRecord?.symptom_scores as Record<string, number> | null ?? null
    const symptomScores = rawScores
      ? {
          vasomotor: rawScores.vasomotor ?? undefined,
          sleep: rawScores.sleep ?? undefined,
          energy: rawScores.energy ?? undefined,
          mood: rawScores.mood ?? undefined,
          gsm: rawScores.gsm ?? undefined,
          overall: rawScores.overall ?? undefined,
        }
      : null

    // 8. Generate deep dives
    const generated = await generateAllDeepDives(selectedComponents, {
      firstName,
      answers,
      aiBrief: aiBrief as Parameters<typeof generateAllDeepDives>[1]['aiBrief'],
      consultationNotes,
      wearableSummary,
      previousDeepDives,
      symptomScores,
      isFollowUp,
    })

    // 9. Merge into existing component_notes
    const existingNotes = (presentation.component_notes as Record<string, Record<string, unknown>> | null) ?? {}
    const mergedNotes: Record<string, Record<string, unknown>> = { ...existingNotes }

    for (const key of Object.keys(generated)) {
      mergedNotes[key] = {
        ...(mergedNotes[key] ?? {}),
        deep_dive: generated[key],
      }
    }

    // 10. Persist
    await db
      .update(care_presentations)
      .set({ component_notes: mergedNotes })
      .where(eq(care_presentations.id, params.id))

    return NextResponse.json({
      success: true,
      generated: Object.keys(generated),
      isFollowUp,
      hadConsultationNotes: !!consultationNotes,
      hadWearableData: !!wearableSummary,
      hadSymptomScores: !!symptomScores,
    })
  } catch (err: unknown) {
    console.error('POST generate-deep-dive error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err), generated: [] },
      { status: 500 }
    )
  }
}
