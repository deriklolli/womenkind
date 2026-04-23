import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { profiles, patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/auth/create-patient
 * Creates a profiles + patient record for an authenticated user if they don't exist.
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

    if (userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch user metadata from Supabase to populate the profile
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    const meta = user?.user_metadata || {}

    // Ensure profiles row exists in RDS (foreign key parent of patients)
    await db.insert(profiles).values({
      id: userId,
      first_name: meta.first_name || null,
      last_name: meta.last_name || null,
      email: user?.email || null,
    }).onConflictDoNothing()

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
