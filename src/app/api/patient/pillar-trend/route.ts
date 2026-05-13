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
  date: string   // ISO date string YYYY-MM-DD for display
}

interface TrendData {
  weeks: number
  startIso: string
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
const DEV_START_ISO = (() => { const d = new Date(); d.setDate(d.getDate() - 23 * 7); return d.toISOString().slice(0, 10) })()

// DEV: 5 check-ins at weeks 3, 8, 13, 18, 23 — nulls between show real sparse-data rendering
// series = carry-forward fill (what the line follows); seriesRaw = only real check-in points (hollow dots)
const DEV_RESPONSE: TrendData = {
  weeks: 24,
  startIso: DEV_START_ISO,
  wearableSeries: {},
  domains: [
    { key: 'vasomotor', name: 'Vasomotor',     accent: '#c97c5d', baseline: 12,  current: 3,   rawScale: 20, lowerIsBetter: true },
    { key: 'sleep',     name: 'Sleep',          accent: '#5d9ed5', baseline: 5.5, current: 8.1, rawScale: 12 },
    { key: 'energy',    name: 'Energy',         accent: '#e8a838', baseline: 3, current: 7,  rawScale: 10 },
    { key: 'mood',      name: 'Mood',           accent: '#7c6bc4', baseline: 4, current: 8,  rawScale: 10 },
    { key: 'cognition', name: 'Cognition',      accent: '#6366f1', baseline: 3, current: 7,  rawScale: 10 },
    { key: 'gsm',       name: 'Hormonal',       accent: '#c47884', baseline: 4, current: 7,  rawScale: 10 },
    { key: 'bone',      name: 'Bone Health',    accent: '#78716c', baseline: 5, current: 7,  rawScale: 10 },
    { key: 'weight',    name: 'Metabolism',     accent: '#0891b2', baseline: 4, current: 7,  rawScale: 10 },
    { key: 'libido',    name: 'Libido',         accent: '#e879f9', baseline: 3, current: 7,  rawScale: 10 },
    { key: 'cardio',    name: 'Cardiovascular', accent: '#ef4444', baseline: 2,   current: 0,   rawScale: 20, lowerIsBetter: true },
  ],
  series: {
    vasomotor: [0,0,0, 12,12,12,12,12, 9,9,9,9,9, 7,7,7,7,7, 5,5,5,5,5, 3],
    sleep:     [0,0,0, 5.5,5.5,5.5,5.5,5.5, 6.5,6.5,6.5,6.5,6.5, 7.0,7.0,7.0,7.0,7.0, 7.5,7.5,7.5,7.5,7.5, 8.1],
    energy:    [0,0,0, 3,3,3,3,3, 5,5,5,5,5, 6,6,6,6,6, 7,7,7,7,7, 7],
    mood:      [0,0,0, 4,4,4,4,4, 5,5,5,5,5, 6,6,6,6,6, 7,7,7,7,7, 8],
    cognition: [0,0,0, 3,3,3,3,3, 5,5,5,5,5, 6,6,6,6,6, 7,7,7,7,7, 7],
    gsm:       [0,0,0, 4,4,4,4,4, 5,5,5,5,5, 6,6,6,6,6, 7,7,7,7,7, 7],
    bone:      [0,0,0, 5,5,5,5,5, 6,6,6,6,6, 6,6,6,6,6, 7,7,7,7,7, 7],
    weight:    [0,0,0, 4,4,4,4,4, 5,5,5,5,5, 6,6,6,6,6, 7,7,7,7,7, 7],
    libido:    [0,0,0, 3,3,3,3,3, 5,5,5,5,5, 6,6,6,6,6, 7,7,7,7,7, 7],
    cardio:    [0,0,0, 2,2,2,2,2, 1,1,1,1,1, 1,1,1,1,1, 0,0,0,0,0, 0],
  },
  seriesRaw: {
    vasomotor: [null,null,null, 12, null,null,null,null, 9, null,null,null,null, 7, null,null,null,null, 5, null,null,null,null, 3],
    sleep:     [null,null,null, 5.5, null,null,null,null, 6.5, null,null,null,null, 7.0, null,null,null,null, 7.5, null,null,null,null, 8.1],
    energy:    [null,null,null, 3, null,null,null,null, 5, null,null,null,null, 6, null,null,null,null, 7, null,null,null,null, 7],
    mood:      [null,null,null, 4, null,null,null,null, 5, null,null,null,null, 6, null,null,null,null, 7, null,null,null,null, 8],
    cognition: [null,null,null, 3, null,null,null,null, 5, null,null,null,null, 6, null,null,null,null, 7, null,null,null,null, 7],
    gsm:       [null,null,null, 4, null,null,null,null, 5, null,null,null,null, 6, null,null,null,null, 7, null,null,null,null, 7],
    bone:      [null,null,null, 5, null,null,null,null, 6, null,null,null,null, 6, null,null,null,null, 7, null,null,null,null, 7],
    weight:    [null,null,null, 4, null,null,null,null, 5, null,null,null,null, 6, null,null,null,null, 7, null,null,null,null, 7],
    libido:    [null,null,null, 3, null,null,null,null, 5, null,null,null,null, 6, null,null,null,null, 7, null,null,null,null, 7],
    cardio:    [null,null,null, 2, null,null,null,null, 1, null,null,null,null, 1, null,null,null,null, 0, null,null,null,null, 0],
  },
  milestones: [
    {
      wk: 0,
      type: 'visit' as const,
      short: 'Initial',
      title: 'Initial Consultation',
      body: '15 minute consultation',
      date: DEV_START_ISO,
    },
    {
      wk: 2,
      type: 'rx' as const,
      short: 'Rx',
      title: 'Estradiol patch started',
      body: '',
      date: (() => { const d = new Date(DEV_START_ISO); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10) })(),
    },
    {
      wk: 12,
      type: 'visit' as const,
      short: 'Follow-up',
      title: 'Follow-Up Consultation',
      body: '15 minute consultation',
      date: (() => { const d = new Date(DEV_START_ISO); d.setDate(d.getDate() + 84); return d.toISOString().slice(0, 10) })(),
    },
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
    // sleep_score (0–100) → approximate hours (÷10); readiness_score (0–100) → 1–5 burden (inverted: 100=1 best, 0=5 worst)
    const wearableVal = domainKey === 'sleep'
      ? Math.max(0, Math.min(12, row.value / 10))
      : Math.max(1, Math.min(5, 5 - (row.value / 100) * 4))
    wearableBuckets[wk][domainKey].push(wearableVal)
  }

