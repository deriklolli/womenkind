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

    // Load patient data, latest intake, visits, and wearable metrics for context
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

    const patient = patientRow as any
    const intake = intakeRow
    const visitList = visitsRows || []
    const wearableMetrics = (wearableRows || []) as any[]
    const firstName = patient?.profiles?.first_name || 'the patient'

    // Build context for Claude
    const aiBrief = intake?.ai_brief as any
    const symptomSummary = aiBrief?.symptom_summary
    const treatmentPathway = aiBrief?.treatment_pathway
    const latestScores = visitList[0]?.symptom_scores || {}

    // Summarize Oura metrics by type (avg + most recent)
    const ouraByType: Record<string, number[]> = {}
    for (const m of wearableMetrics) {
      if (!ouraByType[m.metric_type]) ouraByType[m.metric_type] = []
      ouraByType[m.metric_type].push(m.value)
    }
    const ouraAvg = (vals: number[]) => (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
    const ouraRecent = (vals: number[]) => vals[0]?.toFixed(1)

    // Map which Oura metrics are relevant per body system component
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

    // Determine which metrics to include based on componentKey (partial match)
    const componentKeyLower = componentKey.toLowerCase()
    let relevantMetricKeys: string[] = []
    for (const [key, metrics] of Object.entries(componentOuraMap)) {
      if (componentKeyLower.includes(key)) {
        relevantMetricKeys = Array.from(new Set([...relevantMetricKeys, ...metrics]))
      }
    }
    // Fallback: include all if no mapping matched
    if (!relevantMetricKeys.length) relevantMetricKeys = Object.keys(ouraByType)

    const ouraLines: string[] = []
    for (const key of relevantMetricKeys) {
      const vals = ouraByType[key]
      if (!vals || vals.length === 0) continue
      const label = key.replace(/_/g, ' ')
      ouraLines.push(`  • ${label}: recent ${ouraRecent(vals)}, avg ${ouraAvg(vals)} (30-day, n=${vals.length} days)`)
    }

    const ouraSection = ouraLines.length
      ? `\nOURA RING WEARABLE DATA (30-day, relevant to this section):\n${ouraLines.join('\n')}\nNote: temperature deviation >0.5°C = vasomotor event; low HRV = autonomic burden; sleep fragmentation = menopause pattern`
      : ''

    const prompt = `You are a warm, empathetic medical communication specialist helping Dr. Urban write a personalized care note for ${firstName}.

BODY SYSTEM: ${component.label}
CLINICAL CONTEXT: ${component.clinicalRelevance}

PATIENT DATA:
- Name: ${firstName}
- Menopausal stage: ${aiBrief?.metadata?.menopausal_stage || 'Unknown'}
- Symptom burden: ${aiBrief?.metadata?.symptom_burden || 'Unknown'}
- Latest symptom scores: ${JSON.stringify(latestScores)}
${symptomSummary ? `- Symptom summary: ${JSON.stringify(symptomSummary)}` : ''}
${treatmentPathway ? `- Treatment pathway: ${JSON.stringify(treatmentPathway)}` : ''}
- Recent visit notes: ${visitList.map((v: any) => (v as any).provider_notes).filter(Boolean).join(' | ') || 'None'}${ouraSection}

Write a 2-3 sentence personalized provider note for the ${component.label} section of ${firstName}'s care presentation.

RULES:
- Write in first person as Dr. Urban speaking directly to ${firstName}
- Be warm, reassuring, and specific to their data
- If wearable data is present and relevant, weave it in naturally (e.g., "your Oura data shows..." or "we can see from your ring...")
- Reference their actual symptoms or findings where relevant
- Explain what you're doing about it and what they can expect
- Keep it concise — this appears as a small card in the presentation
- Do NOT use medical jargon without explaining it
- Do NOT start with "Dear" or letter formatting — this is a conversational note`

    // Call Claude via Bedrock
    let draft: string
    try {
      draft = await invokeModel({
        maxTokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })
    } catch (err) {
      console.error('Bedrock error:', err)
      return NextResponse.json({
        draft: `${firstName}, based on our evaluation, the ${component.shortLabel.toLowerCase()} findings are an important part of your care plan. I'll be monitoring this closely and adjusting your treatment as needed.`,
      })
    }

    return NextResponse.json({ draft })
  } catch (err) {
    console.error('AI notes error:', err)
    return NextResponse.json({ error: 'Failed to generate notes' }, { status: 500 })
  }
}
