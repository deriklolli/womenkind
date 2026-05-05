import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intakes, patients, profiles } from '@/lib/db/schema'
import { gte, desc, eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 14 * 86400000) // last 14 days

  const rows = await db
    .select({
      intake_id: intakes.id,
      intake_status: intakes.status,
      intake_created: intakes.created_at,
      intake_submitted: intakes.submitted_at,
      has_brief: intakes.ai_brief,
      answer_count: intakes.answers,
      patient_id: intakes.patient_id,
      patient_email: profiles.email,
      patient_first: profiles.first_name,
      patient_last: profiles.last_name,
    })
    .from(intakes)
    .leftJoin(patients, eq(intakes.patient_id, patients.id))
    .leftJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(gte(intakes.created_at, since))
    .orderBy(desc(intakes.created_at))

  return NextResponse.json(
    rows.map(r => ({
      intake_id: r.intake_id,
      status: r.intake_status,
      created: r.intake_created,
      submitted: r.intake_submitted,
      has_brief: !!r.has_brief,
      answer_count: r.answer_count ? Object.keys(r.answer_count as object).length : 0,
      patient_id: r.patient_id,
      email: r.patient_email,
      name: r.patient_first ? `${r.patient_first} ${r.patient_last}` : null,
    }))
  )
}
