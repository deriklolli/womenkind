import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { visits, prescriptions } from '@/lib/db/schema'
import { eq, and, gte, ne } from 'drizzle-orm'

export type PillarKey = 'sleep' | 'vasomotor' | 'mood' | 'brain' | 'hormonal'

interface Pillar {
  key: PillarKey
  name: string
  accent: string
  baseline: number
  current: number
  unit: string
}

interface Milestone {
  wk: number
  type: 'visit' | 'rx' | 'dose' | 'lab'
  short: string
  title: string
  body: string
}

interface PillarTrendData {
  pillars: Pillar[]
  series: Record<PillarKey, (number | null)[]>
  milestones: Milestone[]
  startDate: string
}

const PILLAR_META: Record<PillarKey, { name: string; accent: string; domain: string; unit: string }> = {
  sleep:     { name: 'Sleep',             accent: '#5d9ed5', domain: 'sleep',     unit: '/10' },
  vasomotor: { name: 'Vasomotor',         accent: '#c97c5d', domain: 'vasomotor', unit: '/10' },
  mood:      { name: 'Mood',              accent: '#7c6bc4', domain: 'mood',      unit: '/10' },
  brain:     { name: 'Brain & Cognition', accent: '#944fed', domain: 'cognition', unit: '/10' },
  hormonal:  { name: 'Hormonal',          accent: '#c47884', domain: 'gsm',       unit: '/10' },
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
  return Math.max(0, Math.min(10, (1 - (raw - 1) / 4) * 10))
}

