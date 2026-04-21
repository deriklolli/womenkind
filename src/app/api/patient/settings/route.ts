import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { profiles, subscriptions } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

/**
 * GET /api/patient/settings
 *
 * Returns the patient's profile info and membership subscription data
 * for the settings page, sourced from RDS via Drizzle.
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

  // Profile
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, session.userId),
    columns: { first_name: true, last_name: true, email: true },
  })

  // Membership subscription
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.patient_id, patientId),
      eq(subscriptions.plan_type, 'membership')
    ),
    columns: { status: true, current_period_end: true },
    orderBy: [desc(subscriptions.created_at)],
  })

  return NextResponse.json({
    patientId,
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    email: profile?.email ?? '',
    subscription: sub
      ? {
          status: sub.status,
          current_period_end: sub.current_period_end?.toISOString() ?? null,
        }
      : null,
  })
}
