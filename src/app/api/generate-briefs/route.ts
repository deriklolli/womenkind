import { NextRequest, NextResponse } from 'next/server'
import { invokeModel } from '@/lib/bedrock'
import { db } from '@/lib/db'
import { intakes, wearable_metrics } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

/**
 * POST /api/generate-briefs
 * Generates AI clinical briefs for all intakes that don't have one yet.
 * Protected by secret.
 */
export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json()
    const expected = process.env.GENERATE_BRIEFS_SECRET
    if (!expected || !secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { timingSafeEqual } = await import('crypto')
    const secretBuf = Buffer.from(secret)
    const expectedBuf = Buffer.from(expected)
    if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find all submitted intakes without briefs (include patient_id for wearable lookup)
    const allIntakeRows = await db
      .select({
        id: intakes.id,
        patient_id: intakes.patient_id,
        answers: intakes.answers,
        status: intakes.status,
        ai_brief: intakes.ai_brief,
      })
      .from(intakes)
      .where(inArray(intakes.status, ['submitted', 'reviewed']))

    const pendingIntakes = allIntakeRows.filter(r => r.ai_brief === null)

    if (pendingIntakes.length === 0) {
      return NextResponse.json({ message: 'No intakes need briefs', count: 0 })
    }

    const results: { id: string; success: boolean; error?: string }[] = []

    for (const intake of pendingIntakes) {
      try {
        // Fetch any available Oura data for this patient (last 30 days)
        let wearableMetricsList: { metric_type: string; value: number; metric_date: string }[] = []
        if (intake.patient_id) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
          wearableMetricsList = await db
            .select({
              metric_type: wearable_metrics.metric_type,
              value: wearable_metrics.value,
              metric_date: wearable_metrics.metric_date,
            })
            .from(wearable_metrics)
            .where(
              eq(wearable_metrics.patient_id, intake.patient_id)
            )
            .then(rows => rows.filter(r => r.metric_date >= thirtyDaysAgo))
            .then(rows => rows.sort((a, b) => b.metric_date.localeCompare(a.metric_date)))
        }

        const brief = await generateClinicalBrief(intake.answers as Record<string, any>, wearableMetricsList)

        await db
          .update(intakes)
          .set({ ai_brief: brief })
          .where(eq(intakes.id, intake.id))

        results.push({ id: intake.id, success: true })
      } catch (err: any) {
        console.error(`Brief generation failed for intake ${intake.id}:`, err)
        results.push({ id: intake.id, success: false, error: err.message })
      }
    }

    return NextResponse.json({
      message: `Processed ${results.length} intakes`,
      results,
    })
  } catch (err: any) {
    console.error('Generate briefs error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function generateClinicalBrief(
  answers: Record<string, any>,
  wearableMetrics: { metric_type: string; value: number; metric_date: string }[] = []
) {
  const patientProfile = buildPatientProfile(answers)
  const ouraSection = buildOuraProfile(wearableMetrics)

  const text = await invokeModel({
    maxTokens: 4096,
    system: `You are a menopause-specialist clinical intake analyst for Womenkind, a telehealth menopause care platform. Your role is to transform patient intake questionnaire data into a structured, clinically actionable pre-visit brief for the reviewing provider (MD/NP).

Key context:
- Womenkind treats perimenopausal and postmenopausal patients
- The brief is NOT a diagnosis — it is a structured pre-visit summary to save provider time
- Providers are menopause-trained clinicians — use appropriate clinical terminology
- Reference current menopause care guidelines (IMS, NAMS, Menopause Society) where relevant
- Preserve the patient's own words when they add clinical value
- Be specific to THIS patient — never use generic boilerplate

When Oura Ring wearable data is present:
- Use it to OBJECTIVELY CONFIRM or CHALLENGE subjective symptom reports
- Temperature deviation >0.5°C spikes = objective vasomotor events — factor into VMS severity assessment and treatment urgency
- Persistent low HRV (<30ms) + elevated RHR = autonomic burden from VMS — note in risk considerations
- Disrupted sleep architecture (low deep sleep, low REM, low efficiency) = objective sleep impairment — flag in symptom domains and treatment pathway
- Wearable data can escalate or de-escalate treatment pathway recommendations (e.g., frequent temp spikes despite patient minimizing symptoms = stronger HRT case)
- Reference wearable findings explicitly in relevant symptom domains, risk flags, and treatment rationale`,
    messages: [
      {
        role: 'user',
        content: `Generate a clinical brief for this patient. Return ONLY a JSON object with no markdown wrapping.

PATIENT INTAKE DATA:
${patientProfile}
${ouraSection ? `\n${ouraSection}\n` : ''}
Return this exact JSON structure:

{
  "symptom_summary": {
    "overview": "2-3 sentence clinical snapshot of this patient",
    "domains": [
      {
        "domain": "Domain name (e.g., Vasomotor, Mood & Cognition)",
        "severity": "none | mild | moderate | severe",
        "findings": "Specific findings from this patient's data",
        "patient_language": "Direct quotes or paraphrases of patient's own words where relevant"
      }
    ]
  },
  "risk_flags": {
    "urgent": ["Items requiring immediate attention — empty array if none"],
    "contraindications": ["Factors that affect treatment selection"],
    "considerations": ["Non-urgent but clinically relevant factors"]
  },
  "treatment_pathway": {
    "recommended_approach": "Primary treatment direction based on symptom profile + risk factors",
    "options": [
      {
        "treatment": "Specific treatment option",
        "rationale": "Why this fits this patient",
        "considerations": "Risks or monitoring needed for this patient specifically"
      }
    ],
    "patient_preferences": "What the patient indicated about treatment openness and dosing preferences"
  },
  "suggested_questions": [
    {
      "question": "Specific question for the provider to ask",
      "context": "Why this question matters based on the intake data"
    }
  ],
  "metadata": {
    "menopausal_stage": "Pre-menopause | Perimenopause | Post-menopause | Surgical menopause | Uncertain",
    "symptom_burden": "low | moderate | high | severe",
    "complexity": "straightforward | moderate | complex",
    "generated_at": "${new Date().toISOString()}"
  }
}`,
      },
    ],
  })

  try {
    return JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { raw_brief: text }
  }
}

function buildPatientProfile(answers: Record<string, any>): string {
  const sections: string[] = []

  const demo: string[] = []
  if (answers.full_name) demo.push(`Name: ${answers.full_name}`)
  if (answers.dob) demo.push(`DOB: ${answers.dob}`)
  if (answers.height) demo.push(`Height: ${answers.height}`)
  if (answers.weight) demo.push(`Weight: ${answers.weight}`)
  if (demo.length) sections.push(`DEMOGRAPHICS:\n${demo.join('\n')}`)

  const goals: string[] = []
  if (answers.top_concern) goals.push(`Primary concern (patient's words): "${answers.top_concern}"`)
  if (answers.priorities) goals.push(`Health priorities: ${formatAnswer(answers.priorities)}`)
  if (goals.length) sections.push(`PATIENT GOALS:\n${goals.join('\n')}`)

  const repro: string[] = []
  if (answers.uterus) repro.push(`Uterus: ${answers.uterus}`)
  if (answers.ovaries) repro.push(`Ovaries: ${answers.ovaries}`)
  if (answers.menstrual) repro.push(`Menstrual status: ${answers.menstrual}`)
  if (answers.lmp) repro.push(`Last menstrual period: ${answers.lmp}`)
  if (answers.cycle_changes) repro.push(`Cycle changes (past 12 months): ${formatAnswer(answers.cycle_changes)}`)
  if (answers.abnormal_bleeding) repro.push(`Abnormal bleeding: ${formatAnswer(answers.abnormal_bleeding)}`)
  if (repro.length) sections.push(`REPRODUCTIVE HISTORY:\n${repro.join('\n')}`)

  const health: string[] = []
  if (answers.bp_known === 'Yes') {
    health.push(`Blood pressure: ${answers.bp_sys || '?'}/${answers.bp_dia || '?'}`)
  } else if (answers.bp_known) {
    health.push(`Blood pressure: Unknown`)
  }
  if (health.length) sections.push(`HEALTH BASICS:\n${health.join('\n')}`)

  const meds: string[] = []
  if (answers.current_meds) meds.push(`Current medications: ${formatAnswer(answers.current_meds)}`)
  if (answers.meds_detail) meds.push(`Medication details: "${answers.meds_detail}"`)
  if (answers.allergies === 'Yes') {
    meds.push(`Allergies: ${answers.allergy_detail || 'Yes (no details)'}`)
  } else if (answers.allergies) {
    meds.push(`Allergies: None reported`)
  }
  if (answers.peanut) meds.push(`Peanut allergy: ${answers.peanut}`)
  if (meds.length) sections.push(`MEDICATIONS & ALLERGIES:\n${meds.join('\n')}`)

  const hx: string[] = []
  if (answers.cardio) hx.push(`Cardiovascular/clotting: ${formatAnswer(answers.cardio)}`)
  if (answers.smoking) hx.push(`Smoking: ${answers.smoking}`)
  if (answers.cancer) {
    hx.push(`Hormone-sensitive cancer: ${answers.cancer}${answers.cancer_detail ? ` — ${answers.cancer_detail}` : ''}`)
  }
  if (answers.other_conditions) hx.push(`Other conditions: ${formatAnswer(answers.other_conditions)}`)
  if (hx.length) sections.push(`MEDICAL HISTORY:\n${hx.join('\n')}`)

  const vms: string[] = []
  if (answers.hf_freq) vms.push(`Hot flash frequency: ${answers.hf_freq}`)
  if (answers.hf_severity) vms.push(`Hot flash severity: ${answers.hf_severity}`)
  if (answers.hf_sleep) vms.push(`Sleep disruption from VMS: ${answers.hf_sleep}`)
  if (answers.hf_duration) vms.push(`Hot flash duration: ${answers.hf_duration}`)
  if (answers.hf_interference) vms.push(`Daily interference: ${answers.hf_interference}`)
  if (answers.hf_assoc) vms.push(`Associated symptoms: ${formatAnswer(answers.hf_assoc)}`)
  if (vms.length) sections.push(`VASOMOTOR SYMPTOMS:\n${vms.join('\n')}`)

  const mood: string[] = []
  const moodFields = [
    ['palpitations', 'Palpitations'],
    ['joint_pain', 'Joint pain/stiffness'],
    ['sleep_falling', 'Difficulty falling asleep'],
    ['sleep_waking', 'Night waking (3 AM)'],
    ['wired_tired', 'Wired but tired'],
    ['low_mood', 'Low mood/depression'],
    ['irritability', 'Irritability/rage'],
    ['anxiety', 'Anxiety/restlessness'],
    ['brain_fog', 'Brain fog/forgetfulness'],
    ['fatigue', 'Fatigue'],
    ['sexual_change', 'Sexual desire change'],
  ] as const
  for (const [key, label] of moodFields) {
    if (answers[key] && answers[key] !== 'None') mood.push(`${label}: ${answers[key]}`)
  }
  if (mood.length) sections.push(`MOOD, COGNITION & QUALITY OF LIFE:\n${mood.join('\n')}`)

  const gsm: string[] = []
  if (answers.gsm) gsm.push(`GSM symptoms: ${formatAnswer(answers.gsm)}`)
  if (answers.bladder_sev && answers.bladder_sev !== 'None') gsm.push(`Bladder severity: ${answers.bladder_sev}`)
  if (answers.vaginal_sev && answers.vaginal_sev !== 'None') gsm.push(`Vaginal severity: ${answers.vaginal_sev}`)
  if (gsm.length) sections.push(`VAGINAL & BLADDER (GSM):\n${gsm.join('\n')}`)

  const bone: string[] = []
  if (answers.midsection) bone.push(`Midsection weight gain: ${answers.midsection}`)
  if (answers.strength) bone.push(`Strength training: ${answers.strength}${answers.strength_days ? ` (${answers.strength_days} days/week)` : ''}`)
  if (answers.protein) bone.push(`Daily protein: ~${answers.protein}g`)
  if (answers.alcohol) bone.push(`Alcohol: ~${answers.alcohol} drinks/week`)
  if (answers.fracture) bone.push(`Fracture after 40: ${answers.fracture}`)
  if (answers.parent_hip) bone.push(`Parent hip fracture: ${answers.parent_hip}`)
  if (answers.family_osteo) bone.push(`Family osteoporosis: ${answers.family_osteo}`)
  if (answers.dexa) bone.push(`DEXA scan: ${answers.dexa}`)
  if (bone.length) sections.push(`BODY COMPOSITION & BONE HEALTH:\n${bone.join('\n')}`)

  const tx: string[] = []
  if (answers.bc_need) tx.push(`Birth control need: ${answers.bc_need}`)
  if (answers.treatments_tried) tx.push(`Previously tried: "${answers.treatments_tried}"`)
  if (answers.tx_openness) tx.push(`Open to: ${formatAnswer(answers.tx_openness)}`)
  if (answers.dosing_pref) tx.push(`Dosing preference: ${answers.dosing_pref}`)
  if (answers.open_notes) tx.push(`Additional notes (patient's words): "${answers.open_notes}"`)
  if (tx.length) sections.push(`TREATMENT PREFERENCES:\n${tx.join('\n')}`)

  return sections.join('\n\n')
}

function formatAnswer(val: any): string {
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

function buildOuraProfile(
  metrics: { metric_type: string; value: number; metric_date: string }[]
): string {
  if (!metrics || metrics.length === 0) return ''

  // Group by metric type (values are already sorted newest-first)
  const byType: Record<string, number[]> = {}
  for (const m of metrics) {
    if (!byType[m.metric_type]) byType[m.metric_type] = []
    byType[m.metric_type].push(m.value)
  }

  const avg = (vals: number[]) => (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  const recent = (vals: number[]) => vals[0]?.toFixed(1) ?? 'N/A'

  // Clinical labels and what each means for menopause treatment decisions
  const metaMap: Record<string, { label: string; unit: string; clinicalNote: string }> = {
    temperature_deviation:     { label: 'Skin temperature deviation', unit: '°C', clinicalNote: 'Objective VMS proxy: spikes >0.5°C = hot flash/night sweat event' },
    temperature_trend_deviation: { label: 'Temperature trend deviation', unit: '°C', clinicalNote: 'Multi-day vasomotor trend; upward drift = worsening VMS activity' },
    hrv_average:               { label: 'Heart rate variability (HRV)', unit: 'ms', clinicalNote: 'Autonomic health marker; <30ms = significant autonomic burden; often improves with HRT' },
    resting_heart_rate:        { label: 'Resting heart rate', unit: 'bpm', clinicalNote: 'Elevated RHR correlates with estrogen decline and VMS frequency' },
    sleep_score:               { label: 'Sleep quality score', unit: '/100', clinicalNote: '<70 = poor sleep quality; objective measure of sleep impairment' },
    sleep_efficiency:          { label: 'Sleep efficiency', unit: '%', clinicalNote: '<85% = clinically relevant insomnia pattern' },
    sleep_deep_minutes:        { label: 'Deep (N3) sleep', unit: 'min', clinicalNote: 'Reduced deep sleep is classic menopause pattern; progesterone promotes N3' },
    sleep_rem_minutes:         { label: 'REM sleep', unit: 'min', clinicalNote: 'REM disruption correlates with mood instability and cognitive symptoms' },
    sleep_total_minutes:       { label: 'Total sleep duration', unit: 'min', clinicalNote: '' },
    readiness_score:           { label: 'Recovery/readiness score', unit: '/100', clinicalNote: 'Composite physiological load score; <60 = significant burden warranting treatment urgency' },
    respiratory_rate:          { label: 'Respiratory rate', unit: 'br/min', clinicalNote: '' },
  }

  const sections: string[] = []

  // Vasomotor biomarker section
  const vmsMetrics = ['temperature_deviation', 'temperature_trend_deviation']
  const vmsLines: string[] = []
  for (const key of vmsMetrics) {
    const vals = byType[key]
    if (!vals) continue
    const meta = metaMap[key]
    const spikeDays = vals.filter(v => Math.abs(v) > 0.5).length
    const spikeNote = key === 'temperature_deviation' && spikeDays > 0
      ? ` — ${spikeDays}/${vals.length} days with spikes >0.5°C (objective VMS events)`
      : ''
    vmsLines.push(`  ${meta.label}: avg ${avg(vals)}${meta.unit}, recent ${recent(vals)}${meta.unit}${spikeNote}${meta.clinicalNote ? ` [${meta.clinicalNote}]` : ''}`)
  }
  if (vmsLines.length) sections.push(`VASOMOTOR BIOMARKER (Oura, 30-day):\n${vmsLines.join('\n')}`)

  // Sleep architecture section
  const sleepMetrics = ['sleep_score', 'sleep_efficiency', 'sleep_deep_minutes', 'sleep_rem_minutes', 'sleep_total_minutes']
  const sleepLines: string[] = []
  for (const key of sleepMetrics) {
    const vals = byType[key]
    if (!vals) continue
    const meta = metaMap[key]
    sleepLines.push(`  ${meta.label}: avg ${avg(vals)}${meta.unit}, recent ${recent(vals)}${meta.unit}${meta.clinicalNote ? ` [${meta.clinicalNote}]` : ''}`)
  }
  if (sleepLines.length) sections.push(`OBJECTIVE SLEEP ARCHITECTURE (Oura, 30-day):\n${sleepLines.join('\n')}`)

  // Autonomic & cardiovascular
  const autoMetrics = ['hrv_average', 'resting_heart_rate', 'readiness_score', 'respiratory_rate']
  const autoLines: string[] = []
  for (const key of autoMetrics) {
    const vals = byType[key]
    if (!vals) continue
    const meta = metaMap[key]
    autoLines.push(`  ${meta.label}: avg ${avg(vals)}${meta.unit}, recent ${recent(vals)}${meta.unit}${meta.clinicalNote ? ` [${meta.clinicalNote}]` : ''}`)
  }
  if (autoLines.length) sections.push(`AUTONOMIC & CARDIOVASCULAR (Oura, 30-day):\n${autoLines.join('\n')}`)

  if (!sections.length) return ''

  return `OURA RING WEARABLE DATA (objective biometrics, past 30 days):
${sections.join('\n\n')}

Clinical instruction: Use wearable data to confirm/challenge subjective intake responses. Temperature spike frequency informs VMS severity. Sleep architecture data informs sleep symptom severity. HRV/readiness informs treatment urgency.`
}
