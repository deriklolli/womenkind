import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { care_presentations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * PATCH /api/presentations/viewed
 * Marks a care presentation as viewed.
 * Body: { presentationId: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { presentationId } = await req.json()

    if (!presentationId) {
      return NextResponse.json({ error: 'presentationId is required' }, { status: 400 })
    }

    if (session.role === 'patient') {
      const pres = await db.query.care_presentations.findFirst({
        where: eq(care_presentations.id, presentationId),
        columns: { patient_id: true }
      })
      if (!pres || pres.patient_id !== session.patientId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await db
      .update(care_presentations)
      .set({ status: 'viewed', viewed_at: new Date() })
      .where(eq(care_presentations.id, presentationId))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Failed to mark presentation viewed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
