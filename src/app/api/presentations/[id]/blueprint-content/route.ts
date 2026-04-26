import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { care_presentations, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { DeepDiveContent } from '@/lib/deep-dive-generation'

interface ComponentNotesEntry {
  deep_dive?: DeepDiveContent
  personalized_body?: string
  ai_draft?: string
  provider_note?: string
  [key: string]: unknown
}

interface BlueprintComponent {
  lead: string | null
  dr_quote: string | null
  dr_body: string | null
  plan: DeepDiveContent['plan'] | null
  stat: DeepDiveContent['stat'] | null
  body: string | null
  providerNote: string | null
}

interface BlueprintResponse {
  patient: { firstName: string; fullName: string }
  provider: { name: string }
  presentation: {
    welcomeMessage: string | null
    closingMessage: string | null
    selectedComponents: string[]
    components: Record<string, BlueprintComponent>
  }
}

/**
 * GET /api/presentations/[id]/blueprint-content
 * No auth required — shared via link, same model as GET /api/presentations/[id].
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const presentation = await db.query.care_presentations.findFirst({
      where: eq(care_presentations.id, params.id),
    })

    if (!presentation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Patient name
    let firstName = ''
    let fullName = ''
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, presentation.patient_id),
      columns: { profile_id: true },
    })
    if (patient?.profile_id) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, patient.profile_id),
        columns: { first_name: true, last_name: true },
      })
      firstName = profile?.first_name ?? ''
      fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    }

    const selectedComponents = (presentation.selected_components as string[] | null) ?? []
    const componentNotes = (presentation.component_notes as Record<string, ComponentNotesEntry> | null) ?? {}

    const components: Record<string, BlueprintComponent> = {}
    for (const key of selectedComponents) {
      const entry: ComponentNotesEntry = componentNotes[key] ?? {}
      const deepDive = entry.deep_dive ?? null

      components[key] = {
        lead: deepDive?.lead ?? null,
        dr_quote: deepDive?.dr_quote ?? null,
        dr_body: deepDive?.dr_body ?? null,
        plan: deepDive?.plan ?? null,
        stat: deepDive?.stat ?? null,
        body: entry.personalized_body ?? entry.ai_draft ?? null,
        providerNote: entry.provider_note ?? null,
      }
    }

    const response: BlueprintResponse = {
      patient: { firstName, fullName },
      provider: { name: 'Dr. Joseph Urban Jr.' },
      presentation: {
        welcomeMessage: presentation.welcome_message ?? null,
        closingMessage: presentation.closing_message ?? null,
        selectedComponents,
        components,
      },
    }

    return NextResponse.json(response)
  } catch (err: unknown) {
    console.error('GET blueprint-content error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
