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

    // Load patient data, latest intake, and visits for context
    const [patientRes, intakeRes, visitsRes] = await Promise.all([
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
    ])

    const patient = patientRes.data as any
    const intake = intakeRes.data
    const visits = visitsRes.data || []
    const firstName = patient?.profiles?.first_name || 'the patient'

    // Build context for Claude
    const aiBrief = intake?.ai_brief
    const symptomSummary = aiBrief?.symptom_summary
    const treatmentPathway = aiBrief?.treatment_pathway
    const latestScores = visits[0]?.symptom_scores || {}

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
- Recent visit notes: ${visits.map(v => v.provider_notes).filter(Boolean).join(' | ') || 'None'}

Write a 2-3 sentence personalized provider note for the ${component.label} section of ${firstName}'s care presentation.

RULES:
- Write in first person as Dr. Urban speaking directly to ${firstName}
- Be warm, reassuring, and specific to their data
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