  // ── Build per-domain check-in series ────────────────────────────────────────
  // rawScale for each domain — controls y-axis range and what gets plotted
  const DOMAIN_RAW_SCALES: Record<string, number> = {
    vasomotor: 20, sleep: 12, energy: 10, mood: 10, cognition: 10,
    gsm: 10, bone: 10, weight: 10, libido: 10, cardio: 20, overall: 10,
  }
  const LOWER_IS_BETTER = new Set(['vasomotor', 'cardio'])
  // Sensible fallback when no data exists yet
  const DEFAULT_VAL: Record<string, number> = {
    vasomotor: 10, sleep: 6, energy: 3, mood: 3, cognition: 3,
    gsm: 3, bone: 3, weight: 3, libido: 3, cardio: 0, overall: 3,
  }

  const series: Record<string, (number | null)[]> = {}
  const seriesRaw: Record<string, (number | null)[]> = {}
  const domainsMeta: DomainMeta[] = []

  for (const [domainKey, meta] of Object.entries(ALL_DOMAIN_META)) {
    const raw: (number | null)[] = Array(actualWeeks).fill(null)
    for (let w = 0; w < actualWeeks; w++) {
      const vals = weeklyBuckets[w][domainKey]
      if (vals && vals.length > 0) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        raw[w] = avg  // always raw — chart plots same value the symptom card shows
      }
    }
    seriesRaw[domainKey] = [...raw]
    const filled: (number | null)[] = [...raw]
    let last: number | null = null
    for (let w = 0; w < actualWeeks; w++) { if (filled[w] !== null) last = filled[w]; else if (last !== null) filled[w] = last }
    // floor fill: weeks before first real check-in sit at 0 (visual baseline only, not data)
    for (let w = 0; w < actualWeeks; w++) { if (filled[w] === null) filled[w] = 0; else break }
    series[domainKey] = filled
    const nonNull = raw.filter((v): v is number => v !== null)
    const rawScale = DOMAIN_RAW_SCALES[domainKey]
    domainsMeta.push({
      key: domainKey,
      name: meta.name,
      accent: meta.accent,
      baseline: nonNull[0] ?? DEFAULT_VAL[domainKey] ?? 3,
      current: nonNull[nonNull.length - 1] ?? DEFAULT_VAL[domainKey] ?? 3,
      ...(rawScale ? { rawScale, ...(LOWER_IS_BETTER.has(domainKey) ? { lowerIsBetter: true } : {}) } : {}),
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
      // floor fill: extend line back to start at 0 before first wearable reading
      for (let w = 0; w < actualWeeks; w++) { if (filled[w] === null) filled[w] = 0; else break }
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
  for (const v of providerVisits.sort((a, b) => a.visit_date.localeCompare(b.visit_date))) {
    if (seenVisitDates.has(v.visit_date)) continue
    seenVisitDates.add(v.visit_date)
    const d = new Date(v.visit_date + 'T00:00:00')
    const wk = Math.max(0, Math.min(actualWeeks - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK)))
    const isInitial = v.visit_type === 'initial_consultation'
    milestones.push({
      wk,
      type: 'visit',
      short: isInitial ? 'Initial' : 'Follow-up',
      title: isInitial ? 'Initial Consultation' : 'Follow-Up Consultation',
      body: '15 minute consultation',
      date: v.visit_date,
    })
  }

  // Prescriptions — group same-week rxs into one milestone
  const rxByWeek: Record<number, { names: string[]; prescribed_at: Date }> = {}
  for (const rx of rxList) {
    if (!rx.prescribed_at) continue
    const wk = Math.max(0, Math.min(actualWeeks - 1, Math.floor((rx.prescribed_at.getTime() - startDate.getTime()) / MS_PER_WEEK)))
    if (!rxByWeek[wk]) rxByWeek[wk] = { names: [], prescribed_at: rx.prescribed_at }
    rxByWeek[wk].names.push(rx.medication_name)
  }
  for (const [wkStr, { names, prescribed_at }] of Object.entries(rxByWeek)) {
    const wk = Number(wkStr)
    const isSingle = names.length === 1
    milestones.push({
      wk,
      type: 'rx',
      short: 'Rx',
      title: isSingle ? `${names[0]} started` : `${names.length} medications started`,
      body: isSingle ? '' : names.join(', '),
      date: prescribed_at.toISOString().slice(0, 10),
    })
  }

  milestones.sort((a, b) => a.wk - b.wk)

  return NextResponse.json({ weeks: actualWeeks, startIso, domains: domainsMeta, series, seriesRaw, wearableSeries, milestones } satisfies TrendData)
}
