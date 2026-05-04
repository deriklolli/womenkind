import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { logPhiAccess } from '@/lib/phi-audit'
import { db } from '@/lib/db'
import { visits, providers, wearable_metrics } from '@/lib/db/schema'
import { eq, and, gte } from 'drizzle-orm'
import { computeLiveWMI } from '@/lib/wmi-scoring'

// Domains always required regardless of wearable
const BASE_DOMAINS = ['vasomotor', 'mood', 'cognition', 'gsm', 'bone', 'weight', 'libido', 'cardio', 'overall']
// Domains skipped when wearable data is present (Oura covers them)
const WEARABLE_COVERED_DOMAINS = ['sleep', 'energy']

// Per-domain validation ranges (defaults to 1–5 for unlisted)
const DOMAIN_RANGES: Record<string, { min: number; max: number }> = {
  vasomotor: { min: 0, max: 20 },  // daily average count of hot flashes/night sweats
  sleep:     { min: 0, max: 12 },  // average hours per night
  cardio:    { min: 0, max: 99 },  // episode count (0 = none)
}
const DEFAULT_RANGE = { min: 1, max: 5 }

/** Returns Monday of the ISO week containing the given date, as YYYY-MM-DD */
function getWeekStart(d: Date): string {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day) // shift Sunday → -6, other days → 1-day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

async function checkHasWearable(patientId: string): Promise<boolean> {
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const cutoff = twoDaysAgo.toISOString().slice(0, 10)
  const row = await db.query.wearable_metrics.findFirst({
    where: and(
      eq(wearable_metrics.patient_id, patientId),
      gte(wearable_metrics.metric_date, cutoff),
    ),
    columns: { id: true },
  })
  return !!row
}

/**
 * GET /api/weekly-checkin
 * Returns whether the patient has already logged a weekly check-in this week,
 * and whether wearable data is available (which affects which questions to show).
 */
export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ checkedIn: false, visit: null, hasWearable: false })
    }

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'patient' || !session.patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const weekStart = getWeekStart(new Date())

    const [visit, hasWearable] = await Promise.all([
      db.query.visits.findFirst({
        where: and(
          eq(visits.patient_id, session.patientId),
          eq(visits.visit_date, weekStart),
          eq(visits.source, 'daily'),
        ),
        columns: { id: true, checked_in_at: true, symptom_scores: true, visit_date: true },
      }),
      checkHasWearable(session.patientId),
    ])

    return NextResponse.json({ checkedIn: !!visit, visit: visit ?? null, hasWearable })
  } catch (err: any) {
    console.error('Weekly check-in GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/weekly-checkin
 * Creates a weekly symptom check-in for the authenticated patient.
 * Questions are framed as weekly averages/totals.
 * Vasomotor is a daily average count (0–20), cardio is an episode count (0–99), others are 1–5 burden.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'development') {
      const { scores } = await req.json()
      const today = new Date().toISOString().slice(0, 10)
      const liveWmi = computeLiveWMI([{ source: 'daily', visit_date: today, symptom_scores: scores as Record<string, number> }])
      return NextResponse.json(
        { visit: { id: 'dev-weekly-visit', symptom_scores: scores }, liveWmi },
        { status: 201 },
      )
    }

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'patient' || !session.patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { scores, appointmentId } = await req.json()

    if (!scores) {
      return NextResponse.json({ error: 'scores is required' }, { status: 400 })
    }

    // Determine which domains are required based on wearable availability
    const hasWearable = await checkHasWearable(session.patientId)
    const requiredDomains = hasWearable
      ? BASE_DOMAINS
      : [...BASE_DOMAINS, ...WEARABLE_COVERED_DOMAINS]

    for (const domain of requiredDomains) {
      const val = scores[domain]
      const range = DOMAIN_RANGES[domain] ?? DEFAULT_RANGE
      if (typeof val !== 'number' || val < range.min || val > range.max) {
        return NextResponse.json(
          { error: `Score for "${domain}" must be a number between ${range.min} and ${range.max}` },
          { status: 400 },
        )
      }
    }

    const weekStart = getWeekStart(new Date())

    const existing = await db.query.visits.findFirst({
      where: and(
        eq(visits.patient_id, session.patientId),
        eq(visits.visit_date, weekStart),
        eq(visits.source, 'daily'),
      ),
      columns: { id: true },
    })

    const [provider] = await db.select({ id: providers.id })
      .from(providers)
      .where(eq(providers.is_active, true))
      .limit(1)

    let inserted
    if (existing) {
      ;[inserted] = await db.update(visits).set({
        symptom_scores: scores,
        checked_in_at: new Date(),
        ...(appointmentId ? { appointment_id: appointmentId } : {}),
      }).where(eq(visits.id, existing.id)).returning()
    } else {
      ;[inserted] = await db.insert(visits).values({
        patient_id: session.patientId,
        provider_id: provider.id,
        appointment_id: appointmentId ?? null,
        visit_type: 'daily_checkin',
        visit_date: weekStart,
        source: 'daily',
        symptom_scores: scores,
        checked_in_at: new Date(),
      }).returning()
    }

    logPhiAccess({
      providerId: provider.id,
      patientId: session.patientId,
      recordType: 'appointment',
      recordId: inserted.id,
      action: 'create',
      route: '/api/weekly-checkin',
      req,
    })

    const liveWmi = computeLiveWMI([{
      source: 'daily',
      visit_date: inserted.visit_date,
      symptom_scores: inserted.symptom_scores as Record<string, number> | null,
    }])

    return NextResponse.json({ visit: inserted, liveWmi }, { status: 201 })
  } catch (err: any) {
    console.error('Weekly check-in POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
