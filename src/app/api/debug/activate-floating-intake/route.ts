import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { intakes, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateClinicalBrief } from '@/lib/intake-brief'
import { computeWMI } from '@/lib/wmi-scoring'
import crypto from 'crypto'

/**
 * POST /api/debug/activate-floating-intake
 *
 * For intakes submitted without an account (direct-to-intake flow).
 * Given an intakeId:
 *  1. Reads name/email from intake answers
 *  2. Creates Supabase auth user (email pre-confirmed, random temp password)
 *  3. Creates profiles + patients rows in RDS
 *  4. Links intake to new patient
 *  5. Marks intake submitted + generates AI brief
 */
export async function POST(req: NextRequest) {
  const { secret, intakeId } = await req.json()
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!intakeId) {
    return NextResponse.json({ error: 'intakeId required' }, { status: 400 })
  }

  // 1. Load intake
  const intake = await db.query.intakes.findFirst({
    where: eq(intakes.id, intakeId),
  })
  if (!intake) return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  if (intake.patient_id) return NextResponse.json({ error: 'Intake already linked to patient', patient_id: intake.patient_id }, { status: 409 })

  const answers = intake.answers as Record<string, any>
  const email = answers.email as string
  const fullName = (answers.full_name as string) ?? ''
  const [firstName, ...rest] = fullName.trim().split(' ')
  const lastName = rest.join(' ') || ''
  const dob = answers.dob as string | undefined

  if (!email) return NextResponse.json({ error: 'No email in intake answers' }, { status: 400 })

  // 2. Create Supabase auth user
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const tempPassword = crypto.randomBytes(20).toString('hex')
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, role: 'patient' },
  })

  if (authError) {
    return NextResponse.json({ error: `Auth user creation failed: ${authError.message}` }, { status: 400 })
  }

  const userId = authData.user.id

  // 3. Create RDS profile + patient
  await db.insert(profiles).values({
    id: userId,
    first_name: firstName,
    last_name: lastName,
    email: email.toLowerCase(),
  })

  const [newPatient] = await db.insert(patients).values({
    profile_id: userId,
    date_of_birth: dob ?? null,
    is_active: true,
  }).returning({ id: patients.id })

  // 4. Link intake to patient + mark submitted
  await db.update(intakes)
    .set({
      patient_id: newPatient.id,
      status: 'submitted',
      submitted_at: new Date(),
    })
    .where(eq(intakes.id, intakeId))

  // 5. Compute WMI + generate brief using the canonical pipeline
  const wmiScores = computeWMI(answers)
  const brief = await generateClinicalBrief(answers, wmiScores)
  await db.update(intakes).set({ ai_brief: brief, wmi_scores: wmiScores }).where(eq(intakes.id, intakeId))

  // 6. Send password reset so she can log in
  await adminClient.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://www.womenkindhealth.com/patient/dashboard',
  })

  return NextResponse.json({
    ok: true,
    message: 'Account created, intake linked, brief generated, password reset sent',
    userId,
    patientId: newPatient.id,
    intakeId,
    email,
    name: fullName,
  })
}
