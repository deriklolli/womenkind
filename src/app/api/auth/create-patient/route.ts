import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/auth/create-patient
 * Creates a patient record for an authenticated user if one doesn't exist.
 * Called after email verification on the /signup/verified page.
 * Body: { userId: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // A user can only create a patient record for themselves
    if (userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if patient record already exists
    const existing = await db.query.patients.findFirst({
      where: eq(patients.profile_id, userId),
    })

    if (existing) {
      return NextResponse.json({ patientId: existing.id })
    }

    // Create patient record
    const [patient] = await db
      .insert(patients)
      .values({ profile_id: userId })
      .returning({ id: patients.id })

    return NextResponse.json({ patientId: patient.id })
  } catch (err: any) {
    console.error('Create patient error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
