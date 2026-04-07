import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getComponent } from '@/lib/presentation-components'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  try {
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
    const [patientRes, intakeRes, visitsRes, wearableRes] = await Promise.all([
      getSupabaseAdmin()
        .from('patients')
        .select('id, date_of_birth, state, profiles ( first_name, last_name )')
        .eq('id', patientId)
        .single(),
      getSupabaseAdmin()
        .from('intakes')
        .select('answers, ai_brief')
        .eq('patient_id', patientId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single(),
      getSupabaseAdmin()
        .from('visits')
        .select('visit_type, visit_date, symptom_scores, provider_notes, treatment_updates')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .limit(5),
      getSupabaseAdmin()
        .from('wearable_metrics')
        .select('metric_type, value, metric_date')
        .eq('patient_id', patientId)
        .gte('metric_date', thirtyDaysAgo)
        .order('metric_date', { ascending: false }),
    ])

    const patient = patientRes.data as any
    const intake = intakeRes.data
    const visits = visitsRes.data || []
    const wearableMetrics = (wearableRes.data || []) as any[]
    const firstName = patient?.profiles?.first_name || 'the patient'

    // Build context for Claude
    const aiBrief = intake?.ai_brief
    const symptomSummary = aiBrief?.symptom_summary
    const treatmentPathway = aiBrief?.treatment_pathway
    const latestScores = visits[0]?.symptom_scores || {}

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
- Recent visit notes: ${visits.map((v: any) => v.provider_notes).filter(Boolean).join(' | ') || 'None'}${ouraSection}

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

    // Call Claude API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicRes.ok) {
      console.error('Claude API error:', await anthropicRes.text())
      // Return a sensible fallback
      return NextResponse.json({
        draft: `${firstName}, based on our evaluation, the ${component.shortLabel.toLowerCase()} findings are an important part of your care plan. I'll be monitoring this closely and adjusting your treatment as needed.`,
      })
    }

    const claudeData = await anthropicRes.json()
    const draft = claudeData.content?.[0]?.text || ''

    return NextResponse.json({ draft })
  } catch (err) {
    console.error('AI notes error:', err)
    return NextResponse.json({ error: 'Failed to generate notes' }, { status: 500 })
  }
}
