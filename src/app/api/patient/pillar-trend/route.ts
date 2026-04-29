import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { visits, prescriptions, wearable_metrics } from '@/lib/db/schema'
import { eq, and, gte, ne, inArray } from 'drizzle-orm'

interface DomainMeta {
  key: string
  name: string
  accent: string
  baseline: number
  current: number
}

interface Milestone {
  wk: number
  type: 'visit' | 'rx' | 'dose' | 'lab'
  short: string
  title: string
  body: string
}

interface TrendData {
  domains: DomainMeta[]
  series: Record<string, (number | null)[]>
  milestones: Milestone[]
}

// All check-in domains with display metadata
const ALL_DOMAIN_META: Record<string, { name: string; accent: string }> = {
  vasomotor: { name: 'Vasomotor',      accent: '#c97c5d' },
  sleep:     { name: 'Sleep',           accent: '#5d9ed5' },
  energy:    { name: 'Energy',          accent: '#e8a838' },
  mood:      { name: 'Mood',            accent: '#7c6bc4' },
  cognition: { name: 'Cognition',       accent: '#6366f1' },
  gsm:       { name: 'Hormonal',        accent: '#c47884' },
  bone:      { name: 'Bone Health',     accent: '#78716c' },
  weight:    { name: 'Metabolism',      accent: '#0891b2' },
  libido:    { name: 'Libido',          accent: '#e879f9' },
  cardio:    { name: 'Cardiovascular',  accent: '#ef4444' },
  overall:   { name: 'Overall',         accent: '#944fed' },
}

const WEEKS = 24
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

function normalizeToDisplay(domain: string, raw: number): number {
  if (domain === 'vasomotor') {
    if (raw === 0 || raw > 5) return Math.max(0, 10 - (raw / 15) * 10)
    return (1 - (raw - 1) / 4) * 10
  }
  if (domain === 'sleep') {
    if (raw > 5) return Math.min(10, (raw / 9) * 10)
    return (1 - (raw - 1) / 4) * 10
  }
  if (domain === 'cardio') {
    if (raw === 0) return 10
    if (raw > 5) return Math.max(0, 10 - (raw / 5) * 10)
    return (1 - (raw - 1) / 4) * 10
  }
  return Math.max(0, Math.min(10, (1 - (raw - 1) / 4) * 10))
}

