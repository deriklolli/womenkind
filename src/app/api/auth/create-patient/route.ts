import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

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
    const supabase = getSupabase()
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // A user can only create a patient record for themselves
    if (userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if patient record already exists
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ patientId: existing.id })
    }

    // Create patient record
    const { data: patient, error } = await supabase
      .from('patients')
      .insert({ profile_id: userId })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ patientId: patient.id })
  } catch (err: any) {
    console.error('Create patient error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
