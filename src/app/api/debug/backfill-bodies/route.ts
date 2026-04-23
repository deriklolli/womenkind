import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

import { db } from '@/lib/db'
import { patients, profiles, intakes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'
import { generateComponentBodies } from '@/lib/intake-component-bodies'
import { generateClinicalBrief } from '@/lib/intake-brief'

/**
 * GET /api/debug/backfill-bodies?email=<patient_email>[&force=1]
 *
 * Dev/debug backfill: generates all 10 personalized component body paragraphs
 * for a patient's latest intake and stores them in ai_brief.component_bodies.
 * Used to retrofit intakes submitted before pre-generation was wired up.
 */
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')
    const force = req.nextUrl.searchParams.get('force') === '1'
    if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers()
    const supabaseUser = userList?.users?.find((u) => u.email === email) ?? null
    if (!supabaseUser) return NextResponse.json({ error: 'Supabase user not found' }, { status: 404 })

    const rdsProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, supabaseUser.id) })
    if (!rdsProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const rdsPatient = await db.query.patients.findFirst({ where: eq(patients.profile_id, rdsProfile.id) })
    if (!rdsPatient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    const intakeRow = await db.query.intakes.findFirst({
      where: eq(intakes.patient_id, rdsPatient.id),
      orderBy: (intakes, { desc }) => [desc(intakes.submitted_at)],
    })
    if (!intakeRow) return NextResponse.json({ error: 'No intake for patient' }, { status: 404 })

    let aiBrief = intakeRow.ai_brief as any
    let briefGenerated = false
    if (!aiBrief) {
      aiBrief = await generateClinicalBrief(intakeRow.answers as Record<string, any>)
      await db.update(intakes).set({ ai_brief: aiBrief }).where(eq(intakes.id, intakeRow.id))
      briefGenerated = true
    }

    const existing = aiBrief.component_bodies
    if (existing && Object.keys(existing).length >= 10 && !force) {
      return NextResponse.json({
        skipped: true,
        reason: 'Bodies already exist. Add &force=1 to regenerate.',
        count: Object.keys(existing).length,
        keys: Object.keys(existing),
      })
    }

    const answers = (intakeRow.answers as Record<string, any>) || {}
    const bodies = await generateComponentBodies(answers, aiBrief, rdsProfile.first_name)

    const merged = { ...aiBrief, component_bodies: bodies }
    await db.update(intakes).set({ ai_brief: merged }).where(eq(intakes.id, intakeRow.id))

    return NextResponse.json({
      success: true,
      briefGenerated,
      patientId: rdsPatient.id,
      intakeId: intakeRow.id,
      count: Object.keys(bodies).length,
      keys: Object.keys(bodies),
      // Short preview so we can eyeball voice without pulling the whole thing
      preview: Object.fromEntries(
        Object.entries(bodies).map(([k, v]) => [k, (v as string).slice(0, 180) + '…'])
      ),
    })
  } catch (err: any) {
    console.error('Debug backfill error:', err)
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 })
  }
}
