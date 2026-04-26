import { invokeModel } from '@/lib/bedrock'
import { getComponent, type PresentationComponent } from '@/lib/presentation-components'
import type { WearableSummary } from '@/lib/wearable-summary'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeepDiveContent {
  lead: string
  dr_card: string
  dr_quote: string
  dr_body: string
  plan: Array<{
    when: string
    title: string
    detail: string
  }>
  stat?: { value: string; label: string }
}

export interface ConsultationNotes {
  chiefComplaint?: string
  hpi?: string
  ros?: string
  assessment?: string
  plan?: string
}

export interface SymptomScores {
  vasomotor?: number
  sleep?: number
  energy?: number
  mood?: number
  gsm?: number
  overall?: number
}

export interface PatientContext {
  firstName?: string | null
  answers: Record<string, unknown>
  aiBrief: AiBrief | null
  consultationNotes?: ConsultationNotes | null
  wearableSummary?: WearableSummary | null
  previousDeepDives?: Record<string, DeepDiveContent> | null
  symptomScores?: SymptomScores | null
  isFollowUp?: boolean
}

interface AiBrief {
  metadata?: {
    menopausal_stage?: string
    symptom_burden?: string
    complexity?: string
  }
  symptom_summary?: {
    overview?: string
    domains?: Array<{
      domain?: string
      severity?: string
      findings?: string
      patient_language?: string
    }>
  }
  risk_flags?: {
    urgent?: string[]
    contraindications?: string[]
    considerations?: string[]
  }
  treatment_pathway?: {
    recommended_approach?: string
    options?: Array<{
      treatment?: string
      rationale?: string
      considerations?: string
    }>
    patient_preferences?: string
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are writing patient-facing clinical content in the voice of Dr. Joseph Urban Jr., a board-certified menopause specialist. This presentation is read by the patient, not the provider.

Voice guidelines:
- Speak directly to the patient using "you" and "your" throughout — never "she", "her", or the patient's name in third person. If you use the patient's first name, follow it immediately with "your" (e.g., "Sarah, your Oura data..." not "Sarah's Oura data...").
- Warm, confident, and empathetic. The patient should feel seen, heard, and in control — not overwhelmed.
- Use first person ("I", "we") for dr_quote and dr_body to reinforce the direct relationship between doctor and patient.
- Medical terms are fine, but always explain them in plain language immediately after. One sentence of context right after any jargon.
- No em-dashes. Use commas or periods instead.
- Do not use: "The good news is", "rest assured", "I'm pleased", "exciting", "delighted", "thrilled".
- Never use hypothetical framing like "If you've been feeling..." or "Many women experience..." when you have actual data from this patient. We have their intake answers, their own words, their wearable data, and their consultation notes. Use them.
- Use contractions freely (it's, we'll, you're, that's).
- Vary sentence length. Short punchy sentences after longer ones work well.
- The plan items should be concrete and actionable, written as clear next steps for the patient.

THE LEAD PARAGRAPH RULE — this overrides everything else:
The lead must be 2-3 SHORT sentences. Max 5 lines. It must open with something this specific patient actually said, experienced, or measured.

ABSOLUTELY FORBIDDEN in the lead — these will be rejected:
- Hypothetical openers: "If you've...", "If you've been feeling...", "If you've said...", "Have you noticed...", "Many women..."
- Universal observations: "Hot flashes are...", "Sleep is important...", "Mood changes are common..."
- Any sentence that could appear in any patient's presentation

This rule applies to ALL topics including mood, brain, and GSM — even sensitive ones. Especially sensitive ones. When the patient shared something vulnerable in their intake or consultation, using their actual words is MORE respectful than a generic opener, not less.

Priority order — use the highest available:
  1. Patient's own words from intake or consultation. Quote or closely paraphrase them directly.
  2. A specific symptom score or wearable metric tied to this domain.
  3. A clinical finding from the consultation notes.
  4. A domain finding from the clinical brief.
  5. ONLY as a last resort with zero other data: a single population-level fact, stated as directly relevant to this patient.

Output: valid JSON only. No markdown, no code fences, no commentary outside the JSON object.

JSON shape:
{
  "lead": "string — 2-3 SHORT sentences, max 5 lines, second person, anchored in this patient's actual words or data",
  "dr_card": "string — 1-2 sentences max, first person. Shown on the main presentation page (not the deep dive). Reference one specific thing Dr. Urban heard or observed from this patient, then close with a brief forward-looking line. No jargon. No treatment details. Warm, direct, human. Example tone: 'You described three weeks of waking up drenched and exhausted. I hear you, and we have a clear plan.'",
  "dr_quote": "string — 1-2 sentences, first person. The single most important clinical truth for this patient. Reference something specific to her situation — her symptom severity, her wearable data, her words, her treatment plan.",
  "dr_body": "string — 2-3 sentences, first person. Supports the quote with specifics from this patient's data. Mention the actual medication, the actual finding, the actual number — not a generic explanation of how menopause works.",
  "plan": [
    { "when": "string", "title": "string", "detail": "string" }
  ],
  "stat": { "value": "string", "label": "string" }
}

The stat field is optional. Include it only when there is a compelling patient-specific number directly relevant to THIS component's domain — not a generic wearable metric that could appear in any section. For example, resting heart rate belongs in vasomotor, sleep score belongs in sleep, HRV belongs in cardiovascular. Do not use a metric that belongs to a different domain. If no directly relevant stat exists for this component, omit the stat key entirely. Write the label in second person ("your sleep score over the past 30 days").

The plan should have 3-4 items. Every item must be grounded in this patient's actual clinical picture — name the real medication being prescribed, the real test being ordered, the real metric being tracked. Generic items like "begin treatment" or "track your symptoms" are not acceptable when we have clinical detail. Write each detail as a direct, specific instruction for this patient.

PERSONALIZATION STANDARD — applies to every field, not just the lead:
Any sentence that could appear in any patient's presentation is a failure. Every sentence should pass this test: "Could I only write this for this specific patient, given what I know about her?" If not, replace it with something that uses her data, her words, or her clinical findings.`

const FOLLOW_UP_ADDENDUM = `

This is a follow-up presentation. Where previous visit data is provided:
- Reference progress in second person: "Since we last met, your X has..." or "You've made real progress on..." or "We're still working on...".
- Be specific about direction of change. Don't say "things are improving" — say what improved and by how much if data supports it.
- The plan should reflect continuation and next steps, not starting over.`

// ── Helper: find the matching domain from aiBrief ─────────────────────────────

type DomainEntry = NonNullable<NonNullable<AiBrief['symptom_summary']>['domains']>[number]

function findDomain(brief: AiBrief | null, componentKey: string): DomainEntry | null {
  if (!brief?.symptom_summary?.domains?.length) return null
  const key = componentKey.toLowerCase()
  return (
    brief.symptom_summary.domains.find((d) => {
      const domainName = d.domain?.toLowerCase() ?? ''
      return domainName.includes(key) || key.includes(domainName.split(' ')[0])
    }) ?? null
  )
}

// ── Helper: extract relevant raw intake fields per component ──────────────────

function buildIntakeSection(answers: Record<string, unknown>, componentKey: string): string {
  const lines: string[] = []

  const str = (v: unknown) => (Array.isArray(v) ? v.join(', ') : String(v ?? ''))
  const add = (label: string, key: string) => {
    const v = answers[key]
    if (v !== undefined && v !== null && v !== '' && v !== 'None') {
      lines.push(`  ${label}: ${str(v)}`)
    }
  }

  if (answers.top_concern) lines.push(`  Primary concern (patient's words): "${answers.top_concern}"`)
  if (answers.open_notes) lines.push(`  Additional notes (patient's words): "${answers.open_notes}"`)
  add('Menopausal status', 'menstrual')
  add('Treatments previously tried', 'treatments_tried')
  add('Open to', 'tx_openness')
  add('Dosing preference', 'dosing_pref')

  switch (componentKey) {
    case 'vasomotor':
      add('Hot flash frequency', 'hf_freq')
      add('Hot flash severity', 'hf_severity')
      add('Sleep disruption from VMS', 'hf_sleep')
      add('Hot flash duration', 'hf_duration')
      add('Daily interference', 'hf_interference')
      add('Associated symptoms', 'hf_assoc')
      break
    case 'brain':
      add('Brain fog/forgetfulness', 'brain_fog')
      add('Fatigue', 'fatigue')
      add('Anxiety', 'anxiety')
      add('Sleep quality', 'sleep_falling')
      add('Night waking', 'sleep_waking')
      break
    case 'mood':
      add('Low mood/depression', 'low_mood')
      add('Irritability/rage', 'irritability')
      add('Anxiety/restlessness', 'anxiety')
      add('Brain fog', 'brain_fog')
      add('Fatigue', 'fatigue')
      add('Wired but tired', 'wired_tired')
      add('Palpitations', 'palpitations')
      break
    case 'sleep':
      add('Difficulty falling asleep', 'sleep_falling')
      add('Night waking (3 AM)', 'sleep_waking')
      add('Wired but tired', 'wired_tired')
      add('Sleep disruption from hot flashes', 'hf_sleep')
      add('Fatigue', 'fatigue')
      break
    case 'cardiovascular':
      if (answers.bp_known === 'Yes') {
        lines.push(`  Blood pressure: ${answers.bp_sys ?? '?'}/${answers.bp_dia ?? '?'}`)
      }
      add('Cardiovascular/clotting history', 'cardio')
      add('Smoking', 'smoking')
      add('Palpitations', 'palpitations')
      break
    case 'bone':
      add('Fracture after age 40', 'fracture')
      add('Parent hip fracture', 'parent_hip')
      add('Family osteoporosis', 'family_osteo')
      add('DEXA scan', 'dexa')
      add('Strength training', 'strength')
      add('Strength training frequency', 'strength_days')
      add('Daily protein', 'protein')
      add('Alcohol', 'alcohol')
      break
    case 'metabolism':
      add('Midsection weight gain', 'midsection')
      add('Strength training', 'strength')
      add('Strength training frequency', 'strength_days')
      add('Daily protein', 'protein')
      add('Alcohol', 'alcohol')
      if (answers.bp_known === 'Yes') {
        lines.push(`  Blood pressure: ${answers.bp_sys ?? '?'}/${answers.bp_dia ?? '?'}`)
      }
      break
    case 'hormonal':
      add('Uterus', 'uterus')
      add('Ovaries', 'ovaries')
      add('Menstrual status', 'menstrual')
      add('Last menstrual period', 'lmp')
      add('Cycle changes (past 12 months)', 'cycle_changes')
      add('Abnormal bleeding', 'abnormal_bleeding')
      add('Birth control need', 'bc_need')
      add('Current medications', 'current_meds')
      break
    case 'gsm':
      add('GSM symptoms', 'gsm')
      add('Bladder severity', 'bladder_sev')
      add('Vaginal severity', 'vaginal_sev')
      add('Sexual desire change', 'sexual_change')
      break
    case 'skin':
      add('Current medications', 'current_meds')
      add('Alcohol', 'alcohol')
      add('Smoking', 'smoking')
      break
  }

  return lines.length ? `Intake form data:\n${lines.join('\n')}` : ''
}

// ── Helper: build consultation notes section ──────────────────────────────────

function buildConsultationSection(notes: ConsultationNotes | null | undefined): string {
  if (!notes) return ''
  const lines: string[] = ['Consultation notes (from today\'s visit):']
  if (notes.chiefComplaint) lines.push(`  Chief complaint: ${notes.chiefComplaint}`)
  if (notes.hpi) lines.push(`  HPI: ${notes.hpi}`)
  if (notes.ros) lines.push(`  Review of systems: ${notes.ros}`)
  if (notes.assessment) lines.push(`  Assessment: ${notes.assessment}`)
  if (notes.plan) lines.push(`  Clinical plan: ${notes.plan}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

// ── Helper: build wearable summary section ────────────────────────────────────

function buildWearableSection(summary: WearableSummary | null | undefined): string {
  if (!summary) return ''
  const lines: string[] = ['Wearable data (30-day summary, Oura Ring):']
  if (summary.sleepScore) {
    lines.push(`  Sleep score: avg ${summary.sleepScore.avg}, trend: ${summary.sleepScore.trend}`)
  }
  if (summary.hrv) {
    lines.push(`  HRV: avg ${summary.hrv.avg}ms, trend: ${summary.hrv.trend}`)
  }
  if (summary.readinessScore) {
    lines.push(`  Readiness score: avg ${summary.readinessScore.avg}, trend: ${summary.readinessScore.trend}`)
  }
  if (summary.restingHeartRate) {
    lines.push(`  Resting heart rate: avg ${summary.restingHeartRate.avg}bpm, trend: ${summary.restingHeartRate.trend}`)
  }
  if (summary.temperatureDeviation) {
    lines.push(`  Temperature deviation: avg ${summary.temperatureDeviation.avg > 0 ? '+' : ''}${summary.temperatureDeviation.avg}°C`)
  }
  return lines.length > 1 ? lines.join('\n') : ''
}

// ── Helper: build symptom check-in section ────────────────────────────────────

function buildSymptomScoresSection(scores: SymptomScores | null | undefined): string {
  if (!scores) return ''
  const lines: string[] = ['Pre-visit symptom check-in (patient self-reported, 1=low 5=high):']
  if (scores.vasomotor != null) lines.push(`  Hot flashes/vasomotor: ${scores.vasomotor}/5`)
  if (scores.sleep != null) lines.push(`  Sleep quality: ${scores.sleep}/5`)
  if (scores.energy != null) lines.push(`  Energy & fatigue: ${scores.energy}/5`)
  if (scores.mood != null) lines.push(`  Mood & cognition: ${scores.mood}/5`)
  if (scores.gsm != null) lines.push(`  Genitourinary symptoms: ${scores.gsm}/5`)
  if (scores.overall != null) lines.push(`  Overall quality of life: ${scores.overall}/5`)
  return lines.length > 1 ? lines.join('\n') : ''
}

// ── Helper: build previous visit comparison section ───────────────────────────

function buildPreviousVisitSection(
  previousDeepDives: Record<string, DeepDiveContent> | null | undefined,
  componentKey: string
): string {
  if (!previousDeepDives) return ''
  const prev = previousDeepDives[componentKey]
  if (!prev) return ''
  const lines = ['Previous visit summary for this topic (for comparison):']
  if (prev.lead) lines.push(`  Previous lead: "${prev.lead}"`)
  if (prev.plan?.length) {
    const planSummary = prev.plan.map((p) => `${p.title} (${p.when})`).join(', ')
    lines.push(`  Previous plan: ${planSummary}`)
  }
  return lines.join('\n')
}

// ── Fallback content ──────────────────────────────────────────────────────────

function buildFallback(component: PresentationComponent): DeepDiveContent {
  return {
    lead: component.defaultExplanation,
    dr_card: `This is an area we'll look at closely together. We have a clear path forward.`,
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
  const {
    firstName,
    answers,
    aiBrief,
    consultationNotes,
    wearableSummary,
    previousDeepDives,
    symptomScores,
    isFollowUp,
  } = context

  const domain = findDomain(aiBrief, component.key)

  const systemPrompt = isFollowUp
    ? BASE_SYSTEM_PROMPT + FOLLOW_UP_ADDENDUM
    : BASE_SYSTEM_PROMPT

  // ── Patient context block ──
  const patientSection = firstName ? `Patient first name: ${firstName}` : 'Patient first name: not provided'
  const stageSection = aiBrief?.metadata?.menopausal_stage
    ? `Menopausal stage: ${aiBrief.metadata.menopausal_stage}`
    : 'Menopausal stage: not documented'
  const burdenSection = aiBrief?.metadata?.symptom_burden
    ? `Overall symptom burden: ${aiBrief.metadata.symptom_burden}`
    : 'Overall symptom burden: not documented'
  const complexitySection = aiBrief?.metadata?.complexity
    ? `Clinical complexity: ${aiBrief.metadata.complexity}`
    : ''
  const overviewSection = aiBrief?.symptom_summary?.overview
    ? `Clinical snapshot: ${aiBrief.symptom_summary.overview}`
    : ''

  // ── Treatment pathway block ──
  const approachSection = aiBrief?.treatment_pathway?.recommended_approach
    ? `Recommended treatment approach: ${aiBrief.treatment_pathway.recommended_approach}`
    : ''
  const preferencesSection = aiBrief?.treatment_pathway?.patient_preferences
    ? `Patient treatment preferences: ${aiBrief.treatment_pathway.patient_preferences}`
    : ''
  const optionsLines = (aiBrief?.treatment_pathway?.options ?? [])
    .filter((o) => o.treatment)
    .map((o) => {
      const parts = [`  - ${o.treatment}`]
      if (o.rationale) parts.push(`    Rationale: ${o.rationale}`)
      if (o.considerations) parts.push(`    Considerations: ${o.considerations}`)
      return parts.join('\n')
    })
  const optionsSection = optionsLines.length
    ? `Treatment options being considered:\n${optionsLines.join('\n')}`
    : ''

  // ── Risk flags block ──
  const riskLines: string[] = []
  const urgent = aiBrief?.risk_flags?.urgent?.filter(Boolean) ?? []
  const contraindications = aiBrief?.risk_flags?.contraindications?.filter(Boolean) ?? []
  const considerations = aiBrief?.risk_flags?.considerations?.filter(Boolean) ?? []
  if (urgent.length) riskLines.push(`  Urgent: ${urgent.join('; ')}`)
  if (contraindications.length) riskLines.push(`  Contraindications: ${contraindications.join('; ')}`)
  if (considerations.length) riskLines.push(`  Considerations: ${considerations.join('; ')}`)
  const riskSection = riskLines.length ? `Risk flags:\n${riskLines.join('\n')}` : ''

  // ── Domain-specific findings block ──
  const domainSection = domain
    ? [
        `Domain findings for ${component.label}:`,
        domain.severity ? `  Severity: ${domain.severity}` : '',
        domain.findings ? `  Clinical findings: ${domain.findings}` : '',
        domain.patient_language ? `  Patient's own words: "${domain.patient_language}"` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : `No domain-specific findings available for ${component.label}. Use population-level statistics for perimenopausal/postmenopausal women.`

  const userPrompt = [
    patientSection,
    stageSection,
    burdenSection,
    complexitySection,
    overviewSection,
    approachSection,
    preferencesSection,
    optionsSection,
    riskSection,
    '',
    domainSection,
    '',
    buildIntakeSection(answers, component.key),
    '',
    buildConsultationSection(consultationNotes),
    '',
    buildWearableSection(wearableSummary),
    '',
    buildSymptomScoresSection(symptomScores),
    '',
    buildPreviousVisitSection(previousDeepDives, component.key),
    '',
    `Component: ${component.label}`,
    `Clinical relevance: ${component.clinicalRelevance}`,
    `Default explanation context: ${component.defaultExplanation}`,
    '',
    'Generate the deep dive JSON for this component now.',
  ]
    .filter((line) => line !== undefined && line !== '')
    .join('\n')

  let raw: string
  try {
    raw = await invokeModel({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1024,
    })
  } catch (err) {
    console.error(`[deep-dive] Bedrock call failed for component "${component.key}":`, err)
    return buildFallback(component)
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned) as DeepDiveContent
    if (!parsed.lead || !parsed.dr_quote || !parsed.dr_body || !Array.isArray(parsed.plan)) {
      throw new Error('Missing required fields in parsed response')
    }
    if (!parsed.dr_card) parsed.dr_card = parsed.dr_quote
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
      console.error('[deep-dive] Unexpected rejection in allSettled:', result.reason)
    }
  }

  // Remove duplicate stat values — each stat can only appear once across all components
  const seenStatValues = new Set<string>()
  for (const key of Object.keys(output)) {
    const stat = output[key].stat
    if (stat?.value) {
      const normalized = stat.value.trim().toLowerCase()
      if (seenStatValues.has(normalized)) {
        delete output[key].stat
      } else {
        seenStatValues.add(normalized)
      }
    }
  }

  return output
}
