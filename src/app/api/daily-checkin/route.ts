import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { logPhiAccess } from '@/lib/phi-audit'
import { db } from '@/lib/db'
import { visits, providers, wearable_metrics, patients, profiles, notifications } from '@/lib/db/schema'
import { eq, and, gte, lt, desc } from 'drizzle-orm'
import { Resend } from 'resend'
import { alreadySentRecently, logEngagement, isEngagementEnabled, buildEngagementEmail } from '@/lib/engagement'
import { computeLiveWMI } from '@/lib/wmi-scoring'

// Domains always required regardless of wearable
const BASE_DOMAINS = ['vasomotor', 'mood', 'cognition', 'gsm', 'bone', 'weight', 'libido', 'cardio', 'overall']
// Domains skipped when wearable data is present (Oura covers them)
const WEARABLE_COVERED_DOMAINS = ['sleep', 'energy']

// Per-domain validation ranges (defaults to 1–5 for unlisted)
const DOMAIN_RANGES: Record<string, { min: number; max: number }> = {
  vasomotor: { min: 0, max: 20 },  // count of hot flashes/night sweats
  sleep:     { min: 0, max: 12 },  // hours slept
  cardio:    { min: 0, max: 99 },  // episode count (0 = none)
}
const DEFAULT_RANGE = { min: 1, max: 5 }

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
 * GET /api/daily-checkin
 * Returns whether the patient has already logged a daily check-in today,
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

    const today = new Date().toISOString().split('T')[0]

    const [visit, hasWearable] = await Promise.all([
      db.query.visits.findFirst({
        where: and(
          eq(visits.patient_id, session.patientId),
          eq(visits.visit_date, today),
          eq(visits.source, 'daily'),
        ),
        columns: { id: true, checked_in_at: true, symptom_scores: true, visit_date: true },
      }),
      checkHasWearable(session.patientId),
    ])

    return NextResponse.json({ checkedIn: !!visit, visit: visit ?? null, hasWearable })
  } catch (err: any) {
    console.error('Daily check-in GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/daily-checkin
 * Creates a daily symptom check-in for the authenticated patient.
 * Required domains vary: wearable users omit sleep + energy (covered by Oura).
 * Vasomotor is a count (0–20), cardio is an episode count (0–99), others are 1–5 burden.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'development') {
      const { scores } = await req.json()
      return NextResponse.json(
        { visit: { id: 'dev-daily-visit', symptom_scores: scores } },
        { status: 201 },
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

    const today = new Date().toISOString().split('T')[0]

    const existing = await db.query.visits.findFirst({
      where: and(
        eq(visits.patient_id, session.patientId),
        eq(visits.visit_date, today),
        eq(visits.source, 'daily'),
      ),
      columns: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'You have already logged your symptoms today.' },
        { status: 409 },
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

    // ── Score drop detection (fire-and-forget, non-blocking) ──────────────────
    ;(async () => {
      try {
        if (!await isEngagementEnabled(session.patientId!, 'score_drop')) return
        if (await alreadySentRecently(session.patientId!, 'score_drop', 3)) return

        const prevVisit = await db.select({ symptom_scores: visits.symptom_scores, visit_date: visits.visit_date, source: visits.source })
          .from(visits)
          .where(and(
            eq(visits.patient_id, session.patientId!),
            eq(visits.source, 'daily'),
            lt(visits.visit_date, inserted.visit_date),
          ))
          .orderBy(desc(visits.visit_date))
          .limit(1)

        if (prevVisit.length === 0) return

        const toWmiInput = (r: typeof prevVisit[0]) =>
          ({ ...r, symptom_scores: r.symptom_scores as Record<string, number> | null })

        const newWmi  = computeLiveWMI([{ ...inserted, source: 'daily', symptom_scores: inserted.symptom_scores as Record<string, number> | null }])
        const prevWmi = computeLiveWMI([toWmiInput(prevVisit[0])])
        if (newWmi === null || prevWmi === null || prevWmi === 0) return
        if (newWmi >= prevWmi * 0.80) return  // less than 20% drop — no alert

        const patientRow = await db.select({ profile_id: patients.profile_id })
          .from(patients).where(eq(patients.id, session.patientId!)).limit(1)
        if (!patientRow[0]) return
        const profileData = await db.select({ email: profiles.email, first_name: profiles.first_name })
          .from(profiles).where(eq(profiles.id, patientRow[0].profile_id)).limit(1)
        if (!profileData[0]?.email) return

        const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
        const firstName = profileData[0].first_name ?? 'there'
        const resend    = new Resend(process.env.RESEND_API_KEY)
        const FROM      = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

        const html = buildEngagementEmail({
          heading: 'We noticed a change in your symptoms',
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName} &mdash; your most recent check-in shows an increase in symptoms compared to last week. This can happen during treatment. If you&rsquo;re concerned, reach out to Dr. Urban directly.</p>`,
          ctaText: 'Message Dr. Urban',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          secondaryCtaText: 'View Your Score',
          secondaryCtaUrl:  `${appUrl}/patient/dashboard`,
          patientId: session.patientId!,
        })

        await resend.emails.send({ from: FROM, to: profileData[0].email, subject: 'We noticed a change in your symptoms', html })
        await db.insert(notifications).values({
          patient_id: session.patientId!,
          type:       'score_drop',
          title:      'Your symptoms may have increased',
          body:       'We noticed a change in your recent check-in. Tap to review.',
          link_view:  'scorecard',
        })
        await logEngagement(session.patientId!, 'score_drop', 'email',  { score_before: prevWmi, score_after: newWmi })
        await logEngagement(session.patientId!, 'score_drop', 'in_app', { score_before: prevWmi, score_after: newWmi })
      } catch (e) {
        console.error('Score drop hook error:', e)
      }
    })()

    return NextResponse.json({ visit: inserted }, { status: 201 })
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json(
        { error: 'You have already logged your symptoms today.' },
        { status: 409 },
      )
    }
    console.error('Daily check-in POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
