import { invokeModel } from '@/lib/bedrock'

export async function generateClinicalBrief(answers: Record<string, any>) {
  const patientProfile = buildPatientProfile(answers)

  const text = await invokeModel({
    maxTokens: 8192,
    system: `You are a menopause-specialist clinical intake analyst for Womenkind, a telehealth menopause care platform. Your role is to transform patient intake questionnaire data into a structured, clinically actionable pre-visit brief for the reviewing provider (MD/NP).

Key context:
- Womenkind treats perimenopausal and postmenopausal patients
- The brief is NOT a diagnosis — it is a structured pre-visit summary to save provider time
- Providers are menopause-trained clinicians — use appropriate clinical terminology
- Reference current menopause care guidelines (IMS, NAMS, Menopause Society) where relevant
- Preserve the patient's own words when they add clinical value
- Be specific to THIS patient — never use generic boilerplate`,
    messages: [
      {
        role: 'user',
        content: `Generate a clinical brief for this patient. Return ONLY a JSON object with no markdown wrapping.

PATIENT INTAKE DATA:
${patientProfile}

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
    if (jsonMatch) return JSON.parse(jsonMatch[0])
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
  if (answers.priorities) goals.push(`Health priorities: ${fmt(answers.priorities)}`)
  if (goals.length) sections.push(`PATIENT GOALS:\n${goals.join('\n')}`)

  const repro: string[] = []
  if (answers.uterus) repro.push(`Uterus: ${answers.uterus}`)
  if (answers.ovaries) repro.push(`Ovaries: ${answers.ovaries}`)
  if (answers.menstrual) repro.push(`Menstrual status: ${answers.menstrual}`)
  if (answers.lmp) repro.push(`Last menstrual period: ${answers.lmp}`)
  if (answers.cycle_changes) repro.push(`Cycle changes (past 12 months): ${fmt(answers.cycle_changes)}`)
  if (answers.abnormal_bleeding) repro.push(`Abnormal bleeding: ${fmt(answers.abnormal_bleeding)}`)
  if (repro.length) sections.push(`REPRODUCTIVE HISTORY:\n${repro.join('\n')}`)

  const health: string[] = []
  if (answers.bp_known === 'Yes') {
    health.push(`Blood pressure: ${answers.bp_sys || '?'}/${answers.bp_dia || '?'}`)
  } else if (answers.bp_known) {
    health.push(`Blood pressure: Unknown`)
  }
  if (health.length) sections.push(`HEALTH BASICS:\n${health.join('\n')}`)

  const meds: string[] = []
  if (answers.current_meds) meds.push(`Current medications: ${fmt(answers.current_meds)}`)
  if (answers.meds_detail) meds.push(`Medication details: "${answers.meds_detail}"`)
  if (answers.allergies === 'Yes') {
    meds.push(`Allergies: ${answers.allergy_detail || 'Yes (no details)'}`)
  } else if (answers.allergies) {
    meds.push(`Allergies: None reported`)
  }
  if (answers.peanut) meds.push(`Peanut allergy: ${answers.peanut}`)
  if (meds.length) sections.push(`MEDICATIONS & ALLERGIES:\n${meds.join('\n')}`)

  const hx: string[] = []
  if (answers.cardio) hx.push(`Cardiovascular/clotting: ${fmt(answers.cardio)}`)
  if (answers.smoking) hx.push(`Smoking: ${answers.smoking}`)
  if (answers.cancer) {
    hx.push(`Hormone-sensitive cancer: ${answers.cancer}${answers.cancer_detail ? ` — ${answers.cancer_detail}` : ''}`)
  }
  if (answers.other_conditions) hx.push(`Other conditions: ${fmt(answers.other_conditions)}`)
  if (hx.length) sections.push(`MEDICAL HISTORY:\n${hx.join('\n')}`)

  const vms: string[] = []
  if (answers.hf_freq) vms.push(`Hot flash frequency: ${answers.hf_freq}`)
  if (answers.hf_severity) vms.push(`Hot flash severity: ${answers.hf_severity}`)
  if (answers.hf_sleep) vms.push(`Sleep disruption from VMS: ${answers.hf_sleep}`)
  if (answers.hf_duration) vms.push(`Hot flash duration: ${answers.hf_duration}`)
  if (answers.hf_interference) vms.push(`Daily interference: ${answers.hf_interference}`)
  if (answers.hf_assoc) vms.push(`Associated symptoms: ${fmt(answers.hf_assoc)}`)
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
  if (answers.gsm) gsm.push(`GSM symptoms: ${fmt(answers.gsm)}`)
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
  if (answers.tx_openness) tx.push(`Open to: ${fmt(answers.tx_openness)}`)
  if (answers.dosing_pref) tx.push(`Dosing preference: ${answers.dosing_pref}`)
  if (answers.open_notes) tx.push(`Additional notes (patient's words): "${answers.open_notes}"`)
  if (tx.length) sections.push(`TREATMENT PREFERENCES:\n${tx.join('\n')}`)

  return sections.join('\n\n')
}

function fmt(val: any): string {
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}
