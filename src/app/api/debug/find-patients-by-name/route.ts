import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { profiles, patients } from '@/lib/db/schema'
import { eq, ilike, or, and } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { names } = await req.json()

  const results = []
  for (const [first, last] of names) {
    const rows = await db
      .select({
        patientId: patients.id,
        profileId: profiles.id,
        firstName: profiles.first_name,
        lastName: profiles.last_name,
        email: profiles.email,
        onboardingStatus: patients.onboarding_status,
        membershipPlan: patients.membership_plan,
      })
      .from(profiles)
      .innerJoin(patients, eq(patients.profile_id, profiles.id))
      .where(
        and(
          ilike(profiles.first_name, `%${first}%`),
          ilike(profiles.last_name, `%${last}%`)
        )
      )
    results.push(...rows)
  }

  return NextResponse.json({ patients: results })
}
