import { invokeModel } from '@/lib/bedrock'

export async function generateClinicalBrief(answers: Record<string, any>, wmiScores?: any) {
  const patientProfile = buildPatientProfile(answers, wmiScores)

  const text = await invokeModel({
    maxTokens: 8192,
    system: `You are the clinical AI engine for Womenkind, a menopause-specialist telehealth platform. You generate the MD Command Center — a comprehensive pre-visit clinical brief for the reviewing provider (MD/NP/APRN).

CLINICAL FRAMEWORK
You apply the WomenKind Menopause Index (WMI) framework. WMI scores (0–100, higher = better) are provided pre-computed from intake data. Your role is clinical interpretation and narrative — the math is already done.

PHENOTYPE SYSTEM
Assign one phenotype from the patient's dominant symptom cluster:
- VMS-dominant: Hot flash/sweat burden drives quality-of-life impairment (VMS ≥ 14/20, SE < 11)
- SE-dominant (Sympathetic Excess): Anxiety, irritability, brain fog, fatigue, palpitations cluster (SE ≥ 11, MAMS ≥ 8 or COG ≥ 5)
- GABA-dominant: Sleep-onset/maintenance disorder with minimal daytime VMS (GABA ≥ 10, VMS < 6)
- GSM-dominant: Genitourinary symptoms dominate, minimal systemic symptoms (GSM ≥ 8)
- Mixed: Two or more domains co-dominant — name both (e.g., "VMS + SE")
- Complex: Three or more domains simultaneously severe

SAFETY DECISION TREE — apply before any treatment recommendation:
1. Peanut allergy → flag: avoid peanut-oil based products (some progesterone formulations, Luvena)
2. Hormone-sensitive cancer (breast, uterine, ovarian) → estrogen BLOCK; note if oncologist clearance required
3. Active/recent VTE, DVT, PE, or hypercoagulable state → transdermal-only or no systemic estrogen; oral estrogen contraindicated
4. Active liver disease → no oral estrogen; transdermal acceptable
5. Undiagnosed/abnormal uterine bleeding → WORKUP REQUIRED before initiating HRT; flag as bleeding_redflag
6. Current smoker → prefer transdermal over oral; increased VTE/CVD risk with oral
7. Migraine with aura → transdermal preferred; oral estrogen may increase stroke risk

TREATMENT ALGORITHM (apply after safety tree):
- Systemic HRT first-line for VMS-dominant + eligible: Estradiol patch 0.025–0.1mg/day or gel 0.5–1g/day. Add progestogen if uterus intact (micronized progesterone 100–200mg/night preferred — fewer side effects than synthetic progestins).
- GSM-only or adjunct: Vaginal estradiol (Estrace cream 0.5g 2–3x/week, or Imvexxy 4–10mcg insert). Ospemifene 60mg/day for dyspareunia if systemic estrogen declined. Vaginal DHEA (Intrarosa) option.
- GABA-dominant/sleep-primary: Magnesium glycinate 300–400mg/night; consider low-dose trazodone 25–50mg; melatonin 0.5–3mg. Evaluate sleep apnea if wired-tired pattern prominent.
- SE-dominant adjunct: Low-dose SSRI (escitalopram 5–10mg) or SNRI (venlafaxine 37.5–75mg) if HRT declined/contraindicated, or as adjunct.
- Non-hormonal VMS alternatives: Fezolinetant (Veozah) 45mg/day — NK3 receptor antagonist, non-hormonal, effective for VMS if HRT declined.
- Bone protection: If fracture risk elevated — calcium 1200mg/day, vitamin D3 2000IU/day, weight-bearing exercise. DEXA if not done in past 2 years for postmenopausal or perimenopausal >50.

SOAP NOTE FORMAT (clinical standard):
- S (Subjective): Chief complaint in patient's words, symptom duration and trajectory, functional impact on work/relationships/sleep, patient's stated priorities and treatment concerns
- O (Objective): BMI, BP if known, reproductive status, current medications, WMI score and band, domain score summary
- A (Assessment): Menopausal stage, phenotype, WMI interpretation, risk stratification, key safety flags
- P (Plan): Specific treatment recommendation(s) with drug/dose/route/frequency, monitoring parameters, labs to order, follow-up interval, patient education points

PATIENT BLUEPRINT (patient-facing, Womenkind voice):
Write warm, plain-language explanations. No jargon. Validate the patient's experience before explaining it. Use "you" not "the patient." Womenkind tone is: clear, warm, evidence-grounded, never alarmist.

OUTPUT RULES:
- Return ONLY a valid JSON object, no markdown, no code fences
- Be specific to THIS patient — never use generic boilerplate
- Providers are menopause-trained clinicians — use appropriate clinical terminology in provider sections
- Preserve patient's own words (quoted) when they add clinical value
- The brief is NOT a diagnosis — it is a pre-visit summary for provider review`,
    messages: [
      {
        role: 'user',
        content: `Generate the MD Command Center brief for this patient. Return ONLY a JSON object.

PATIENT INTAKE DATA:
${patientProfile}

Return this exact JSON structure:

{
  "md_command": {
    "phenotype": "Phenotype label from the framework",
    "wmi_interpretation": "2-3 sentence clinical interpretation of this patient's WMI score and what it means for treatment urgency",
    "safety_decision": {
      "hrt_eligible": true,
      "contraindications": ["List specific contraindications — empty array if none"],
      "cautions": ["List cautions requiring monitoring — empty if none"],
      "flags": ["bleeding_redflag | peanut_flag | vte_flag | cancer_flag | liver_flag | smoking_flag — only include applicable"]
    },
    "treatment_options": [
      {
        "rank": 1,
        "therapy": "Specific drug name + dose + route",
        "rationale": "Why this fits this patient specifically",
        "monitoring": "What to watch and when"
      }
    ],
    "labs_to_order": ["Specific lab with rationale — e.g., TSH (rule out thyroid contribution to fatigue/mood)"],
    "follow_up": "Recommended follow-up interval and what to assess"
  },
  "soap_note": {
    "subjective": "Narrative S section using patient's words and reported symptoms",
    "objective": "BMI, BP, reproductive status, medications, WMI score and domain summary",
    "assessment": "Menopausal stage, phenotype, risk stratification, key clinical decision points",
    "plan": "Specific treatment plan with drug/dose/route, monitoring, labs, follow-up, patient education"
  },
  "symptom_summary": {
    "overview": "2-3 sentence clinical snapshot",
    "domains": [
      {
        "domain": "Domain name",
        "severity": "none | mild | moderate | severe",
        "findings": "Specific findings from this patient's data",
        "patient_language": "Patient's own words if available"
      }
    ]
  },
  "risk_flags": {
    "urgent": ["Items requiring immediate attention — empty array if none"],
    "contraindications": ["Factors that affect treatment selection"],
    "considerations": ["Non-urgent but clinically relevant factors"]
  },
  "treatment_pathway": {
    "recommended_approach": "Primary treatment direction",
    "options": [
      {
        "treatment": "Specific treatment",
        "rationale": "Why this fits this patient",
        "considerations": "Risks or monitoring needed"
      }
    ],
    "patient_preferences": "What the patient indicated about treatment openness"
  },
  "suggested_questions": [
    {
      "question": "Specific question for the provider to ask",
      "context": "Why this question matters based on the intake data"
    }
  ],
  "patient_blueprint": {
    "overview": "2-3 sentence warm summary for the patient explaining their results",
    "domains": [
      {
        "domain": "Domain name",
        "explanation": "Plain-language explanation of what's happening in this domain for this patient",
        "what_helps": "What treatment/lifestyle change addresses this domain"
      }
    ],
    "next_step": "One clear next step in Womenkind's voice"
  },
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

function buildPatientProfile(answers: Record<string, any>, wmiScores?: any): string {
  const sections: string[] = []

  // WMI scores context (pre-computed, passed to Bedrock for interpretation)
  if (wmiScores) {
    sections.push(`WMI SCORES (pre-computed deterministically):
WMI: ${wmiScores.wmi}/100 — ${wmiScores.wmi_label}
Phenotype signal: ${wmiScores.phenotype}
Domain scores: VMS=${wmiScores.vms}/20, SLEEP=${wmiScores.sleep}/13, MAMS=${wmiScores.mams}/12, COG=${wmiScores.cog}/8, GSM=${wmiScores.gsm}/12, HSDD=${wmiScores.hsdd}/4, CARDIO=${wmiScores.cardio}/4, MSK=${wmiScores.msk}/4
Safety flags from scoring: ${wmiScores.safety_flags?.length ? wmiScores.safety_flags.join(', ') : 'none'}
Bleeding band: ${wmiScores.bleeding_band || 'NONE'}`)
  }

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
