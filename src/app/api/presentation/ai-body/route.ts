import { NextResponse } from 'next/server'

export const maxDuration = 60

import { db } from '@/lib/db'
import { patients, intakes, visits, wearable_metrics } from '@/lib/db/schema'
import { eq, gte, desc, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { getComponent } from '@/lib/presentation-components'
import { invokeModel } from '@/lib/bedrock'

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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const [patientRow, intakeRow, visitsRows, wearableRows] = await Promise.all([
      db.query.patients.findFirst({
        where: eq(patients.id, patientId),
        with: { profiles: true },
      }),
      db.query.intakes.findFirst({
        where: eq(intakes.patient_id, patientId),
        orderBy: (intakes, { desc }) => [desc(intakes.submitted_at)],
      }),
      db
        .select({
          visit_type: visits.visit_type,
          visit_date: visits.visit_date,
          symptom_scores: visits.symptom_scores,
        })
        .from(visits)
        .where(eq(visits.patient_id, patientId))
        .orderBy(desc(visits.visit_date))
        .limit(5),
      db
        .select({
          metric_type: wearable_metrics.metric_type,
          value: wearable_metrics.value,
          metric_date: wearable_metrics.metric_date,
        })
        .from(wearable_metrics)
        .where(
          and(
            eq(wearable_metrics.patient_id, patientId),
            gte(wearable_metrics.metric_date, thirtyDaysAgo)
          )
        )
        .orderBy(desc(wearable_metrics.metric_date)),
    ])

    // TODO: enrich with lab_orders.results once labs are connected end-to-end.
    // Follow the raw-SQL pattern in src/app/api/patient/labs/route.ts (the
    // `results` column is json but not yet in the Drizzle schema). Filter to
    // labs whose tests/clinical_indication plausibly match component.clinicalRelevance.

    const patient = patientRow as any
    const intake = intakeRow
    const visitList = visitsRows || []
    const wearableMetrics = (wearableRows || []) as any[]
    const firstName = patient?.profiles?.first_name || 'the patient'

    const aiBrief = intake?.ai_brief as any
    const symptomSummary = aiBrief?.symptom_summary
    const treatmentPathway = aiBrief?.treatment_pathway
    const briefMetadata = aiBrief?.metadata
    const latestScores = visitList[0]?.symptom_scores || null

    const ouraByType: Record<string, number[]> = {}
    for (const m of wearableMetrics) {
      if (!ouraByType[m.metric_type]) ouraByType[m.metric_type] = []
      ouraByType[m.metric_type].push(m.value)
    }
    const ouraAvg = (vals: number[]) => (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
    const ouraRecent = (vals: number[]) => vals[0]?.toFixed(1)

    const componentOuraMap: Record<string, string[]> = {
      sleep:          ['sleep_score', 'sleep_efficiency', 'sleep_deep_minutes', 'sleep_rem_minutes', 'sleep_total_minutes'],
      mood:           ['sleep_score', 'sleep_rem_minutes', 'hrv_average', 'readiness_score'],
      cardiovascular: ['hrv_average', 'resting_heart_rate', 'respiratory_rate', 'readiness_score'],
      vasomotor:      ['temperature_deviation', 'temperature_trend_deviation', 'sleep_score', 'sleep_efficiency'],
      hormones:       ['temperature_deviation', 'hrv_average', 'resting_heart_rate'],
      bone:           ['readiness_score'],
      brain:          ['sleep_rem_minutes', 'sleep_deep_minutes', 'hrv_average'],
      metabolic:      ['resting_heart_rate', 'readiness_score'],
    }

    const componentKeyLower = componentKey.toLowerCase()
    let relevantMetricKeys: string[] = []
    for (const [key, metrics] of Object.entries(componentOuraMap)) {
      if (componentKeyLower.includes(key)) {
        relevantMetricKeys = Array.from(new Set([...relevantMetricKeys, ...metrics]))
      }
    }
    if (!relevantMetricKeys.length) relevantMetricKeys = Object.keys(ouraByType)

    const ouraLines: string[] = []
    for (const key of relevantMetricKeys) {
      const vals = ouraByType[key]
      if (!vals || vals.length === 0) continue
      const label = key.replace(/_/g, ' ')
      ouraLines.push(`  • ${label}: recent ${ouraRecent(vals)}, avg ${ouraAvg(vals)} (30-day, n=${vals.length} days)`)
    }

    // Build only the data sections that have content — omit missing sources.
    const dataSections: string[] = []

    if (symptomSummary || treatmentPathway || briefMetadata) {
      const briefParts: string[] = []
      if (briefMetadata?.menopausal_stage) briefParts.push(`  • Menopausal stage: ${briefMetadata.menopausal_stage}`)
      if (briefMetadata?.symptom_burden) briefParts.push(`  • Symptom burden: ${briefMetadata.symptom_burden}`)
      if (symptomSummary) briefParts.push(`  • Symptom summary: ${JSON.stringify(symptomSummary)}`)
      if (treatmentPathway) briefParts.push(`  • Treatment pathway: ${JSON.stringify(treatmentPathway)}`)
      dataSections.push(`INTAKE SUMMARY (from ${firstName}'s intake form):\n${briefParts.join('\n')}`)
    }

    if (latestScores && Object.keys(latestScores as any).length > 0) {
      dataSections.push(
        `PRE-APPOINTMENT SYMPTOM CHECK-IN (${firstName}'s quick self-rated checklist before recent visits):\n  ${JSON.stringify(latestScores)}`
      )
    }

    if (ouraLines.length) {
      dataSections.push(
        `OURA RING WEARABLE DATA (30-day, relevant to this body system):\n${ouraLines.join('\n')}\nNote: temperature deviation >0.5°C suggests vasomotor events; low HRV = autonomic burden; fragmented sleep is a menopause pattern.`
      )
    }

    const hasAnyData = dataSections.length > 0
    const dataBlock = hasAnyData
      ? dataSections.join('\n\n')
      : `(No intake, symptom-checker, or wearable data is available for ${firstName} yet for this body system. Write warmly and educationally without inventing specifics.)`

    const prompt = `You are a warm, empathetic writer helping craft ${firstName}'s personalized care presentation. Write the body text for the ${component.label} section — the paragraphs patients read when they first land on this section, before they see Dr. Urban's note.

BODY SYSTEM: ${component.label}
CLINICAL CONTEXT: ${component.clinicalRelevance}

AVAILABLE DATA FOR ${firstName}:
${dataBlock}

Write 2–3 paragraphs, warm and plainspoken, that:
- Open by naming what's going on for ${firstName} in this body system, drawing on whichever data sources are available. Reference her intake findings naturally ("in your intake you shared…"), weave in Oura trends if relevant ("your ring has been showing…"), and note symptom-checker patterns if present ("you've been marking this as a 7 out of 10 before recent visits…").
- Explain why it matters for her, without jargon.
- Describe how we'll address it (tie to the treatment pathway from her brief).
- End on a reassuring note about the path forward.

RULES:
- Write TO the patient (second person "you"), NOT as Dr. Urban in first person.
- Use her name sparingly — at most once or twice. It should feel like a book written for her, not a letter addressed to her.
- 2–3 paragraphs, each 3–5 sentences. Flowing prose — no headings, no bullet lists, no numbered lists.
- No medical jargon without plain-English explanation.
- Do not duplicate what Dr. Urban will say in his small note card (specific dosing, clinical plan details, lab orders).
- If a data source is missing, do not mention it or invent it — just use what you have.
- If no data sources have findings for this domain, stay educational and general rather than inventing specifics.
- Do not start with "Dear" or letter formatting. Do not sign off with a name.`

    let draft: string
    try {
      draft = await invokeModel({
        maxTokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      })
    } catch (err) {
      console.error('Bedrock error (ai-body):', err)
      return NextResponse.json({ draft: component.defaultExplanation })
    }

    return NextResponse.json({ draft })
  } catch (err) {
    console.error('AI body error:', err)
    return NextResponse.json({ error: 'Failed to generate body text' }, { status: 500 })
  }
}
