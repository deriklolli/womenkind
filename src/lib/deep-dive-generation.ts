import { invokeModel } from '@/lib/bedrock'
import { getComponent, type PresentationComponent } from '@/lib/presentation-components'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeepDiveContent {
  lead: string
  dr_quote: string
  dr_body: string
  plan: Array<{
    when: string
    title: string
    detail: string
  }>
  stat?: { value: string; label: string }
}

export interface PatientContext {
  firstName?: string | null
  answers: Record<string, unknown>
  aiBrief: AiBrief | null
}

// Loose type for the ai_brief JSON shape — fields may be absent
interface AiBrief {
  metadata?: {
    menopausal_stage?: string
    symptom_burden?: string
  }
  symptom_summary?: {
    domains?: Array<{
      name?: string
      key?: string
      severity?: string
      summary?: string
      patient_language?: string
      findings?: string
    }>
  }
  treatment_pathway?: {
    recommended_approach?: string
    priority_interventions?: string[]
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are writing clinical content in the voice of Dr. Joseph Urban Jr., a board-certified menopause specialist.

Voice guidelines:
- Direct, warm, clinically precise. You care deeply about patients and that shows through specificity, not sentiment.
- Use first person ("I", "we") for dr_quote and dr_body only.
- The lead paragraph is written in third perspective for the presentation slide — not first person.
- Reference specific patient data wherever available: lab values, symptom severity, the patient's own words from the intake. When patient-specific data is absent for a domain, fall back to accurate population-level statistics for perimenopausal and postmenopausal women.
- No em-dashes. Use commas or periods instead.
- Do not use: "The good news is", "rest assured", "I'm pleased", "exciting", "delighted", "thrilled".
- Use contractions freely (it's, we'll, you're, that's).
- Vary sentence length. Short punchy sentences after longer ones work well.
- Use precise medical language but always contextualize it immediately after.
- The plan items should be concrete and actionable, not generic. Each "when" window should be realistic for the clinical intervention described.

Output: valid JSON only. No markdown, no code fences, no commentary outside the JSON object.

JSON shape:
{
  "lead": "string — 2-3 sentences, third perspective, personalized to patient's situation",
  "dr_quote": "string — 1-2 sentences, first person, the most important thing Dr. Urban wants the patient to take away",
  "dr_body": "string — 2-3 sentences, first person, follow-up context that supports the quote",
  "plan": [
    { "when": "string", "title": "string", "detail": "string" }
  ],
  "stat": { "value": "string", "label": "string" }
}

The stat field is optional. Include it only when there is a compelling patient-specific number (e.g., a lab value, a symptom frequency, a risk percentage) that anchors the narrative. Omit the key entirely if nothing meaningful applies.

The plan should have 3-4 items covering an arc from immediate (this week) through short-term (weeks 2-8) to medium-term (month 2+) milestones.`

// ── Helper: find the matching domain from aiBrief ─────────────────────────────

type DomainEntry = NonNullable<NonNullable<AiBrief['symptom_summary']>['domains']>[number]

function findDomain(
  brief: AiBrief | null,
  componentKey: string
): DomainEntry | null {
  if (!brief?.symptom_summary?.domains?.length) return null
  const key = componentKey.toLowerCase()
  return (
    brief.symptom_summary.domains.find(
      (d) =>
        d.key?.toLowerCase() === key ||
        d.name?.toLowerCase().includes(key) ||
        key.includes(d.key?.toLowerCase() ?? '__none__')
    ) ?? null
  )
}

// ── Fallback content ──────────────────────────────────────────────────────────

function buildFallback(component: PresentationComponent): DeepDiveContent {
  return {
    lead: component.defaultExplanation,
    dr_quote: `This is one of the areas I focus on carefully for every patient in this transition.`,
    dr_body: `${component.clinicalRelevance} We'll build a targeted plan based on where you are right now and where you want to be.`,
    plan: [
      {
        when: 'This week',
        title: 'Baseline assessment',
        detail: 'Review your current symptoms and establish a starting point for tracking progress.',
      },
      {
        when: 'Weeks 2-4',
        title: 'Initiate treatment',
        detail: 'Begin the recommended interventions based on your clinical picture.',
      },
      {
        when: 'Month 2 check-in',
        title: 'Evaluate response',
        detail: 'Assess how your body is responding and adjust the plan as needed.',
      },
    ],
  }
}

