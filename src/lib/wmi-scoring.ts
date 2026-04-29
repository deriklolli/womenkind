// WomenKind Menopause Index (WMI) — deterministic scoring engine
// Formulas from WomenKind Master Prompt v13.0, Sections 5-10, 13

export interface WMIScores {
  // Raw domain scores (master prompt ranges)
  vms: number      // 0–20
  sleep: number    // 0–13
  mams: number     // 0–12
  cog: number      // 0–8
  gsm: number      // 0–12
  hsdd: number     // 0–4
  cardio: number   // 0–4
  msk: number      // 0–4
  gaba: number     // 0–16
  se: number       // ~0–20

  // Composite score
  wmi: number      // 0–100, higher = better

  // Phenotype
  phenotype: string

  // Patient-facing interpretation
  wmi_band: '80-90' | '70-79' | '55-69' | '40-54' | '<40'
  wmi_label: string
  wmi_message: string

  // Safety flags
  safety_flags: string[]
  bleeding_band: 'RED' | 'YELLOW' | 'NONE'

  // Data quality
  confidence: 'high' | 'moderate' | 'low'
  missing_fields: string[]
}

// ── String → 0-4 lookup maps ──────────────────────────────────────────────────

const HF_FREQ: Record<string, number> = {
  '0 — None': 0,
  '1–2 per day': 1,
  '3–5 per day': 2,
  '6–10 per day': 3,
  'More than 10 per day': 4,
}
const HF_SLEEP: Record<string, number> = {
  '0 — Never': 0,
  '1–2 nights per week': 1,
  '3–4 nights per week': 2,
  'Most nights': 3,
  'Every night or multiple times': 4,
}
const HF_SEV: Record<string, number> = {
  '0 — Not applicable': 0,
  'Mild': 1,
  'Moderate': 2,
  'Severe': 3,
  'Very severe / debilitating': 4,
}
const HF_DUR: Record<string, number> = {
  '0 — Not applicable': 0,
  'Less than 1 minute': 1,
  '1–3 minutes': 2,
  '3–5 minutes': 3,
  'More than 5 minutes': 4,
}
const HF_INT: Record<string, number> = {
  '0 — Not at all': 0,
  'Slightly': 1,
  'Moderately': 2,
  'Significantly': 3,
  'Severely': 4,
}
const SEV5: Record<string, number> = {
  'None': 0,
  'Mild': 1,
  'Moderate': 2,
  'Severe': 3,
  'Very severe / debilitating': 4,
}

function lookup(map: Record<string, number>, val: unknown): number {
  if (typeof val !== 'string') return 0
  return map[val] ?? 0
}

function isCyclingNow(menstrual: unknown): boolean {
  const cycling = new Set(['Regular periods', 'Periods earlier or later than usual', 'Skipped periods'])
  return typeof menstrual === 'string' && cycling.has(menstrual)
}

function gsmFlagCount(gsm: unknown): number {
  if (!Array.isArray(gsm)) return 0
  const flags = ['Vaginal dryness or burning', 'Pain with sex', 'Frequent UTIs', 'Bladder leakage', 'Urinary urgency or frequency']
  return gsm.filter((v) => flags.includes(v)).length
}

function hasAny(arr: unknown, items: string[]): boolean {
  if (!Array.isArray(arr)) return false
  return items.some((item) => arr.includes(item))
}

// ── Safety screening ──────────────────────────────────────────────────────────

function computeSafetyFlags(a: Record<string, unknown>): { flags: string[]; bleedingBand: 'RED' | 'YELLOW' | 'NONE' } {
  const flags: string[] = []

  if (a.peanut === 'Yes') flags.push('peanut_flag')
  if (a.cancer === 'Yes') flags.push('estrogen_caution_cancer')
  if (hasAny(a.cardio, ['Blood clots (DVT/PE)', 'Migraine with aura', 'Heart disease or stroke'])) {
    flags.push('estrogen_caution_vte')
  }
  if (hasAny(a.other_conditions, ['Liver disease'])) flags.push('liver_flag')
  if (hasAny(a.other_conditions, ['Seizure disorder'])) flags.push('seizure_flag')
  if (a.smoking === 'Current') flags.push('smoking_flag')
  if (hasAny(a.other_conditions, ['Pregnant now'])) flags.push('pregnancy_flag')
  if (hasAny(a.other_conditions, ['Could become pregnant without contraception'])) flags.push('pregnancy_risk_flag')

  // Bleeding band
  const abnormal = Array.isArray(a.abnormal_bleeding) ? a.abnormal_bleeding : []
  const redItems = ['Bleeding after 12 months without periods', 'Soaking a pad in less than 1 hour', 'Large clots', 'Lightheadedness from bleeding']
  const yellowItems = ['Bleeding between periods', 'Bleeding after sex', 'Periods lasting more than 10 days']

  let bleedingBand: 'RED' | 'YELLOW' | 'NONE' = 'NONE'
  if (redItems.some((i) => abnormal.includes(i))) {
    bleedingBand = 'RED'
    flags.push('bleeding_redflag')
  } else if (yellowItems.some((i) => abnormal.includes(i))) {
    bleedingBand = 'YELLOW'
  }

  return { flags, bleedingBand }
}

