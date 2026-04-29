import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { visits, prescriptions, wearable_metrics } from '@/lib/db/schema'
import { eq, and, gte, ne, inArray, asc } from 'drizzle-orm'

interface DomainMeta {
  key: string
  name: string
  accent: string
  baseline: number
  current: number
  rawScale?: number       // present for domains that plot raw values (not normalized 0–10)
  lowerIsBetter?: boolean // true when a lower raw value means improvement
}

interface Milestone {
  wk: number
  type: 'visit' | 'rx' | 'dose' | 'lab'
  short: string
  title: string
  body: string
}

interface TrendData {
  weeks: number
  domains: DomainMeta[]
  series: Record<string, (number | null)[]>
  seriesRaw: Record<string, (number | null)[]>
  wearableSeries: Record<string, (number | null)[]>
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

const MAX_WEEKS = 104
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
  weeks: 24,
  wearableSeries: {
    sleep: [null, null, null, null, 6.2, 6.8, 6.5, 7.1, 7.3, 7.2, 7.5, 7.4, 7.6, 7.8, 7.7, 7.9, 7.8, 8.0, 8.1, 8.0, 8.2, 8.3, 8.1, 8.4],
    energy: [null, null, null, null, 5.5, 5.9, 6.1, 6.3, 6.4, 6.6, 6.5, 6.8, 6.9, 7.0, 7.2, 7.3, 7.2, 7.4, 7.5, 7.5, 7.6, 7.6, 7.7, 7.7],
  },
  domains: [
    { key: 'vasomotor', name: 'Vasomotor', accent: '#c97c5d', baseline: 12, current: 3, rawScale: 20, lowerIsBetter: true },
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
    vasomotor: [12, 11, 13, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3],
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
  seriesRaw: {
    vasomotor: [12, 11, 13, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3],
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

  // ── Find earliest data date to anchor the window ───────────────────────────
  const [firstCheckin, firstVisit, firstRx] = await Promise.all([
    db.select({ d: visits.visit_date }).from(visits)
      .where(and(eq(visits.patient_id, patientId), eq(visits.source, 'daily')))
      .orderBy(asc(visits.visit_date)).limit(1),
    db.select({ d: visits.visit_date }).from(visits)
      .where(and(eq(visits.patient_id, patientId), ne(visits.source, 'daily')))
      .orderBy(asc(visits.visit_date)).limit(1),
    db.select({ d: prescriptions.prescribed_at }).from(prescriptions)
      .where(eq(prescriptions.patient_id, patientId))
      .orderBy(asc(prescriptions.prescribed_at)).limit(1),
  ])

  const candidates: Date[] = [
    firstCheckin[0]?.d ? new Date(firstCheckin[0].d + 'T00:00:00') : null,
    firstVisit[0]?.d ? new Date(firstVisit[0].d + 'T00:00:00') : null,
    firstRx[0]?.d ?? null,
  ].filter((d): d is Date => d !== null)

  // Default to 4 weeks ago if no data exists yet
  const earliest = candidates.length > 0
    ? new Date(Math.min(...candidates.map(d => d.getTime())))
    : (() => { const d = new Date(); d.setDate(d.getDate() - 27); return d })()

  // Anchor to Monday of that week
  const startDate = new Date(earliest)
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - ((dayOfWeek + 6) % 7))
  startDate.setHours(0, 0, 0, 0)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const actualWeeks = Math.min(MAX_WEEKS, Math.max(4, Math.ceil((today.getTime() - startDate.getTime()) / MS_PER_WEEK) + 1))
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

  // ── Build weekly check-in buckets ───────────────────────────────────────────
  const weeklyBuckets: Record<number, Record<string, number[]>> = {}
  for (let w = 0; w < actualWeeks; w++) weeklyBuckets[w] = {}

  for (const ci of checkins) {
    const d = new Date(ci.visit_date + 'T00:00:00')
    const wk = Math.min(actualWeeks - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK))
    if (wk < 0) continue
    const scores = ci.symptom_scores as Record<string, number> | null
    if (!scores) continue
    for (const [domain, val] of Object.entries(scores)) {
      if (!weeklyBuckets[wk][domain]) weeklyBuckets[wk][domain] = []
      weeklyBuckets[wk][domain].push(val)
    }
  }