// ── Core generation ───────────────────────────────────────────────────────────

export async function generateDeepDiveForComponent(
  component: PresentationComponent,
  context: PatientContext
): Promise<DeepDiveContent> {
  const { firstName, aiBrief } = context
  const domain = findDomain(aiBrief, component.key)

  const patientSection = firstName ? `Patient first name: ${firstName}` : 'Patient first name: not provided'
  const stageSection = aiBrief?.metadata?.menopausal_stage
    ? `Menopausal stage: ${aiBrief.metadata.menopausal_stage}`
    : 'Menopausal stage: not documented'
  const burdenSection = aiBrief?.metadata?.symptom_burden
    ? `Overall symptom burden: ${aiBrief.metadata.symptom_burden}`
    : 'Overall symptom burden: not documented'
  const approachSection = aiBrief?.treatment_pathway?.recommended_approach
    ? `Recommended treatment approach: ${aiBrief.treatment_pathway.recommended_approach}`
    : ''
  const interventionsSection = aiBrief?.treatment_pathway?.priority_interventions?.length
    ? `Priority interventions: ${aiBrief.treatment_pathway.priority_interventions.join(', ')}`
    : ''

  const domainSection = domain
    ? [
        `Domain findings for ${component.label}:`,
        domain.severity ? `  Severity: ${domain.severity}` : '',
        domain.summary ? `  Clinical summary: ${domain.summary}` : '',
        domain.findings ? `  Findings: ${domain.findings}` : '',
        domain.patient_language
          ? `  Patient's own words: "${domain.patient_language}"`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : `No domain-specific data available for ${component.label}. Use population-level statistics for perimenopausal/postmenopausal women.`

  const componentSection = [
    `Component: ${component.label}`,
    `Clinical relevance: ${component.clinicalRelevance}`,
    `Default explanation context: ${component.defaultExplanation}`,
  ].join('\n')

  const userPrompt = [
    patientSection,
    stageSection,
    burdenSection,
    approachSection,
    interventionsSection,
    '',
    domainSection,
    '',
    componentSection,
    '',
    'Generate the deep dive JSON for this component now.',
  ]
    .filter((line) => line !== undefined)
    .join('\n')

  let raw: string
  try {
    raw = await invokeModel({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1024,
    })
  } catch (err) {
    console.error(`[deep-dive] Bedrock call failed for component "${component.key}":`, err)
    return buildFallback(component)
  }

  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned) as DeepDiveContent
    // Validate minimally
    if (!parsed.lead || !parsed.dr_quote || !parsed.dr_body || !Array.isArray(parsed.plan)) {
      throw new Error('Missing required fields in parsed response')
    }
    return parsed
  } catch (err) {
    console.error(
      `[deep-dive] JSON parse failed for component "${component.key}":`,
      err,
      '\nRaw response:',
      raw
    )
    return buildFallback(component)
  }
}

// ── Batch generation ──────────────────────────────────────────────────────────

export async function generateAllDeepDives(
  componentKeys: string[],
  context: PatientContext
): Promise<Record<string, DeepDiveContent>> {
  const results = await Promise.allSettled(
    componentKeys.map(async (key) => {
      const component = getComponent(key)
      if (!component) {
        console.warn(`[deep-dive] Unknown component key: "${key}" — skipping`)
        return { key, content: null }
      }
      const content = await generateDeepDiveForComponent(component, context)
      return { key, content }
    })
  )

  const output: Record<string, DeepDiveContent> = {}

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.content !== null) {
      output[result.value.key] = result.value.content
    } else if (result.status === 'rejected') {
      // Individual errors are already logged inside generateDeepDiveForComponent
      console.error('[deep-dive] Unexpected rejection in allSettled:', result.reason)
    }
  }

  return output
}
