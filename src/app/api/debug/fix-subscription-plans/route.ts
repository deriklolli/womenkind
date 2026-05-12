import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, subscriptions } from '@/lib/db/schema'
import { eq, inArray, notInArray } from 'drizzle-orm'
import { MEMBER_PLAN_TYPES } from '@/lib/stripe'

/**
 * POST /api/debug/fix-subscription-plans
 *
 * Repairs subscription records for patients whose plan_type is wrong:
 * - plan_type = 'intake' → update to their actual membership_plan
 * - no subscription row at all, but onboarding_status is 'paid' or 'active' → create one
 *
 * Protected by x-migration-secret header.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const defaultPlan: string | null = body.defaultPlan || null

  const results: {
    fixed_intake_rows: string[]
    created_missing_rows: string[]
    skipped_no_plan: string[]
  } = {
    fixed_intake_rows: [],
    created_missing_rows: [],
    skipped_no_plan: [],
  }

  // 1. Fix rows with plan_type = 'intake' — update to real tier
  const badRows = await db.query.subscriptions.findMany({
    where: eq(subscriptions.plan_type, 'intake'),
    columns: { id: true, patient_id: true, stripe_customer_id: true, stripe_subscription_id: true },
  })

  for (const row of badRows) {
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, row.patient_id),
      columns: { id: true, membership_plan: true },
    })

    const plan = patient?.membership_plan || defaultPlan
    if (!plan || !MEMBER_PLAN_TYPES.includes(plan as any)) {
      results.skipped_no_plan.push(row.patient_id)
      continue
    }

    await db
      .update(subscriptions)
      .set({ plan_type: plan })
      .where(eq(subscriptions.id, row.id))

    results.fixed_intake_rows.push(`${row.patient_id} → ${plan}`)
  }

  // 2. Find patients who are paid/active but have NO member subscription row
  const allPaidPatients = await db.query.patients.findMany({
    where: inArray(patients.onboarding_status, ['paid', 'active']),
    columns: { id: true, membership_plan: true },
  })

  for (const patient of allPaidPatients) {
    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.patient_id, patient.id),
      columns: { id: true, plan_type: true },
    })

    // Already has a valid member subscription — skip
    if (existing && MEMBER_PLAN_TYPES.includes(existing.plan_type as any)) continue

    // Has a bad row that was already fixed above — skip
    if (existing && existing.plan_type !== 'intake') continue

    // No row at all (or only just-fixed intake rows handled above)
    if (!existing) {
      const plan = patient.membership_plan || defaultPlan
      if (!plan || !MEMBER_PLAN_TYPES.includes(plan as any)) {
        results.skipped_no_plan.push(patient.id)
        continue
      }

      await db.update(patients)
        .set({ membership_plan: plan })
        .where(eq(patients.id, patient.id))

      await db.insert(subscriptions).values({
        patient_id: patient.id,
        plan_type: plan,
        status: 'active',
      })

      results.created_missing_rows.push(`${patient.id} → ${plan}`)
    }
  }

  return NextResponse.json({ ok: true, results })
}
