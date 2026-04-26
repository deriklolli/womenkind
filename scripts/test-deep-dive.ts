/**
 * Local deep dive prompt tester — no database required.
 * Uses AWS Bedrock directly with hardcoded Derik Lolli (test patient) context.
 *
 * Usage:
 *   npx tsx scripts/test-deep-dive.ts
 *
 * Test a single component:
 *   COMPONENT=mood npx tsx scripts/test-deep-dive.ts
 *
 * Test specific components:
 *   COMPONENT=mood,sleep,brain npx tsx scripts/test-deep-dive.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { generateDeepDiveForComponent, type PatientContext } from '../src/lib/deep-dive-generation'
import { getComponent } from '../src/lib/presentation-components'

// ── Derik Lolli test context ──────────────────────────────────────────────────

const ctx: PatientContext = {
  firstName: 'Derik',
  answers: {
    top_concern: 'Night sweats and fatigue are making it hard to function at work.',
    open_notes: "I don't feel like myself. The irritability is affecting my relationships.",
    menstrual: 'Perimenopause',
    hf_freq: '2-3 times per night',
    hf_severity: 'Severe',
    hf_sleep: 'Yes — waking multiple times nightly',
    hf_duration: '20-30 minutes per episode',
    hf_interference: 'Significant interference with work and daily activities',
    sleep_falling: 'No difficulty falling asleep',
    sleep_waking: 'Yes — waking at 3 AM, mind racing',
    wired_tired: 'Yes',
    fatigue: 'Severe afternoon energy crash',
    brain_fog: 'Word-finding difficulty, trouble tracking things at work',
    irritability: 'Yes — disproportionate to stressors, affecting relationships',
    low_mood: 'Feeling disconnected, not depressed but not myself',
    anxiety: 'Mild',
    uterus: 'Intact',
    ovaries: 'Both present',
    lmp: '6 months ago',
    cycle_changes: 'Irregular for 18 months',
    dexa: 'Never',
    parent_hip: 'Yes — mother had hip fracture',
    strength: 'Yes',
    strength_days: '2x/week',
    protein: 'About 60g/day',
    alcohol: 'Occasional (1-2 drinks/week)',
    treatments_tried: 'None',
    tx_openness: 'Open to HRT',
    gsm: 'Mild vaginal dryness',
    vaginal_sev: 'Mild',
    bladder_sev: 'None',
    midsection: 'Yes — noticeable in the past year',
    palpitations: 'None',
    cardio: 'None',
    smoking: 'Never',
    bp_known: 'No',
  },
  aiBrief: {
    metadata: {
      menopausal_stage: 'perimenopause',
      symptom_burden: 'moderate-severe',
      complexity: 'moderate',
    },
    symptom_summary: {
      overview:
        'Patient presents with escalating perimenopause symptoms: severe nocturnal vasomotor events (2-3x nightly), sleep fragmentation, significant cognitive changes, and mood lability. Previously hesitant about HRT; now open to initiating therapy.',
      domains: [
        {
          domain: 'vasomotor',
          severity: 'severe',
          findings: 'Hot flashes 2-3x nightly, 20-30 min duration, significant interference with sleep and work',
          patient_language: 'Night sweats and fatigue are making it hard to function at work.',
        },
        {
          domain: 'sleep',
          severity: 'moderate',
          findings: 'Sleep maintenance insomnia secondary to vasomotor events; 3 AM waking with racing mind',
          patient_language: 'Waking at 3 AM, mind racing after cooling down.',
        },
        {
          domain: 'mood',
          severity: 'moderate',
          findings: 'Irritability disproportionate to stressors, feeling disconnected, not depressed',
          patient_language: "I don't feel like myself. The irritability is affecting my relationships.",
        },
        {
          domain: 'brain',
          severity: 'moderate',
          findings: 'Word-finding difficulty, trouble concentrating at work, brain fog',
          patient_language: 'Brain fog is making it hard to track things at work.',
        },
        {
          domain: 'bone',
          severity: 'low',
          findings: 'No DEXA scan; maternal hip fracture history; perimenopause status warrants baseline',
          patient_language: 'I keep forgetting to get the bone scan done.',
        },
        {
          domain: 'hormonal',
          severity: 'moderate',
          findings: 'Perimenopause, intact uterus and ovaries, irregular cycles 18 months, HRT candidate',
          patient_language: 'Open to HRT after initially being hesitant.',
        },
        {
          domain: 'metabolism',
          severity: 'low',
          findings: 'Midsection weight changes in past year; strength training 2x/week; protein intake suboptimal at 60g',
          patient_language: 'Noticed midsection changes in the past year.',
        },
      ],
    },
    treatment_pathway: {
      recommended_approach: 'Menopausal hormone therapy — combined estrogen-progestogen (uterus intact)',
      options: [
        {
          treatment:
            'Transdermal estradiol 0.05mg/24hr patch (Vivelle-Dot) twice weekly + oral micronized progesterone 100mg QHS',
          rationale:
            'Addresses vasomotor symptoms, sleep fragmentation, cognitive changes; progesterone at bedtime adds mild sedative benefit',
          considerations: 'Monitor for breakthrough bleeding, breast tenderness',
        },
      ],
      patient_preferences: 'Now open to HRT after initially hesitant; prefers minimal daily dosing',
    },
  },
  consultationNotes: {
    chiefComplaint:
      'Worsening night sweats and sleep fragmentation over three weeks, with daytime fatigue and new-onset cognitive changes including brain fog and irritability.',
    hpi: "Patient presents with escalating vasomotor symptoms over the past three weeks, primarily nocturnal: waking 2-3 times per night with intense diaphoresis, requiring 20-30 minutes to return to sleep after cooling. Daytime fatigue is significant, with an afternoon energy nadir. Patient reports mood lability (irritability disproportionate to stressors) and cognitive symptoms including difficulty concentrating and working memory gaps at work. Review of Oura wearable data confirms sleep efficiency decline with fragmented architecture, elevated resting heart rate (avg 68 bpm vs baseline 62 bpm over 14 days), and temperature deviation consistent with vasomotor activity. Patient previously hesitant about HRT; on today's visit she expressed openness to initiating therapy given symptom severity.",
    ros: 'Vasomotor: Positive for hot flashes (primarily nocturnal), night sweats 2-3x nightly, estimated duration 20-30 minutes per episode. Sleep: Positive for sleep maintenance insomnia. Mood: Positive for irritability; denies depressed mood. Cognitive: Positive for brain fog, word-finding difficulty.',
    assessment:
      'Perimenopause with moderate-to-severe vasomotor symptom burden, sleep fragmentation, and associated cognitive changes. Wearable biometrics corroborate symptom severity with objective elevation in resting heart rate and temperature deviation. Bone health surveillance overdue given maternal hip fracture history.',
    plan: '1. Initiate transdermal estradiol 0.05mg/24hr patch, apply twice weekly.\n2. Initiate oral micronized progesterone 100mg PO QHS.\n3. Order DEXA scan.\n4. Follow-up in 6 weeks.',
  },
  wearableSummary: {
    sleepScore: { avg: 68, trend: 'declining' },
    hrv: { avg: 28, trend: 'stable' },
    readinessScore: { avg: 64, trend: 'declining' },
    restingHeartRate: { avg: 68, trend: 'declining' },
    temperatureDeviation: { avg: 0.4 },
  },
  symptomScores: {
    vasomotor: 4,
    sleep: 3,
    energy: 2,
    mood: 3,
    gsm: 2,
    overall: 3,
  },
  isFollowUp: false,
}

// ── Which components to test ──────────────────────────────────────────────────

const ALL_COMPONENTS = [
  'vasomotor', 'sleep', 'mood', 'brain', 'hormonal',
  'bone', 'metabolism', 'cardiovascular', 'gsm', 'skin',
]

const envComponent = process.env.COMPONENT
const components = envComponent
  ? envComponent.split(',').map((s) => s.trim()).filter(Boolean)
  : ALL_COMPONENTS

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nTesting ${components.length} component(s): ${components.join(', ')}\n`)

  for (const component of components) {
    console.log('═'.repeat(60))
    console.log(`▶  ${component.toUpperCase()}`)
    console.log('═'.repeat(60))
    try {
      const comp = getComponent(component)
      if (!comp) { console.error(`  Unknown component key: ${component}`); continue }
      const result = await generateDeepDiveForComponent(comp, ctx)

      console.log('\nLEAD:')
      console.log(result.lead)

      console.log('\nDR_CARD:')
      console.log(result.dr_card)

      console.log('\nDR_QUOTE:')
      console.log(result.dr_quote)

      console.log('\nDR_BODY:')
      console.log(result.dr_body)

      console.log('\nPLAN:')
      result.plan.forEach((p, i) =>
        console.log(`  ${i + 1}. [${p.when}] ${p.title}\n     ${p.detail}`)
      )

      if (result.stat) {
        console.log(`\nSTAT: ${result.stat.value} — ${result.stat.label}`)
      } else {
        console.log('\nSTAT: (none)')
      }
    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}`)
    }
    console.log()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
