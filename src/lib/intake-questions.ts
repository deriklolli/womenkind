// Intake questions — sourced from womenkind-intake-v2.jsx
// Each question has conditional visibility via showIf

export type QuestionType = 'text' | 'date' | 'number' | 'textarea' | 'single' | 'multi'

export interface IntakeQuestion {
  id: string
  sec: string
  type: QuestionType
  label: string
  sub?: string
  ph?: string
  opts?: string[]
  req: boolean
  showIf?: (answers: Record<string, any>) => boolean
}

export const QUESTIONS: IntakeQuestion[] = [
  // ── About you ──
  { id: 'full_name', sec: 'About you', type: 'text', label: 'What is your full legal name?', ph: 'First and last name', req: true, showIf: (a) => !a._authenticated },
  { id: 'dob', sec: 'About you', type: 'date', label: 'Date of birth', req: true },
  { id: 'email', sec: 'About you', type: 'text', label: 'Email address', ph: 'you@example.com', req: true, showIf: (a) => !a._authenticated },
  { id: 'phone', sec: 'About you', type: 'text', label: 'Phone number', ph: '(555) 555-5555', req: true },
  { id: 'height', sec: 'About you', type: 'text', label: 'Height', ph: "e.g. 5'6\"", req: true },
  { id: 'weight', sec: 'About you', type: 'text', label: 'Current weight', ph: 'e.g. 150 lb', req: true },
  { id: 'pcp', sec: 'About you', type: 'text', label: 'Primary care clinician (optional)', ph: 'Name + clinic', req: false },
  { id: 'pharmacy', sec: 'About you', type: 'text', label: 'Preferred pharmacy', ph: 'Name + location', req: true },

  // ── Your goals ──
  { id: 'top_concern', sec: 'Your goals', type: 'textarea', label: 'If you could change one thing about your health right now, what would it be?', ph: 'Describe in your own words...', req: true },
  { id: 'priorities', sec: 'Your goals', type: 'multi', label: 'Top health concerns — select all that apply', opts: ['Energy', 'Weight', 'Mood', 'Sleep', 'Sexual health', 'Brain fog', 'Hot flashes / night sweats', 'Vaginal symptoms', 'Other'], req: true },

  // ── Reproductive history ──
  { id: 'uterus', sec: 'Reproductive history', type: 'single', label: 'Do you still have a uterus?', opts: ['Yes', 'No', 'Unsure'], req: true },
  { id: 'ovaries', sec: 'Reproductive history', type: 'single', label: 'What best describes your ovaries?', opts: ['Both ovaries present', 'One ovary removed', 'Both ovaries removed', 'Unsure'], req: true },
  { id: 'menstrual', sec: 'Reproductive history', type: 'single', label: 'Which best describes your current menstrual status?', opts: ['Regular periods', 'Periods earlier or later than usual', 'Skipped periods', 'No natural period for 12+ months', 'No periods \u2014 hormonal IUD or birth control', 'No periods \u2014 uterine procedure', 'No periods \u2014 hysterectomy', 'No periods \u2014 both ovaries removed'], req: true },
  { id: 'lmp', sec: 'Reproductive history', type: 'date', label: 'First day of last menstrual period (if known)', req: false, showIf: (a) => ['Regular periods', 'Periods earlier or later than usual', 'Skipped periods'].includes(a.menstrual) },
  { id: 'cycle_changes', sec: 'Reproductive history', type: 'multi', label: 'In the past 12 months \u2014 select all that apply', opts: ['Periods came more than a week earlier or later', 'Went 60+ days without a period', 'None of these'], req: true, showIf: (a) => ['Regular periods', 'Periods earlier or later than usual', 'Skipped periods'].includes(a.menstrual) },
  { id: 'abnormal_bleeding', sec: 'Reproductive history', type: 'multi', label: 'Any abnormal bleeding? Select all that apply.', opts: ['Bleeding between periods', 'Bleeding after sex', 'Bleeding after 12 months without periods', 'Periods lasting more than 10 days', 'Soaking a pad in less than 1 hour', 'Large clots', 'Lightheadedness from bleeding', 'None of these'], req: true },

  // ── Health basics ──
  { id: 'bp_known', sec: 'Health basics', type: 'single', label: 'Do you know your most recent blood pressure?', opts: ['Yes', 'No'], req: true },
  { id: 'bp_sys', sec: 'Health basics', type: 'number', label: 'Systolic blood pressure (top number)', ph: 'e.g. 120', req: true, showIf: (a) => a.bp_known === 'Yes' },
  { id: 'bp_dia', sec: 'Health basics', type: 'number', label: 'Diastolic blood pressure (bottom number)', ph: 'e.g. 80', req: true, showIf: (a) => a.bp_known === 'Yes' },

  // ── Medications ──
  { id: 'current_meds', sec: 'Medications', type: 'multi', label: 'Currently using any of the following? Select all that apply.', opts: ['Combined birth control pill', 'Progestin-only pill', 'Hormonal IUD', 'Patch, ring, shot, or implant', 'Estrogen', 'Progesterone or progestin', 'Testosterone', 'Antidepressant / anti-anxiety', 'Thyroid medication', 'Sleep medication', 'GLP-1 or weight medication', 'None of these'], req: true },
  { id: 'meds_detail', sec: 'Medications', type: 'textarea', label: 'List current prescriptions, OTC meds, and supplements.', sub: 'Include dose and frequency. Mention any past hormone use and how it made you feel.', ph: 'e.g. Levothyroxine 50mcg daily. Tried estradiol patch 2022 \u2014 helped with sleep but caused breast tenderness...', req: true },
  { id: 'allergies', sec: 'Medications', type: 'single', label: 'Do you have any medication allergies?', opts: ['Yes', 'No'], req: true },
  { id: 'allergy_detail', sec: 'Medications', type: 'text', label: 'What are you allergic to and what reaction do you have?', ph: 'e.g. Penicillin \u2014 hives', req: true, showIf: (a) => a.allergies === 'Yes' },
  { id: 'peanut', sec: 'Medications', type: 'single', label: 'Are you allergic to peanuts?', sub: 'Relevant for certain compounded hormone formulations.', opts: ['Yes', 'No', 'Unsure'], req: true },

  // ── Medical history ──
  { id: 'cardio', sec: 'Medical history', type: 'multi', label: 'Cardiovascular or clotting history \u2014 select all that apply.', opts: ['High blood pressure', 'Blood clots (DVT/PE)', 'Migraine with aura', 'Heart disease or stroke', 'High cholesterol', 'Diabetes', 'None of these'], req: true },
  { id: 'smoking', sec: 'Medical history', type: 'single', label: 'Smoking status', opts: ['Current', 'Past', 'Never'], req: true },
  { id: 'cancer', sec: 'Medical history', type: 'single', label: 'Have you ever been diagnosed with breast, uterine, ovarian, endometrial, or another hormone-sensitive cancer?', opts: ['No', 'Yes', 'Unsure'], req: true },
  { id: 'cancer_detail', sec: 'Medical history', type: 'text', label: 'What type of cancer and anything important we should know?', ph: 'Type + details', req: false, showIf: (a) => a.cancer === 'Yes' },
  { id: 'other_conditions', sec: 'Medical history', type: 'multi', label: 'Other medical considerations \u2014 select all that apply.', opts: ['Unexplained vaginal bleeding', 'Liver disease', 'Gallbladder disease', 'Seizure disorder', 'Glaucoma', 'Sleep apnea', 'Endometriosis', 'Pregnant now', 'Could become pregnant without contraception', 'None of these'], req: true },

  // ── Vasomotor ──
  { id: 'hf_freq', sec: 'Vasomotor', type: 'single', label: 'On a typical day over the past 2 weeks, how many hot flashes or night sweats in total?', opts: ['0 \u2014 None', '1\u20132 per day', '3\u20135 per day', '6\u201310 per day', 'More than 10 per day'], req: true },
  { id: 'hf_sleep', sec: 'Vasomotor', type: 'single', label: 'How often have hot flashes or night sweats woken you from sleep?', opts: ['0 \u2014 Never', '1\u20132 nights per week', '3\u20134 nights per week', 'Most nights', 'Every night or multiple times'], req: true, showIf: (a) => a.hf_freq && a.hf_freq !== '0 \u2014 None' },
  { id: 'hf_intensity', sec: 'Vasomotor', type: 'single', label: 'How intense are your hot flashes or night sweats?', opts: ['Mild \u2014 noticeable but manageable', 'Moderate \u2014 disruptive but tolerable', 'Severe \u2014 very uncomfortable, interferes with daily life', 'Drenching \u2014 requires clothing or bedding changes'], req: true, showIf: (a) => a.hf_freq && a.hf_freq !== '0 \u2014 None' },
  { id: 'hf_severity', sec: 'Vasomotor', type: 'single', label: 'How severe are your hot flashes or night sweats usually?', opts: ['0 \u2014 Not applicable', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true, showIf: (a) => a.hf_freq && a.hf_freq !== '0 \u2014 None' },
  { id: 'hf_duration', sec: 'Vasomotor', type: 'single', label: 'When a hot flash happens, how long does it usually last?', opts: ['0 \u2014 Not applicable', 'Less than 1 minute', '1\u20133 minutes', '3\u20135 minutes', 'More than 5 minutes'], req: true, showIf: (a) => a.hf_freq && a.hf_freq !== '0 \u2014 None' },
  { id: 'hf_interference', sec: 'Vasomotor', type: 'single', label: 'How much do hot flashes interfere with your day?', opts: ['0 \u2014 Not at all', 'Slightly', 'Moderately', 'Significantly', 'Severely'], req: true, showIf: (a) => a.hf_freq && a.hf_freq !== '0 \u2014 None' },
  { id: 'hf_assoc', sec: 'Vasomotor', type: 'multi', label: 'When a hot flash happens, do any of these also occur?', opts: ['Heart racing or palpitations', 'Sudden anxiety or panic surge', 'Chills after the hot flash', 'Nausea', 'None of these'], req: false, showIf: (a) => a.hf_freq && a.hf_freq !== '0 \u2014 None' },

  // ── Mood & cognition ──
  { id: 'palpitations', sec: 'Mood & cognition', type: 'single', label: 'How much have you been bothered by heart racing, skipped beats, or pounding?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'joint_pain', sec: 'Mood & cognition', type: 'single', label: 'How much have you been bothered by joint pain, muscle aches, or stiffness?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'sleep_falling', sec: 'Mood & cognition', type: 'single', label: 'How much trouble have you had falling asleep?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'sleep_waking', sec: 'Mood & cognition', type: 'single', label: 'How much have you been bothered by waking around 3 AM or struggling to get back to sleep?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'wired_tired', sec: 'Mood & cognition', type: 'single', label: 'How much have you felt \u201cwired but tired\u201d \u2014 exhausted but unable to fully rest?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'snoring', sec: 'Mood & cognition', type: 'single', label: 'Do you snore, or has anyone noticed pauses in your breathing while sleeping?', opts: ['Yes', 'No', 'Not sure'], req: true },
  { id: 'low_mood', sec: 'Mood & cognition', type: 'single', label: 'How much have you been bothered by feeling down, low-motivation, or depressed?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'irritability', sec: 'Mood & cognition', type: 'single', label: 'How much have you been bothered by irritability, a short fuse, or feelings of anger or rage?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'anxiety', sec: 'Mood & cognition', type: 'single', label: 'How much have you been bothered by anxiety, inner restlessness, or panicky feelings?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'brain_fog', sec: 'Mood & cognition', type: 'single', label: 'How much have you been bothered by brain fog, forgetfulness, or trouble finding words?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'fatigue', sec: 'Mood & cognition', type: 'single', label: 'How much have physical or mental exhaustion affected you?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'sexual_change', sec: 'Mood & cognition', type: 'single', label: 'Compared with before symptoms started, how much change have you noticed in sexual desire or satisfaction?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },

  // ── Vaginal & bladder ──
  { id: 'gsm', sec: 'Vaginal & bladder', type: 'multi', label: 'Which of the following apply to you? Select all that apply.', opts: ['Vaginal dryness or burning', 'Pain with sex', 'Frequent UTIs', 'Bladder leakage', 'Urinary urgency or frequency', 'None of these'], req: true },
  { id: 'bladder_sev', sec: 'Vaginal & bladder', type: 'single', label: 'How much have bladder symptoms bothered you \u2014 urgency, frequency, leaking, or difficulty emptying?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },
  { id: 'vaginal_sev', sec: 'Vaginal & bladder', type: 'single', label: 'How much have vaginal dryness, burning, or discomfort bothered you?', opts: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe / debilitating'], req: true },

  // ── Body & bone ──
  { id: 'midsection', sec: 'Body & bone', type: 'single', label: 'Have you noticed new weight gain mainly in your midsection?', opts: ['Yes', 'No', 'Unsure'], req: true },
  { id: 'strength', sec: 'Body & bone', type: 'single', label: 'Do you currently do strength or resistance training?', opts: ['Yes', 'No'], req: true },
  { id: 'strength_days', sec: 'Body & bone', type: 'number', label: 'How many days per week do you strength train?', ph: 'e.g. 3', req: true, showIf: (a) => a.strength === 'Yes' },
  { id: 'protein', sec: 'Body & bone', type: 'number', label: 'About how many grams of protein do you get per day? (optional)', ph: 'e.g. 80', req: false },
  { id: 'alcohol', sec: 'Body & bone', type: 'number', label: 'About how many alcoholic drinks per week? (optional)', ph: 'e.g. 4', req: false },
  { id: 'fracture', sec: 'Body & bone', type: 'single', label: 'Have you had a fracture after age 40 from a fall?', opts: ['Yes', 'No'], req: true },
  { id: 'parent_hip', sec: 'Body & bone', type: 'single', label: 'Did either parent ever break a hip?', opts: ['Yes', 'No', 'Unsure'], req: true },
  { id: 'family_osteo', sec: 'Body & bone', type: 'single', label: 'Has anyone in your family been diagnosed with osteoporosis?', opts: ['Yes', 'No', 'Unsure'], req: true },
  { id: 'dexa', sec: 'Body & bone', type: 'single', label: 'Have you ever had a bone density scan (DEXA)?', opts: ['Never had one', 'Normal', 'Osteopenia', 'Osteoporosis', "Don't know"], req: true },

  // ── Treatment preferences ──
  { id: 'bc_need', sec: 'Treatment preferences', type: 'single', label: 'Current birth control need?', opts: ['Pregnancy prevention still matters', 'It probably matters', 'It does not matter', 'Unsure'], req: true },
  { id: 'treatments_tried', sec: 'Treatment preferences', type: 'textarea', label: 'What treatments have you already tried for these symptoms, and how did they work?', ph: 'e.g. Tried black cohosh for 3 months \u2014 no effect...', req: true },
  { id: 'tx_openness', sec: 'Treatment preferences', type: 'multi', label: 'Which options are you open to discussing?', opts: ['Hormone therapy', 'Non-hormonal prescription options', 'Local vaginal treatment', 'Testosterone if appropriate', 'Lifestyle-only first', 'Not sure yet'], req: true },
  { id: 'dosing_pref', sec: 'Treatment preferences', type: 'single', label: 'Which treatment routine sounds easiest to stick with?', opts: ['Daily', 'Weekly', 'Longer-acting / low-maintenance', 'No preference', 'Unsure'], req: false },
  { id: 'open_notes', sec: 'Treatment preferences', type: 'textarea', label: 'Anything else your clinician should know?', sub: 'Concerns, questions, context about your life \u2014 anything that would help.', ph: 'Your space to share freely...', req: false },
]

export const SECTIONS = [
  'About you',
  'Your goals',
  'Reproductive history',
  'Health basics',
  'Medications',
  'Medical history',
  'Vasomotor',
  'Mood & cognition',
  'Vaginal & bladder',
  'Body & bone',
  'Treatment preferences',
] as const

export type Section = (typeof SECTIONS)[number]

export const SEC_INTROS: Record<string, string> = {
  'Your goals': 'Before we get into symptoms, tell us what matters most to you.',
  'Reproductive history': 'Next, some questions about your reproductive history and cycle.',
  'Health basics': 'A few quick health measurements.',
  'Medications': "Now let\u2019s cover your current medications and any allergies.",
  'Medical history': 'Some important medical history questions.',
  'Vasomotor': "Now we\u2019ll ask about common symptoms over the last 2 weeks.",
  'Mood & cognition': 'Continuing with mood and cognitive symptoms.',
  'Vaginal & bladder': 'Now, vaginal, bladder, and urinary symptoms.',
  'Body & bone': 'Almost done \u2014 body composition and bone health.',
  'Treatment preferences': 'Finally, your treatment preferences.',
}

// Safety framing messages for sensitive sections
export const SAFETY_FRAMES: Record<string, { title: string; message: string }> = {
  'Vaginal & bladder': {
    title: 'A note before we continue',
    message:
      'The next questions ask about vaginal and bladder symptoms. These are extremely common during menopause and nothing to feel embarrassed about. Your answers help your clinician recommend the most effective treatment.',
  },
  'Mood & cognition': {
    title: 'Checking in on how you feel',
    message:
      "Mood changes, sleep disruption, and cognitive shifts are among the most common \u2014 and most under-recognized \u2014 symptoms of hormonal change. There are no wrong answers here. Just be honest about what you\u2019ve been experiencing.",
  },
}

/** Return only questions whose showIf condition (if any) passes */
export function getVisibleQuestions(answers: Record<string, any>): IntakeQuestion[] {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers))
}

/** Get visible questions for a given section */
export function getSectionQuestions(section: string, answers: Record<string, any>): IntakeQuestion[] {
  return getVisibleQuestions(answers).filter((q) => q.sec === section)
}
