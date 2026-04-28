import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { profiles, intakes, subscriptions, care_presentations, providers } from '@/lib/db/schema'
import { eq, and, ne, desc } from 'drizzle-orm'

/**
 * GET /api/patient/me
 *
 * Returns the authenticated patient's profile, intake status, membership,
 * and care presentation data — all sourced from RDS via Drizzle.
 *
 * Used by patient/schedule and patient/dashboard to replace the old
 * Supabase table queries that broke after the RDS migration.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({
      patientId: 'fx-p-1',
      providerId: 'b0000000-0000-0000-0000-000000000001',
      name: 'Lauren Hayes',
      email: 'lauren@example.com',
      intakeStatus: 'reviewed',
      intakeSubmittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      intakeReviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      membershipStatus: 'none',
      membershipRenewal: null,
      intakeSummary: {
        topConcern: 'Hot flashes and sleep issues',
        domains: [
          { domain: 'Vasomotor', severity: 'severe' },
          { domain: 'Sleep', severity: 'moderate' },
          { domain: 'Mood & Anxiety', severity: 'moderate' },
        ],
        menopausalStage: 'Post-menopause',
        symptomBurden: 'high',
      },
      presentationId: 'fx-presentation-1',
      presentationStatus: 'viewed',
      intakeId: 'fx-intake-1',
      wmiScores: {
        vms: 17, sleep: 7, mams: 5, cog: 4, gsm: 3, hsdd: 1, cardio: 0, msk: 0,
        wmi: 60,
        phenotype: 'VMS + SE',
        wmi_band: '55-69',
        wmi_label: 'Active Rebuild Zone',
        wmi_message: 'Your body is under meaningful strain, but this is exactly the zone where structured treatment can create visible progress.',
        safety_flags: [],
      },
    })
  }

  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'patient' || !session.patientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patientId = session.patientId

  // Profile (name + email)
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, session.userId),
    columns: { first_name: true, last_name: true, email: true },
  })

  const name = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Patient'
  const email = profile?.email || ''

  // Most recent submitted intake
  const intake = await db.query.intakes.findFirst({
    where: and(
      eq(intakes.patient_id, patientId),
      ne(intakes.status, 'draft')
    ),
    columns: {
      id: true,
      status: true,
      submitted_at: true,
      ai_brief: true,
      answers: true,
      wmi_scores: true,
    },
    orderBy: [desc(intakes.submitted_at)],
  })

  // Membership
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.patient_id, patientId),
      eq(subscriptions.plan_type, 'membership')
    ),
    columns: { status: true, current_period_end: true },
    orderBy: [desc(subscriptions.created_at)],
  })

  const membershipStatus = (sub?.status as 'active' | 'canceled' | 'past_due' | 'none') ?? 'none'
  const membershipRenewal = sub?.current_period_end?.toISOString() ?? null
  const isMember = membershipStatus === 'active'

  // Care presentation
  const presentation = await db.query.care_presentations.findFirst({
    where: and(
      eq(care_presentations.patient_id, patientId),
      // status IN ('sent', 'viewed') — use ne('draft') equivalent
    ),
    columns: { id: true, status: true },
    orderBy: [desc(care_presentations.created_at)],
  })

  // Filter to only sent/viewed
  const validPresentation =
    presentation && (presentation.status === 'sent' || presentation.status === 'viewed')
      ? presentation
      : null

  // Build intake summary from ai_brief
  let intakeSummary = null
  const aiIntake = intake as any
  if (aiIntake?.ai_brief) {
    const brief = aiIntake.ai_brief
    intakeSummary = {
      topConcern:
        aiIntake.answers?.top_concern ||
        brief.symptom_summary?.overview ||
        '',
      domains:
        brief.symptom_summary?.domains?.map((d: any) => ({
          domain: d.domain,
          severity: d.severity,
        })) || [],
      menopausalStage: brief.metadata?.menopausal_stage || 'Unknown',
      symptomBurden: brief.metadata?.symptom_burden || 'unknown',
    }
  }

  // Find the provider whose profile row exists (inner join filters out orphaned seeded records).
  // Ordered by created_at DESC so the real record (created on first login) wins if there are duplicates.
  const providerRows = await db
    .select({ id: providers.id })
    .from(providers)
    .innerJoin(profiles, eq(providers.profile_id, profiles.id))
    .where(eq(providers.is_active, true))
    .orderBy(desc(providers.created_at))
    .limit(1)
  const provider = providerRows[0] ?? null

  return NextResponse.json({
    patientId,
    providerId: provider?.id ?? null,
    name,
    email,
    isMember,
    membershipStatus,
    membershipRenewal,
    intakeStatus: intake?.status ?? null,
    intakeSubmittedAt: (intake as any)?.submitted_at?.toISOString?.() ?? (intake as any)?.submitted_at ?? null,
    intakeReviewedAt: null, // field not in RDS schema
    intakeSummary,
    presentationId: validPresentation?.id ?? null,
    presentationStatus: (validPresentation?.status as 'sent' | 'viewed') ?? null,
    intakeId: intake?.id ?? null,
    wmiScores: (intake as any)?.wmi_scores ?? null,
  })
}