// ── Phenotype engine (Section 13) ─────────────────────────────────────────────

function computePhenotype(scores: {
  vms: number; mams: number; cog: number; gsm: number; hsdd: number
  msk: number; gaba: number; se: number; sleep: number
}, bleedingBand: 'RED' | 'YELLOW' | 'NONE'): string {
  const { vms, mams, cog, gsm, hsdd, msk, gaba, se, sleep } = scores

  if (bleedingBand === 'RED') return 'Bleeding / Floodgate'

  const phenotypes: string[] = []

  if (se >= 11 && (mams >= 8 || cog >= 5)) phenotypes.push('SE-dominant')
  if (gaba >= 9 && se < 11 && sleep >= 5) phenotypes.push('GABA-dominant')
  if (vms >= 10 && se < 11 && gaba < 9) phenotypes.push('VMS-dominant')
  if (gsm >= 5 && phenotypes.length === 0) phenotypes.push('GSM-dominant')
  if (hsdd >= 3 && phenotypes.length === 0) phenotypes.push('Sexual health')
  if (msk >= 3 && phenotypes.length === 0) phenotypes.push('MSK-forward')

  // Mixed
  if (se >= 11 && vms >= 10 && !phenotypes.includes('VMS-dominant')) phenotypes.push('VMS')
  if (se >= 11 && gsm >= 5) { if (!phenotypes.includes('GSM-dominant')) phenotypes.push('GSM') }
  if (vms >= 8 && gsm >= 5 && !phenotypes.some(p => p.startsWith('VMS'))) phenotypes.push('VMS + GSM')

  return phenotypes.length > 0 ? phenotypes.join(' + ') : 'Mixed / multisystem'
}

// ── WMI band interpretation ───────────────────────────────────────────────────

function wmiInterpretation(wmi: number): { band: WMIScores['wmi_band']; label: string; message: string } {
  if (wmi >= 80) return {
    band: '80-90',
    label: 'Stable / Optimized',
    message: 'Your system is showing strong stability. The goal now is to protect this rhythm.',
  }
  if (wmi >= 70) return {
    band: '70-79',
    label: 'Improving / Mild Strain',
    message: 'Your system is responding. We are refining, not starting over.',
  }
  if (wmi >= 55) return {
    band: '55-69',
    label: 'Active Rebuild Zone',
    message: 'Your body is under meaningful strain, but this is exactly the zone where structured treatment can create visible progress.',
  }
  if (wmi >= 40) return {
    band: '40-54',
    label: 'Stabilization Priority',
    message: 'Your symptoms are real and significant. The first goal is stabilization — sleep, temperature, mood, and safety.',
  }
  return {
    band: '<40',
    label: 'High Support Zone',
    message: 'This score tells us your system needs more support, not that you are failing. We will simplify, stabilize, and escalate care appropriately.',
  }
}

// ── Confidence assessment ─────────────────────────────────────────────────────

