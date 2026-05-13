import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, subscriptions, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isMemberPlan, MEMBER_PLAN_TYPES } from '@/lib/stripe'

/**
 * GET  /api/debug/fix-patient-membership?email=X&secret=Y  — diagnose only
 * POST /api/debug/fix-patient-membership  body: { email, secret, plan? }  — diagnose + fix
 *
 * Looks up a patient by email and shows their membership state.
 * On POST, creates a missing active subscription row if none exists.
 */

async function getPatientByEmail(email: string) {
  const rows = await db
    .select({
      patientId: patients.id,
      profileId: patients.profile_id,
      onboardingStatus: patients.onboarding_status,
      membershipPlan: patients.membership_plan,
      firstName: profiles.first_name,
      lastName: profiles.last_name,
      email: profiles.email,
    })
    .from(patients)
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(profiles.email, email))
    .limit(1)

  return rows[0] ?? null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  const email = searchParams.get('email')

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const patient = await getPatientByEmail(email)
  if (!patient) {
    return NextResponse.json({ error: 'No patient found for that email' }, { status: 404 })
  }

  const subs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.patient_id, patient.patientId),
    columns: { id: true, plan_type: true, status: true, stripe_subscription_id: true, created_at: true },
  })

  const activeMember = subs.find(s => isMemberPlan(s.plan_type) && s.status === 'active')

  return NextResponse.json({
    patient,
    subscriptions: subs,
    isMember: !!activeMember,
    activeMemberSubscription: activeMember ?? null,
    validPlanTypes: MEMBER_PLAN_TYPES,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, secret, plan } = body

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const patient = await getPatientByEmail(email)
  if (!patient) {
    return NextResponse.json({ error: 'No patient found for that email' }, { status: 404 })
  }

  const subs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.patient_id, patient.patientId),
    columns: { id: true, plan_type: true, status: true },
  })

  const activeMember = subs.find(s => isMemberPlan(s.plan_type) && s.status === 'active')

  if (activeMember) {
    return NextResponse.json({
      ok: true,
      action: 'none',
      message: 'Patient already has an active member subscription',
      subscription: activeMember,
    })
  }

  const resolvedPlan = patient.membershipPlan || plan || 'vitality'

  if (!isMemberPlan(resolvedPlan)) {
    return NextResponse.json({
      error: `Resolved plan '${resolvedPlan}' is not in MEMBER_PLAN_TYPES`,
      validPlanTypes: MEMBER_PLAN_TYPES,
    }, { status: 400 })
  }

  // Ensure membership_plan is set on the patient row
  await db
    .update(patients)
    .set({ membership_plan: resolvedPlan, onboarding_status: 'paid' })
    .where(eq(patients.id, patient.patientId))

  // Create the missing active subscription
  await db.insert(subscriptions).values({
    patient_id: patient.patientId,
    plan_type: resolvedPlan,
    status: 'active',
  })

  return NextResponse.json({
    ok: true,
    action: 'created',
    message: `Created active ${resolvedPlan} subscription for ${email}`,
    patient: { id: patient.patientId, name: `${patient.firstName} ${patient.lastName}` },
  })
}
