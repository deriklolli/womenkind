import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

import { db } from '@/lib/db'
import { intakes, wearable_metrics } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { invokeModel } from '@/lib/bedrock'

export async function POST(req: NextRequest) {
  const { secret } = await req.json()
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find the most recent draft intake
  const [latestDraft] = await db
    .select({
      id: intakes.id,
      patient_id: intakes.patient_id,
      answers: intakes.answers,
      status: intakes.status,
      created_at: intakes.created_at,
    })
    .from(intakes)
    .where(eq(intakes.status, 'draft'))
    .orderBy(desc(intakes.created_at))
    .limit(1)

  if (!latestDraft) {
    return NextResponse.json({ error: 'No draft intakes found' }, { status: 404 })
  }

  // Mark as submitted
  await db
    .update(intakes)
    .set({ status: 'submitted', submitted_at: new Date() })
    .where(eq(intakes.id, latestDraft.id))

  // Fetch wearable data for this patient
  let wearableMetricsList: { metric_type: string; value: number; metric_date: string }[] = []
  if (latestDraft.patient_id) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    wearableMetricsList = await db
      .select({
        metric_type: wearable_metrics.metric_type,
        value: wearable_metrics.value,
        metric_date: wearable_metrics.metric_date,
      })
      .from(wearable_metrics)
      .where(eq(wearable_metrics.patient_id, latestDraft.patient_id))
      .then(rows => rows.filter(r => r.metric_date >= thirtyDaysAgo))
  }

  // Generate brief
  const patientProfile = buildPatientProfile(latestDraft.answers as Record<string, any>)
  const text = await invokeModel({
    maxTokens: 8192,
    system: `You are a menopause-specialist clinical intake analyst for Womenkind. Transform patient intake data into a structured clinical brief for the provider.`,
    messages: [
      {
        role: 'user',
        content: `Generate a clinical brief for this patient. Return ONLY a JSON object with no markdown wrapping.

PATIENT INTAKE DATA:
${patientProfile}

Return this exact JSON structure:
{
  "symptom_summary": { "overview": "...", "domains": [] },
  "risk_flags": { "urgent": [], "contraindications": [], "considerations": [] },
  "treatment_pathway": { "recommended_approach": "...", "options": [], "patient_preferences": "..." },
  "suggested_questions": [],
  "metadata": { "menopausal_stage": "...", "symptom_burden": "...", "complexity": "...", "generated_at": "${new Date().toISOString()}" }
}`,
      },
    ],
  })

  let brief: any
  try {
    brief = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    brief = match ? JSON.parse(match[0]) : { raw_brief: text }
  }

  await db
    .update(intakes)
    .set({ ai_brief: brief })
    .where(eq(intakes.id, latestDraft.id))

  return NextResponse.json({
    message: 'Draft intake submitted and brief generated',
    intake_id: latestDraft.id,
    patient_id: latestDraft.patient_id,
    created_at: latestDraft.created_at,
  })
}

function buildPatientProfile(answers: Record<string, any>): string {
  const lines: string[] = []
  const add = (label: string, val: any) => {
    if (val !== undefined && val !== null && val !== '') {
      lines.push(`${label}: ${Array.isArray(val) ? val.join(', ') : val}`)
    }
  }
  add('Name', answers.full_name)
  add('DOB', answers.dob)
  add('Primary concern', answers.top_concern)
  add('Menstrual status', answers.menstrual)
  add('Menopausal stage', answers.menopausal_stage)
  add('Hot flash frequency', answers.hf_freq)
  add('Hot flash severity', answers.hf_severity)
  add('Sleep issues', answers.sleep_falling)
  add('Mood', answers.low_mood)
  add('Current medications', answers.current_meds)
  add('Medical history', answers.other_conditions)
  add('Treatment openness', answers.tx_openness)
  add('Additional notes', answers.open_notes)
  // Dump remaining keys not already covered
  const covered = new Set(['full_name','dob','top_concern','menstrual','menopausal_stage','hf_freq','hf_severity','sleep_falling','low_mood','current_meds','other_conditions','tx_openness','open_notes'])
  for (const [k, v] of Object.entries(answers)) {
    if (!covered.has(k) && v !== undefined && v !== null && v !== '') {
      lines.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    }
  }
  return lines.join('\n')
}