// DEV FIXTURE ─────────────────────────────────────────────────────────────────
const DEV_RESPONSE: PillarTrendData = {
  startDate: (() => {
    const d = new Date()
    d.setDate(d.getDate() - 23 * 7)
    return d.toISOString().slice(0, 10)
  })(),
  pillars: [
    { key: 'sleep',     name: 'Sleep',             accent: '#5d9ed5', baseline: 5.5, current: 8.1, unit: '/10' },
    { key: 'vasomotor', name: 'Vasomotor',         accent: '#c97c5d', baseline: 3.5, current: 7.2, unit: '/10' },
    { key: 'mood',      name: 'Mood',              accent: '#7c6bc4', baseline: 5.0, current: 7.7, unit: '/10' },
    { key: 'brain',     name: 'Brain & Cognition', accent: '#944fed', baseline: 4.5, current: 7.1, unit: '/10' },
    { key: 'hormonal',  name: 'Hormonal',          accent: '#c47884', baseline: 5.0, current: 8.0, unit: '/10' },
  ],
  series: {
    sleep:     [5.5, 5.5, 6.0, 5.8, 6.2, 6.5, 6.3, 6.7, 6.8, 7.0, 7.0, 7.2, 7.1, 7.3, 7.5, 7.4, 7.6, 7.5, 7.8, 7.7, 7.9, 8.0, 7.8, 8.1],
    vasomotor: [3.5, 4.0, 3.8, 4.2, 4.5, 4.3, 4.8, 5.0, 5.2, 5.5, 5.3, 5.8, 5.7, 6.0, 6.2, 6.1, 6.4, 6.5, 6.7, 6.8, 6.9, 7.0, 7.1, 7.2],
    mood:      [5.0, 4.8, 5.2, 5.5, 5.3, 5.8, 6.0, 5.9, 6.2, 6.4, 6.3, 6.6, 6.7, 6.8, 7.0, 7.1, 7.0, 7.2, 7.3, 7.4, 7.3, 7.5, 7.6, 7.7],
    brain:     [4.5, 4.3, 4.7, 5.0, 4.8, 5.2, 5.5, 5.3, 5.7, 5.8, 5.9, 6.0, 6.1, 6.2, 6.3, 6.5, 6.4, 6.6, 6.7, 6.7, 6.8, 6.9, 7.0, 7.1],
    hormonal:  [5.0, 5.2, 5.5, 5.3, 5.8, 6.0, 5.9, 6.3, 6.5, 6.4, 6.7, 6.8, 7.0, 7.0, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.6, 7.8, 7.9, 8.0],
  },
  milestones: [
    { wk: 0,  type: 'visit', short: 'Visit 1',   title: 'Initial Consultation',         body: 'Met with Dr. Urban to review symptoms, history, and establish a personalized care plan.' },
    { wk: 4,  type: 'rx',   short: 'Estradiol',  title: 'Estradiol Patch Started',       body: 'Started transdermal estradiol 0.0375 mg/day to address vasomotor symptoms and sleep disruption.' },
    { wk: 8,  type: 'lab',  short: 'Labs',       title: 'Hormone Panel Drawn',           body: 'Baseline estradiol, FSH, and progesterone levels checked to confirm dosing effectiveness.' },
    { wk: 16, type: 'dose', short: 'Dose +',     title: 'Estradiol Dose Increased',      body: 'Dose adjusted to 0.05 mg/day based on symptom response and hormone panel results.' },
    { wk: 22, type: 'visit', short: 'Visit 2',   title: 'Follow-Up Consultation',        body: 'Reviewed progress across all pillars. Vasomotor and sleep domains show significant improvement.' },
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

  // ── Load daily check-in visits ──────────────────────────────────────────────
  const checkins = await db.select({
    visit_date: visits.visit_date,
    symptom_scores: visits.symptom_scores,
  }).from(visits).where(
    and(
      eq(visits.patient_id, patientId),
      eq(visits.source, 'daily'),
      gte(visits.visit_date, startIso),
    )
  )

  // ── Build weekly buckets ────────────────────────────────────────────────────
  const weeklyBuckets: Record<string, Record<string, number[]>> = {}
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

  // ── Build per-pillar series (fill gaps with linear interpolation) ───────────
  const series: Record<PillarKey, (number | null)[]> = {
    sleep: [], vasomotor: [], mood: [], brain: [], hormonal: [],
  }

  for (const [pillarKey, meta] of Object.entries(PILLAR_META) as [PillarKey, typeof PILLAR_META[PillarKey]][]) {
    const raw: (number | null)[] = Array(WEEKS).fill(null)
    for (let w = 0; w < WEEKS; w++) {
      const vals = weeklyBuckets[w][meta.domain]
      if (vals && vals.length > 0) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        raw[w] = normalizeToDisplay(meta.domain, avg)
      }
    }
    // Forward-fill then backward-fill so the chart always has a continuous line
    let last: number | null = null
    for (let w = 0; w < WEEKS; w++) {
      if (raw[w] !== null) { last = raw[w]; series[pillarKey][w] = raw[w] }
      else series[pillarKey][w] = last
    }
    last = null
    for (let w = WEEKS - 1; w >= 0; w--) {
      if (series[pillarKey][w] !== null) { last = series[pillarKey][w]; }
      else if (last !== null) series[pillarKey][w] = last
    }
  }

  // ── Build pillars array ─────────────────────────────────────────────────────
  const pillars: Pillar[] = (Object.entries(PILLAR_META) as [PillarKey, typeof PILLAR_META[PillarKey]][]).map(([key, meta]) => {
    const s = series[key]
    const nonNull = s.filter((v): v is number => v !== null)
    const baseline = nonNull[0] ?? 5
    const current = nonNull[nonNull.length - 1] ?? 5
    return { key, name: meta.name, accent: meta.accent, baseline, current, unit: meta.unit }
  })

  // ── Load milestones ─────────────────────────────────────────────────────────
  const [providerVisits, rxList] = await Promise.all([
    db.select({
      id: visits.id,
      visit_date: visits.visit_date,
      visit_type: visits.visit_type,
    }).from(visits).where(
      and(
        eq(visits.patient_id, patientId),
        ne(visits.source, 'daily'),
        gte(visits.visit_date, startIso),
      )
    ),
    db.select({
      id: prescriptions.id,
      medication_name: prescriptions.medication_name,
      dosage: prescriptions.dosage,
      prescribed_at: prescriptions.prescribed_at,
    }).from(prescriptions).where(
      and(
        eq(prescriptions.patient_id, patientId),
        gte(prescriptions.prescribed_at, startDate),
      )
    ),
  ])

  const milestones: Milestone[] = []
  let visitCount = 0
  for (const v of providerVisits.sort((a, b) => a.visit_date.localeCompare(b.visit_date))) {
    visitCount++
    const d = new Date(v.visit_date + 'T00:00:00')
    const wk = Math.max(0, Math.min(WEEKS - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK)))
    milestones.push({
      wk,
      type: 'visit',
      short: `Visit ${visitCount}`,
      title: `${v.visit_type === 'initial_consultation' ? 'Initial' : 'Follow-Up'} Consultation`,
      body: 'Care team visit with Dr. Urban.',
    })
  }
  for (const rx of rxList.sort((a, b) => (a.prescribed_at?.getTime() ?? 0) - (b.prescribed_at?.getTime() ?? 0))) {
    if (!rx.prescribed_at) continue
    const wk = Math.max(0, Math.min(WEEKS - 1, Math.floor((rx.prescribed_at.getTime() - startDate.getTime()) / MS_PER_WEEK)))
    milestones.push({
      wk,
      type: 'rx',
      short: rx.medication_name.split(' ')[0].slice(0, 10),
      title: `${rx.medication_name} ${rx.dosage} Started`,
      body: `Prescription started at ${rx.dosage}.`,
    })
  }
  milestones.sort((a, b) => a.wk - b.wk)

  return NextResponse.json({
    pillars,
    series,
    milestones,
    startDate: startIso,
  } satisfies PillarTrendData)
}