  // ── Build wearable buckets separately (sleep_score → sleep, readiness_score → energy) ──
  const wearableMap: Record<string, string> = { sleep_score: 'sleep', readiness_score: 'energy' }
  const wearableBuckets: Record<number, Record<string, number[]>> = {}
  for (let w = 0; w < actualWeeks; w++) wearableBuckets[w] = {}

  for (const row of wearableRows) {
    const domainKey = wearableMap[row.metric_type]
    if (!domainKey) continue
    const d = new Date(row.metric_date + 'T00:00:00')
    const wk = Math.min(actualWeeks - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK))
    if (wk < 0) continue
    if (!wearableBuckets[wk][domainKey]) wearableBuckets[wk][domainKey] = []
    wearableBuckets[wk][domainKey].push(Math.max(0, Math.min(10, row.value / 10)))
  }

  // ── Build per-domain check-in series ────────────────────────────────────────
  const series: Record<string, (number | null)[]> = {}
  const seriesRaw: Record<string, (number | null)[]> = {}
  const domainsMeta: DomainMeta[] = []

  for (const [domainKey, meta] of Object.entries(ALL_DOMAIN_META)) {
    const raw: (number | null)[] = Array(actualWeeks).fill(null)
    for (let w = 0; w < actualWeeks; w++) {
      const vals = weeklyBuckets[w][domainKey]
      if (vals && vals.length > 0) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        raw[w] = domainKey === 'vasomotor' ? avg : normalizeToDisplay(domainKey, avg)
      }
    }
    seriesRaw[domainKey] = [...raw]
    const filled: (number | null)[] = [...raw]
    let last: number | null = null
    for (let w = 0; w < actualWeeks; w++) { if (filled[w] !== null) last = filled[w]; else if (last !== null) filled[w] = last }
    series[domainKey] = filled
    const nonNull = filled.filter((v): v is number => v !== null)
    domainsMeta.push({
      key: domainKey,
      name: meta.name,
      accent: meta.accent,
      baseline: nonNull[0] ?? (domainKey === 'vasomotor' ? 10 : 5),
      current: nonNull[nonNull.length - 1] ?? (domainKey === 'vasomotor' ? 10 : 5),
      ...(domainKey === 'vasomotor' ? { rawScale: 20, lowerIsBetter: true } : {}),
    })
  }

  // ── Build wearable series (sleep + energy only) ──────────────────────────────
  const wearableSeries: Record<string, (number | null)[]> = {}
  for (const domainKey of ['sleep', 'energy']) {
    const raw: (number | null)[] = Array(actualWeeks).fill(null)
    for (let w = 0; w < actualWeeks; w++) {
      const vals = wearableBuckets[w][domainKey]
      if (vals && vals.length > 0) raw[w] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    const hasAny = raw.some(v => v !== null)
    if (hasAny) {
      const filled: (number | null)[] = [...raw]
      let last: number | null = null
      for (let w = 0; w < actualWeeks; w++) { if (filled[w] !== null) last = filled[w]; else if (last !== null) filled[w] = last }
      wearableSeries[domainKey] = filled
    }
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
    const wk = Math.max(0, Math.min(actualWeeks - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK)))
    milestones.push({ wk, type: 'visit', short: `Visit ${visitCount}`, title: `${v.visit_type === 'initial_consultation' ? 'Initial' : 'Follow-Up'} Consultation`, body: 'Care team visit with Dr. Urban.' })
  }

  // Prescriptions — group same-week rxs into one milestone
  const rxByWeek: Record<number, { names: string[]; prescribed_at: Date }> = {}
  for (const rx of rxList) {
    if (!rx.prescribed_at) continue
    const wk = Math.max(0, Math.min(actualWeeks - 1, Math.floor((rx.prescribed_at.getTime() - startDate.getTime()) / MS_PER_WEEK)))
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

  return NextResponse.json({ weeks: actualWeeks, domains: domainsMeta, series, seriesRaw, wearableSeries, milestones } satisfies TrendData)
}
