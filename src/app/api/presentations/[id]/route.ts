import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { care_presentations, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/presentations/[id]
 * Returns a care presentation and the patient's name.
 * No auth required — presentations are shared via link.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const presentation = await db.query.care_presentations.findFirst({
      where: eq(care_presentations.id, params.id),
    })

    if (!presentation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Get patient name via patients → profiles
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, presentation.patient_id),
      columns: { profile_id: true },
    })

    let patientName = 'there'
    if (patient?.profile_id) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, patient.profile_id),
        columns: { first_name: true, last_name: true },
      })
      if (profile?.first_name) {
        patientName = profile.first_name
      }
    }

    return NextResponse.json({ presentation, patientName })
  } catch (err: any) {
    console.error('GET /api/presentations/[id] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/presentations/[id]
 * Updates status and viewed_at on a presentation.
 * Body: { status: string, viewed_at?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { status, viewed_at } = body

    await db
      .update(care_presentations)
      .set({
        status,
        ...(viewed_at ? { viewed_at: new Date(viewed_at) } : {}),
      })
      .where(eq(care_presentations.id, params.id))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PATCH /api/presentations/[id] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
