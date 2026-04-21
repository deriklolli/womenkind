import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { profiles, intakes, subscriptions, care_presentations } from '@/lib/db/schema'
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

  return NextResponse.json({
    patientId,
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
  })
}
