import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles, intakes, care_presentations } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  // Look up user in Supabase auth by email
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: userList } = await supabaseAdmin.auth.admin.listUsers()
  const supabaseUser = userList?.users?.find(u => u.email === email) ?? null

  let rdsProfile = null
  let rdsPatient = null
  let intakeRecord = null
  let presentations: any[] = []

  if (supabaseUser) {
    rdsProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, supabaseUser.id),
    })

    rdsPatient = await db.query.patients.findFirst({
      where: eq(patients.profile_id, supabaseUser.id),
    })

    if (rdsPatient) {
      intakeRecord = await db.query.intakes.findFirst({
        where: eq(intakes.patient_id, rdsPatient.id),
        columns: { id: true, status: true, submitted_at: true },
        orderBy: [desc(intakes.submitted_at)],
      })

      presentations = await db.query.care_presentations.findMany({
        where: eq(care_presentations.patient_id, rdsPatient.id),
        columns: { id: true, status: true, created_at: true },
        orderBy: [desc(care_presentations.created_at)],
      })
    }
  }

  return NextResponse.json({
    email,
    supabaseUser: supabaseUser
      ? { id: supabaseUser.id, email: supabaseUser.email, created_at: supabaseUser.created_at }
      : null,
    rdsProfile: rdsProfile ?? null,
    rdsPatient: rdsPatient ?? null,
    intakeRecord: intakeRecord ?? null,
    presentations,
  })
}