function computeConfidence(a: Record<string, unknown>): { confidence: 'high' | 'moderate' | 'low'; missing: string[] } {
  const required = ['hf_freq', 'sleep_falling', 'sleep_waking', 'low_mood', 'anxiety', 'brain_fog', 'fatigue']
  const missing = required.filter((f) => !a[f])

  const hasLabs = a.bp_sys || a.bp_dia
  const hasBp = !!(a.bp_sys && a.bp_dia)

  if (missing.length === 0 && hasBp) return { confidence: 'high', missing }
  if (missing.length <= 2) return { confidence: 'moderate', missing }
  return { confidence: 'low', missing }
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function computeWMI(answers: Record<string, unknown>): WMIScores {
  const a = answers

  // Q14a-e: VMS components
  const q14a = lookup(HF_FREQ, a.hf_freq)
  const q14b = lookup(HF_SLEEP, a.hf_sleep)
  const q14c = lookup(HF_SEV, a.hf_severity)
  const q14d = lookup(HF_DUR, a.hf_duration)
  const q14e = lookup(HF_INT, a.hf_interference)

  // Q15-Q24, Q26
  const q15 = lookup(SEV5, a.palpitations)
  const q16 = lookup(SEV5, a.joint_pain)
  const q17 = lookup(SEV5, a.sleep_falling)
  const q18 = lookup(SEV5, a.sleep_waking)
  const q19 = lookup(SEV5, a.wired_tired)
  const q20 = lookup(SEV5, a.low_mood)
  const q21 = lookup(SEV5, a.irritability)
  const q22 = lookup(SEV5, a.anxiety)
  const q23 = lookup(SEV5, a.brain_fog)
  const q24 = lookup(SEV5, a.fatigue)
  const q26 = lookup(SEV5, a.sexual_change)

  // Q27: GSM flags (multi-select count)
  const q27FlagCount = gsmFlagCount(a.gsm)

  // Q28-Q29: bladder/vaginal severity
  const q28 = lookup(SEV5, a.bladder_sev)
  const q29 = lookup(SEV5, a.vaginal_sev)

  // ── Domain scores ──
  const vms   = q14a + q14b + q14c + q14d + q14e                         // 0–20
  const sleep  = q17 + q18 + q19 + (q14b >= 2 ? 1 : 0)                  // 0–13
  const mams   = q20 + q21 + q22                                          // 0–12
  const cog    = q23 + q24                                                 // 0–8
  const gsm    = Math.min(12, q28 + q29 + q27FlagCount)                   // 0–12
  const hsdd   = q26                                                       // 0–4
  const cardio = q15                                                       // 0–4
  const msk    = q16                                                       // 0–4
  const gaba   = q17 + q18 + q19 + q22                                    // 0–16
  const se     = (vms / 2) + q20 + q21 + q23 + q24                       // ~0–20

  // ── WMI penalties (base 90, weights sum 60) ──
  const vmsP    = 12 * (vms / 20)
  const sleepP  = 12 * (sleep / 13)
  const mamsP   = 10 * (mams / 12)
  const cogP    = 7  * (cog / 8)
  const gsmP    = 7  * (gsm / 12)
  const hsddP   = 4  * (hsdd / 4)
  const mskP    = 4  * (msk / 4)
  const cardioP = 4  * (cardio / 4)

  const rawWmi = 90 - vmsP - sleepP - mamsP - cogP - gsmP - hsddP - mskP - cardioP
  const wmi = Math.round(Math.max(0, Math.min(90, rawWmi)))

  // ── Safety & bleeding ──
  const { flags: safety_flags, bleedingBand: bleeding_band } = computeSafetyFlags(a)

  // ── Phenotype ──
  const phenotype = computePhenotype({ vms, mams, cog, gsm, hsdd, msk, gaba, se, sleep }, bleeding_band)

  // ── Interpretation ──
  const { band: wmi_band, label: wmi_label, message: wmi_message } = wmiInterpretation(wmi)

  // ── Confidence ──
  const { confidence, missing: missing_fields } = computeConfidence(a)

  return {
    vms, sleep, mams, cog, gsm, hsdd, cardio, msk, gaba, se,
    wmi,
    phenotype,
    wmi_band,
    wmi_label,
    wmi_message,
    safety_flags,
    bleeding_band,
    confidence,
    missing_fields,
  }
}

// ── Live WMI from weekly check-ins + wearables ───────────────────────────────

export function computeLiveWMI(
  visits: Array<{ symptom_scores: Record<string, number> | null; visit_date: string; source?: string | null }>,
  wearableMetrics?: Array<{ metric_type: string; value: number; metric_date: string }>
): number | null {
  const recent = visits
    .filter((v) => v.source === 'daily' && v.symptom_scores)
    .sort((a, b) => b.visit_date.localeCompare(a.visit_date))
    .slice(0, 1)

  // Build wearable metric averager (last 14 days to cover up to 2 weekly cycles)
  const cutoffStr = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    return d.toISOString().slice(0, 10)
  })()

  const metricAvg = (type: string): number | null => {
    if (!wearableMetrics || wearableMetrics.length === 0) return null
    const vals = wearableMetrics
      .filter((m) => m.metric_type === type && m.metric_date >= cutoffStr)
      .map((m) => m.value)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const wearableSleep    = metricAvg('sleep_score')
  const wearableActivity = metricAvg('activity_score') ?? metricAvg('hrv_average')

  // Require at least 1 weekly check-in
  if (recent.length < 1) return null

  // Read each domain from the single most-recent weekly check-in
  const avg = (key: string, fallback = 1) => {
    const vals = recent.map((v) => v.symptom_scores?.[key]).filter((n): n is number => typeof n === 'number')
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : fallback
  }

  // ── Vasomotor: detect format ──
  // New format: count 0–20 (any value of 0 or >5 means count)
  // Legacy format: 1–5 burden slider
  const vmsVals = recent.map((v) => v.symptom_scores?.vasomotor).filter((n): n is number => n !== undefined)
  const vmsIsCount = vmsVals.some((v) => v === 0 || v > 5)
  const aVms = avg('vasomotor')
  const vmsNorm = vmsIsCount
    ? Math.min(aVms, 15) / 15            // count: 0=no burden, 15+=max burden
    : (aVms - 1) / 4                     // legacy: 1–5 burden

  // ── Sleep: from wearable if available, else detect check-in format ──
  let sleepP: number
  if (wearableSleep !== null) {
    // sleep_score 85+ = no penalty, 70 = moderate, <70 = significant
    sleepP = 12 * Math.max(0, Math.min(1, (85 - wearableSleep) / 85))
  } else {
    const sleepVals = recent.map((v) => v.symptom_scores?.sleep).filter((n): n is number => n !== undefined)
    const sleepIsHours = sleepVals.some((v) => v > 5)
    const aSleep = avg('sleep', 7)
    if (sleepIsHours) {
      // Hours format: 7+ hrs = no burden, 0 hrs = full burden
      sleepP = 12 * Math.max(0, Math.min(1, (7 - aSleep) / 7))
    } else {
      // Legacy 1–5 burden
      sleepP = 12 * ((aSleep - 1) / 4)
    }
  }

  // ── Energy: from wearable if available, else check-in 1–5 ──
  let energyNorm: number
  if (wearableActivity !== null) {
    // activity_score: 70+ = good energy, below = burden
    energyNorm = Math.max(0, Math.min(1, (70 - wearableActivity) / 70))
  } else {
    energyNorm = (avg('energy') - 1) / 4
  }

  // ── Cardio: detect format ──
  // New: count 0–N (0 = no episodes), Legacy: 1–5 burden
  const cardioVals = recent.map((v) => v.symptom_scores?.cardio).filter((n): n is number => n !== undefined)
  const cardioIsCount = cardioVals.some((v) => v === 0)
  const aCardio = avg('cardio')
  const cardioNorm = cardioIsCount
    ? Math.min(aCardio, 5) / 5           // count: 0=none, 5+=max burden
    : (aCardio - 1) / 4                  // legacy: 1–5 burden

  // ── Remaining 1–5 domains (unchanged format) ──
  const aMood   = avg('mood')
  const aCog    = avg('cognition')
  const aGsm    = avg('gsm')
  const aLibido = avg('libido')
  const aBone   = avg('bone')

  // ── WMI equivalents ──
  const vms_eq    = vmsNorm * 20
  const mams_eq   = ((aMood - 1) / 4) * 12
  const cogNorm   = (aCog - 1) / 4
  const cog_eq    = ((cogNorm + energyNorm) / 2) * 8
  const gsm_eq    = ((aGsm - 1) / 4) * 12
  const hsdd_eq   = ((aLibido - 1) / 4) * 4
  const cardio_eq = cardioNorm * 4
  const msk_eq    = ((aBone - 1) / 4) * 4

  // ── Penalties (base 90, weights sum 60) ──
  let vmsP      = 12 * (vms_eq / 20)
  const mamsP   = 10 * (mams_eq / 12)
  const cogP    = 7  * (cog_eq / 8)
  const gsmP    = 7  * (gsm_eq / 12)
  const hsddP   = 4  * (hsdd_eq / 4)
  const mskP    = 4  * (msk_eq / 4)
  const cardioP = 4  * (cardio_eq / 4)

  // ── Oura temperature modifier on VMS penalty ──
  const tempDev = metricAvg('temperature_deviation')
  if (tempDev !== null && tempDev > 0.3) {
    vmsP += Math.min(3, (tempDev - 0.3) * 4)
  }

  const rawLive = 90 - vmsP - sleepP - mamsP - cogP - gsmP - hsddP - mskP - cardioP
  return Math.round(Math.max(0, Math.min(90, rawLive)))
}

// ── Domain display helpers ────────────────────────────────────────────────────

// Normalize a domain raw score to 0-100 for display
export function domainToPercent(domain: keyof Pick<WMIScores, 'vms' | 'sleep' | 'mams' | 'cog' | 'gsm' | 'hsdd' | 'cardio' | 'msk'>, score: number): number {
  const maxes = { vms: 20, sleep: 13, mams: 12, cog: 8, gsm: 12, hsdd: 4, cardio: 4, msk: 4 }
  const max = maxes[domain]
  // Higher raw = more burden = lower display score (invert so 100 = best)
  return Math.round(100 - (score / max) * 100)
}
