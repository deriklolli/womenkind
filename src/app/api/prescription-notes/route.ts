import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prescriptionNotes, prescriptions } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/prescription-notes?patientId=xxx
 * Returns all notes for a patient's prescriptions, ordered oldest-first.
 */
export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get('patientId')
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 })

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const notes = await db
      .select()
      .from(prescriptionNotes)
      .where(eq(prescriptionNotes.patient_id, patientId))
      .orderBy(asc(prescriptionNotes.created_at))

    return NextResponse.json(notes)
  } catch (err: any) {
    console.error('Failed to fetch prescription notes:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/prescription-notes
 * Patient adds a note to one of their prescriptions.
 * Body: { prescriptionId, patientId, note }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { prescriptionId, patientId, note } = await req.json()
    if (!prescriptionId || !patientId || !note?.trim()) {
      return NextResponse.json({ error: 'prescriptionId, patientId, and note are required' }, { status: 400 })
    }

    if (session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify the prescription belongs to this patient
    const [rx] = await db
      .select({ id: prescriptions.id })
      .from(prescriptions)
      .where(and(eq(prescriptions.id, prescriptionId), eq(prescriptions.patient_id, patientId)))
      .limit(1)

    if (!rx) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })

    const [created] = await db
      .insert(prescriptionNotes)
      .values({ prescription_id: prescriptionId, patient_id: patientId, note: note.trim() })
      .returning()

    return NextResponse.json(created, { status: 201 })
  } catch (err: any) {
    console.error('Failed to save prescription note:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
