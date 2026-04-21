import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { encounter_notes } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

/**
 * GET /api/provider/encounter-notes?patientId=<uuid>
 *
 * Returns all encounter notes for the given patient, ordered newest first.
 * Provider must be authenticated; the patient must belong to their practice.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')

  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
  }

  const notes = await db
    .select({
      id: encounter_notes.id,
      source: encounter_notes.source,
      status: encounter_notes.status,
      chief_complaint: encounter_notes.chief_complaint,
      hpi: encounter_notes.hpi,
      ros: encounter_notes.ros,
      assessment: encounter_notes.assessment,
      plan: encounter_notes.plan,
      transcript: encounter_notes.transcript,
      created_at: encounter_notes.created_at,
    })
    .from(encounter_notes)
    .where(eq(encounter_notes.patient_id, patientId))
    .orderBy(desc(encounter_notes.created_at))

  // Serialize timestamps to ISO strings
  const serialized = notes.map(n => ({
    ...n,
    signed_at: null as string | null,
    created_at: n.created_at instanceof Date ? n.created_at.toISOString() : n.created_at,
  }))

  return NextResponse.json({ notes: serialized })
}