// DEV FIXTURE ─────────────────────────────────────────────────────────────────
const DEV_RESPONSE: TrendData = {
  domains: [
    { key: 'vasomotor', name: 'Vasomotor',     accent: '#c97c5d', baseline: 3.5, current: 7.2 },
    { key: 'sleep',     name: 'Sleep',          accent: '#5d9ed5', baseline: 5.5, current: 8.1 },
    { key: 'energy',    name: 'Energy',         accent: '#e8a838', baseline: 5.0, current: 7.5 },
    { key: 'mood',      name: 'Mood',           accent: '#7c6bc4', baseline: 5.0, current: 7.7 },
    { key: 'cognition', name: 'Cognition',      accent: '#6366f1', baseline: 4.5, current: 7.1 },
    { key: 'gsm',       name: 'Hormonal',       accent: '#c47884', baseline: 5.0, current: 8.0 },
    { key: 'bone',      name: 'Bone Health',    accent: '#78716c', baseline: 5.5, current: 7.0 },
    { key: 'weight',    name: 'Metabolism',     accent: '#0891b2', baseline: 5.0, current: 6.5 },
    { key: 'libido',    name: 'Libido',         accent: '#e879f9', baseline: 4.5, current: 6.5 },
    { key: 'cardio',    name: 'Cardiovascular', accent: '#ef4444', baseline: 8.0, current: 9.0 },
  ],
  series: {
    vasomotor: [3.5, 4.0, 3.8, 4.2, 4.5, 4.3, 4.8, 5.0, 5.2, 5.5, 5.3, 5.8, 5.7, 6.0, 6.2, 6.1, 6.4, 6.5, 6.7, 6.8, 6.9, 7.0, 7.1, 7.2],
    sleep:     [5.5, 5.5, 6.0, 5.8, 6.2, 6.5, 6.3, 6.7, 6.8, 7.0, 7.0, 7.2, 7.1, 7.3, 7.5, 7.4, 7.6, 7.5, 7.8, 7.7, 7.9, 8.0, 7.8, 8.1],
    energy:    [5.0, 4.8, 5.3, 5.5, 5.4, 5.7, 5.9, 6.0, 6.1, 6.3, 6.2, 6.5, 6.6, 6.7, 6.9, 7.0, 7.0, 7.1, 7.2, 7.3, 7.4, 7.4, 7.5, 7.5],
    mood:      [5.0, 4.8, 5.2, 5.5, 5.3, 5.8, 6.0, 5.9, 6.2, 6.4, 6.3, 6.6, 6.7, 6.8, 7.0, 7.1, 7.0, 7.2, 7.3, 7.4, 7.3, 7.5, 7.6, 7.7],
    cognition: [4.5, 4.3, 4.7, 5.0, 4.8, 5.2, 5.5, 5.3, 5.7, 5.8, 5.9, 6.0, 6.1, 6.2, 6.3, 6.5, 6.4, 6.6, 6.7, 6.7, 6.8, 6.9, 7.0, 7.1],
    gsm:       [5.0, 5.2, 5.5, 5.3, 5.8, 6.0, 5.9, 6.3, 6.5, 6.4, 6.7, 6.8, 7.0, 7.0, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.6, 7.8, 7.9, 8.0],
    bone:      [5.5, 5.6, 5.7, 5.8, 5.9, 6.0, 6.1, 6.2, 6.3, 6.3, 6.4, 6.5, 6.5, 6.6, 6.7, 6.8, 6.8, 6.9, 6.9, 7.0, 7.0, 7.0, 7.0, 7.0],
    weight:    [5.0, 5.1, 5.2, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.0, 6.1, 6.1, 6.2, 6.3, 6.3, 6.4, 6.4, 6.5, 6.5, 6.5, 6.5, 6.5],
    libido:    [4.5, 4.6, 4.7, 4.9, 5.0, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.0, 6.1, 6.2, 6.2, 6.3, 6.4, 6.4, 6.5, 6.5, 6.5, 6.5],
    cardio:    [8.0, 8.1, 8.2, 8.3, 8.4, 8.4, 8.5, 8.5, 8.6, 8.6, 8.7, 8.7, 8.8, 8.8, 8.8, 8.9, 8.9, 8.9, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0],
  },
  milestones: [
    { wk: 0,  type: 'visit', short: 'Visit 1',  title: 'Initial Consultation',        body: 'Met with Dr. Urban to review symptoms, history, and establish a personalized care plan.' },
    { wk: 4,  type: 'rx',   short: 'Estradiol', title: 'Estradiol Patch Started',      body: 'Started transdermal estradiol 0.0375 mg/day to address vasomotor symptoms and sleep disruption.' },
    { wk: 8,  type: 'lab',  short: 'Labs',      title: 'Hormone Panel Drawn',          body: 'Baseline estradiol, FSH, and progesterone levels checked to confirm dosing effectiveness.' },
    { wk: 16, type: 'dose', short: 'Dose +',    title: 'Estradiol Dose Increased',     body: 'Dose adjusted to 0.05 mg/day based on symptom response and hormone panel results.' },
    { wk: 22, type: 'visit', short: 'Visit 2',  title: 'Follow-Up Consultation',       body: 'Reviewed progress across all domains. Vasomotor and sleep show significant improvement.' },
  ],
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json(DEV_RESPONSE)
  }

  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId') ?? (session.role === 'patient' ? session.patientId : null)
  if (!patientId) {
    return NextResponse.json({ error: 'patientId required' }, { status: 400 })
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (WEEKS - 1) * 7)
  startDate.setHours(0, 0, 0, 0)
  const startIso = startDate.toISOString().slice(0, 10)

  // ── Load check-ins + wearable data in parallel ─────────────────────────────
  const [checkins, wearableRows] = await Promise.all([
    db.select({ visit_date: visits.visit_date, symptom_scores: visits.symptom_scores })
      .from(visits).where(and(eq(visits.patient_id, patientId), eq(visits.source, 'daily'), gte(visits.visit_date, startIso))),
    db.select({ metric_type: wearable_metrics.metric_type, metric_date: wearable_metrics.metric_date, value: wearable_metrics.value })
      .from(wearable_metrics).where(and(
        eq(wearable_metrics.patient_id, patientId),
        gte(wearable_metrics.metric_date, startIso),
        inArray(wearable_metrics.metric_type, ['sleep_score', 'readiness_score']),
      )),
  ])

  // ── Build weekly buckets from check-ins ─────────────────────────────────────
  const weeklyBuckets: Record<number, Record<string, number[]>> = {}
  for (let w = 0; w < WEEKS; w++) weeklyBuckets[w] = {}

  for (const ci of checkins) {
    const d = new Date(ci.visit_date + 'T00:00:00')
    const wk = Math.min(WEEKS - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK))
    if (wk < 0) continue
    const scores = ci.symptom_scores as Record<string, number> | null
    if (!scores) continue
    for (const [domain, val] of Object.entries(scores)) {
      if (!weeklyBuckets[wk][domain]) weeklyBuckets[wk][domain] = []
      weeklyBuckets[wk][domain].push(val)
    }
  }

  // ── Build weekly buckets from wearable (sleep_score → sleep, readiness_score → energy) ──
  // Wearable values (0–100) scale directly to display 0–10 (/10)
  const wearableMap: Record<string, string> = { sleep_score: 'sleep', readiness_score: 'energy' }
  for (const row of wearableRows) {
    const domainKey = wearableMap[row.metric_type]
    if (!domainKey) continue
    const d = new Date(row.metric_date + 'T00:00:00')
    const wk = Math.min(WEEKS - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK))
    if (wk < 0) continue
    const displayVal = Math.max(0, Math.min(10, row.value / 10))
    if (!weeklyBuckets[wk][domainKey]) weeklyBuckets[wk][domainKey] = []
    // Wearable data takes priority — store separately and overwrite check-in avg below
    weeklyBuckets[wk][`__wearable_${domainKey}`] = weeklyBuckets[wk][`__wearable_${domainKey}`] ?? []
    weeklyBuckets[wk][`__wearable_${domainKey}`].push(displayVal)
  }

  // ── Build per-domain series ─────────────────────────────────────────────────
  const series: Record<string, (number | null)[]> = {}
  const domainsMeta: DomainMeta[] = []

  for (const [domainKey, meta] of Object.entries(ALL_DOMAIN_META)) {
    const raw: (number | null)[] = Array(WEEKS).fill(null)
    for (let w = 0; w < WEEKS; w++) {
      // Prefer wearable-sourced values for sleep and energy
      const wearableVals = weeklyBuckets[w][`__wearable_${domainKey}`]
      if (wearableVals && wearableVals.length > 0) {
        raw[w] = wearableVals.reduce((a, b) => a + b, 0) / wearableVals.length
        continue
      }
      const vals = weeklyBuckets[w][domainKey]
      if (vals && vals.length > 0) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        raw[w] = normalizeToDisplay(domainKey, avg)
      }
    }
    // Forward-fill then backward-fill for a continuous line
    const filled: (number | null)[] = [...raw]
    let last: number | null = null
    for (let w = 0; w < WEEKS; w++) {
      if (filled[w] !== null) last = filled[w]
      else if (last !== null) filled[w] = last
    }
    last = null
    for (let w = WEEKS - 1; w >= 0; w--) {
      if (filled[w] !== null) last = filled[w]
      else if (last !== null) filled[w] = last
    }
    series[domainKey] = filled
    const nonNull = filled.filter((v): v is number => v !== null)
    domainsMeta.push({
      key: domainKey,
      name: meta.name,
      accent: meta.accent,
      baseline: nonNull[0] ?? 5,
      current: nonNull[nonNull.length - 1] ?? 5,
    })
  }

  // ── Load milestones ─────────────────────────────────────────────────────────
  const [providerVisits, rxList] = await Promise.all([
    db.select({ id: visits.id, visit_date: visits.visit_date, visit_type: visits.visit_type })
      .from(visits).where(and(eq(visits.patient_id, patientId), ne(visits.source, 'daily'), gte(visits.visit_date, startIso))),
    db.select({ medication_name: prescriptions.medication_name, dosage: prescriptions.dosage, prescribed_at: prescriptions.prescribed_at })
      .from(prescriptions).where(and(eq(prescriptions.patient_id, patientId), gte(prescriptions.prescribed_at, startDate))),
  ])

  const milestones: Milestone[] = []

  // Provider visits — deduplicate same visit_date (appointment + note create duplicate rows)
  const seenVisitDates = new Set<string>()
  let visitCount = 0
  for (const v of providerVisits.sort((a, b) => a.visit_date.localeCompare(b.visit_date))) {
    if (seenVisitDates.has(v.visit_date)) continue
    seenVisitDates.add(v.visit_date)
    visitCount++
    const d = new Date(v.visit_date + 'T00:00:00')
    const wk = Math.max(0, Math.min(WEEKS - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK)))
    milestones.push({ wk, type: 'visit', short: `Visit ${visitCount}`, title: `${v.visit_type === 'initial_consultation' ? 'Initial' : 'Follow-Up'} Consultation`, body: 'Care team visit with Dr. Urban.' })
  }

  // Prescriptions — group same-week rxs into one milestone
  const rxByWeek: Record<number, { names: string[]; prescribed_at: Date }> = {}
  for (const rx of rxList) {
    if (!rx.prescribed_at) continue
    const wk = Math.max(0, Math.min(WEEKS - 1, Math.floor((rx.prescribed_at.getTime() - startDate.getTime()) / MS_PER_WEEK)))
    if (!rxByWeek[wk]) rxByWeek[wk] = { names: [], prescribed_at: rx.prescribed_at }
    rxByWeek[wk].names.push(rx.medication_name)
  }
  for (const [wkStr, { names }] of Object.entries(rxByWeek)) {
    const wk = Number(wkStr)
    const label = names.length === 1 ? names[0].split(' ')[0] : 'Rx started'
    const title = names.length === 1 ? `${names[0]} Started` : 'Medications Started'
    const body = names.join(', ')
    milestones.push({ wk, type: 'rx', short: label.slice(0, 10), title, body })
  }

  milestones.sort((a, b) => a.wk - b.wk)

  return NextResponse.json({ domains: domainsMeta, series, milestones } satisfies TrendData)
}
