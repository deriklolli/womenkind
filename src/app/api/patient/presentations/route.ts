import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { care_presentations } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/patient/presentations
 * Returns all care presentations for the authenticated patient.
 */
export async function GET() {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'patient' || !session.patientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const presentations = await db.query.care_presentations.findMany({
      where: eq(care_presentations.patient_id, session.patientId),
      columns: {
        id: true,
        selected_components: true,
        welcome_message: true,
        status: true,
        viewed_at: true,
        created_at: true,
      },
      orderBy: [desc(care_presentations.created_at)],
    })

    return NextResponse.json({ presentations })
  } catch (err: any) {
    console.error('GET /api/patient/presentations error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
