import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { logPhiAccess } from '@/lib/phi-audit'
import { db } from '@/lib/db'
import { visits, providers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const REQUIRED_DOMAINS = ['vasomotor', 'sleep', 'energy', 'mood', 'cognition', 'gsm', 'bone', 'weight', 'libido', 'cardio', 'overall']

/**
 * GET /api/daily-checkin
 * Returns whether the patient has already logged a daily check-in today.
 */
export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ checkedIn: false, visit: null })
    }

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'patient' || !session.patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const today = new Date().toISOString().split('T')[0]

    const visit = await db.query.visits.findFirst({
      where: and(
        eq(visits.patient_id, session.patientId),
        eq(visits.visit_date, today),
        eq(visits.source, 'daily')
      ),
      columns: { id: true, checked_in_at: true, symptom_scores: true, visit_date: true },
    })

    return NextResponse.json({ checkedIn: !!visit, visit: visit ?? null })
  } catch (err: any) {
    console.error('Daily check-in GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/daily-checkin
 * Creates a daily symptom check-in for the authenticated patient.
 *
 * Body: {
 *   scores: {
 *     vasomotor: number   // 1–5
 *     sleep: number
 *     energy: number
 *     mood: number
 *     gsm: number
 *     overall: number
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'development') {
      const { scores } = await req.json()
      return NextResponse.json(
        { visit: { id: 'dev-daily-visit', symptom_scores: scores } },
        { status: 201 }
      )
    }

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'patient' || !session.patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { scores } = await req.json()

    if (!scores) {
      return NextResponse.json({ error: 'scores is required' }, { status: 400 })
    }

    for (const domain of REQUIRED_DOMAINS) {
      const val = scores[domain]
      if (typeof val !== 'number' || val < 1 || val > 5) {
        return NextResponse.json(
          { error: `Score for "${domain}" must be a number between 1 and 5` },
          { status: 400 }
        )
      }
    }

    const today = new Date().toISOString().split('T')[0]

    const existing = await db.query.visits.findFirst({
      where: and(
        eq(visits.patient_id, session.patientId),
        eq(visits.visit_date, today),
        eq(visits.source, 'daily')
      ),
      columns: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'You have already logged your symptoms today.' },
        { status: 409 }
      )
    }

    const [provider] = await db.select({ id: providers.id })
      .from(providers)
      .where(eq(providers.is_active, true))
      .limit(1)

    const [inserted] = await db.insert(visits).values({
      patient_id: session.patientId,
      provider_id: provider.id,
      appointment_id: null,
      visit_type: 'daily_checkin',
      visit_date: today,
      source: 'daily',
      symptom_scores: scores,
      checked_in_at: new Date(),
    }).returning()

    logPhiAccess({
      providerId: provider.id,
      patientId: session.patientId,
      recordType: 'appointment',
      recordId: inserted.id,
      action: 'create',
      route: '/api/daily-checkin',
      req,
    })

    return NextResponse.json({ visit: inserted }, { status: 201 })
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json(
        { error: 'You have already logged your symptoms today.' },
        { status: 409 }
      )
    }
    console.error('Daily check-in POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
