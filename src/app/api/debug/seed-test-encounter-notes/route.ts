import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encounter_notes, patients, providers, profiles } from '@/lib/db/schema'
import { intakes } from '@/lib/db/schema'
import { and, eq, ilike } from 'drizzle-orm'
import { invokeModel } from '@/lib/bedrock'

export const maxDuration = 300

const TARGETS: Array<{ first: string; last: string }> = [
  { first: 'Janel', last: 'Ashburn' },
  { first: 'Hilary', last: 'Hays' },
]

interface GeneratedNote {
  transcript: string
  chief_complaint: string
  hpi: string
  ros: string
  assessment: string
  plan: string
}

const SYSTEM_PROMPT = `You are generating a realistic telehealth consultation record for testing purposes.

Output a JSON object with these fields:
{
  "transcript": "string — multi-paragraph back-and-forth between Provider (Dr. Urban) and Patient. ~600-900 words. Realistic clinical voice. Include direct quotes that map to the patient's intake answers and clinical brief findings. Use 'Provider:' and 'Patient:' labels with double newlines between exchanges.",
  "chief_complaint": "string — one sentence summarizing the primary reason for the visit, written in clinical voice",
  "hpi": "string — 4-7 sentences describing history of present illness in clinical voice. Reference specific symptoms, timeline, severity, and any wearable/objective data hinted at in the intake.",
  "ros": "string — review of systems organized by body system, only include positive findings or relevant negatives based on the intake",
  "assessment": "string — clinical assessment paragraph that connects the symptoms to the menopausal stage and identifies treatment candidacy",
  "plan": "string — numbered list of specific interventions. Name actual medications, doses, routes, and frequencies. Include any tests being ordered. Include follow-up timing."
}

Rules:
- Stay clinically consistent with the intake answers and ai_brief provided. If the intake says no hot flashes, do not invent hot flashes.
- The transcript should reflect the actual patient experience implied by the intake.
- The plan should align with the ai_brief's recommended treatment pathway when present.
- Use Dr. Joseph Urban Jr. as the provider.
- The patient is a real person with a real life — make the transcript feel human, not robotic.
- Do not include any markdown, code fences, or commentary outside the JSON.`

async function generateNote(
  firstName: string,
  intakeAnswers: Record<string, unknown>,
  aiBrief: unknown
): Promise<GeneratedNote> {
  const userPrompt = `Patient first name: ${firstName}

Intake answers:
${JSON.stringify(intakeAnswers, null, 2)}

AI clinical brief:
${JSON.stringify(aiBrief, null, 2)}

Generate the telehealth consultation JSON now.`

  const raw = await invokeModel({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 4096,
  })

  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`No JSON in Bedrock response: ${raw.slice(0, 200)}`)
  }
  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as GeneratedNote
  return parsed
}

export async function POST() {
  const results: Array<Record<string, unknown>> = []

  // Get the first active provider (Dr. Urban)
  const provider = await db.query.providers.findFirst({
    where: eq(providers.is_active, true),
    columns: { id: true },
  })
  if (!provider) {
    return NextResponse.json({ error: 'No active provider found' }, { status: 404 })
  }

  for (const target of TARGETS) {
    try {
      // Find profile by name (case-insensitive)
      const profile = await db.query.profiles.findFirst({
        where: and(ilike(profiles.first_name, target.first), ilike(profiles.last_name, target.last)),
        columns: { id: true, email: true },
      })
      if (!profile) {
        results.push({ patient: `${target.first} ${target.last}`, status: 'skipped', reason: 'profile not found' })
        continue
      }

      const patient = await db.query.patients.findFirst({
        where: eq(patients.profile_id, profile.id),
        columns: { id: true },
      })
      if (!patient) {
        results.push({ patient: `${target.first} ${target.last}`, status: 'skipped', reason: 'patient record not found' })
        continue
      }

      // Skip if a signed/draft note already exists for this patient
      const existing = await db.query.encounter_notes.findFirst({
        where: eq(encounter_notes.patient_id, patient.id),
        columns: { id: true, status: true },
      })
      if (existing) {
        results.push({
          patient: `${target.first} ${target.last}`,
          status: 'skipped',
          reason: `existing encounter note ${existing.id} (${existing.status})`,
        })
        continue
      }

      const intake = await db.query.intakes.findFirst({
        where: eq(intakes.patient_id, patient.id),
        orderBy: (i, { desc }) => [desc(i.submitted_at)],
        columns: { answers: true, ai_brief: true },
      })
      if (!intake) {
        results.push({
          patient: `${target.first} ${target.last}`,
          status: 'skipped',
          reason: 'no intake found — cannot generate consistent note',
        })
        continue
      }

      const generated = await generateNote(
        target.first,
        (intake.answers as Record<string, unknown>) ?? {},
        intake.ai_brief ?? null
      )

      const [note] = await db
        .insert(encounter_notes)
        .values({
          patient_id: patient.id,
          provider_id: provider.id,
          source: 'telehealth',
          status: 'signed',
          transcript: generated.transcript,
          chief_complaint: generated.chief_complaint,
          hpi: generated.hpi,
          ros: generated.ros,
          assessment: generated.assessment,
          plan: generated.plan,
        })
        .returning({ id: encounter_notes.id })

      results.push({
        patient: `${target.first} ${target.last}`,
        status: 'created',
        encounter_note_id: note.id,
        chief_complaint_preview: generated.chief_complaint,
      })
    } catch (err) {
      results.push({
        patient: `${target.first} ${target.last}`,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ ok: true, results })
}
