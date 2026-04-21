import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await db.query.patients.findMany({
    orderBy: [desc(patients.created_at)],
    columns: {
      id: true,
      profile_id: true,
      date_of_birth: true,
      phone: true,
      state: true,
    },
    with: {
      profiles: {
        columns: { first_name: true, last_name: true, email: true },
      },
      intakes: {
        columns: { id: true, status: true, ai_brief: true, submitted_at: true },
      },
      visits: {
        columns: { id: true, visit_type: true, visit_date: true },
      },
      subscriptions: {
        columns: { status: true, plan_type: true },
      },
    },
  })

  return NextResponse.json({ patients: rows })
}
