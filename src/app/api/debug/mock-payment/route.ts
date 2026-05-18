import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

export const dynamic = 'force-dynamic'

/**
 * POST /api/debug/mock-payment
 *
 * Marks the current patient as paid without going through Stripe.
 * Only available when ENABLE_TEST_ROUTES=true — used by Playwright E2E tests
 * when Stripe test-mode keys are not configured on the environment.
 */
export async function POST() {
  if (process.env.ENABLE_TEST_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const session = await getServerSession()
  if (!session || session.role !== 'patient' || !session.patientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db
    .update(patients)
    .set({ onboarding_status: 'paid', membership_plan: 'vitality' })
    .where(eq(patients.id, session.patientId))

  return NextResponse.json({ ok: true })
}
