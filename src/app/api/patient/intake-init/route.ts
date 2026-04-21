import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients, intakes } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

/**
 * GET /api/patient/intake-init
 *
 * Returns the patient's ID and any existing draft intake so the intake
 * page can resume mid-flow without querying Supabase tables directly.
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

  // Find existing draft intake
  const draft = await db.query.intakes.findFirst({
    where: and(
      eq(intakes.patient_id, patientId),
      eq(intakes.status, 'draft')
    ),
    columns: { id: true, answers: true },
    orderBy: [desc(intakes.created_at)],
  })

  return NextResponse.json({
    patientId,
    draftIntakeId: draft?.id ?? null,
    draftAnswers: draft?.answers ?? null,
  })
}
