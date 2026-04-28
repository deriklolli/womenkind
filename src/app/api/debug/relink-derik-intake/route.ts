import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intakes, patients, profiles } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

/**
 * POST /api/debug/relink-derik-intake
 *
 * Finds any submitted/reviewed intake where answers->>'email' = 'dlolli@gmail.com'
 * that is NOT already linked to Derik's real patient record, then re-links it.
 *
 * Also wipes the orphaned draft intake (2 answers) so the provider portal
 * shows the real intake first.
 */
export async function POST() {
  // 1. Resolve Derik's real patient_id via profile
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.email, 'dlolli@gmail.com'),
    columns: { id: true },
  })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const patient = await db.query.patients.findFirst({
    where: eq(patients.profile_id, profile.id),
    columns: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const realPatientId = patient.id

  // 2. Find ALL intakes where answers->>'email' = 'dlolli@gmail.com'
  const candidates = await db
    .select({
      id: intakes.id,
      patient_id: intakes.patient_id,
      status: intakes.status,
      submitted_at: intakes.submitted_at,
      has_ai_brief: sql<boolean>`(ai_brief IS NOT NULL)`,
    })
    .from(intakes)
    .where(sql`answers->>'email' = 'dlolli@gmail.com'`)

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No intakes found with email=dlolli@gmail.com in answers' }, { status: 404 })
  }

  // 3. Find the "real" intake: has ai_brief, or is submitted/reviewed
  const real = candidates
    .filter(c => c.has_ai_brief || c.status === 'submitted' || c.status === 'reviewed')
    .sort((a, b) => {
      // prefer has_ai_brief, then submitted/reviewed, then most recent
      if (a.has_ai_brief && !b.has_ai_brief) return -1
      if (!a.has_ai_brief && b.has_ai_brief) return 1
      return 0
    })[0] ?? candidates[0]

  const orphanDrafts = candidates.filter(c => c.id !== real.id && c.patient_id !== realPatientId)

  // 4. Re-link real intake to Derik's patient if needed
  let relinked = false
  if (real.patient_id !== realPatientId) {
    await db.update(intakes).set({ patient_id: realPatientId }).where(eq(intakes.id, real.id))
    relinked = true
  }

  // 5. Delete orphaned draft intakes already on Derik's patient (the 2-answer one)
  const draftsOnReal = await db
    .select({ id: intakes.id })
    .from(intakes)
    .where(
      sql`patient_id = ${realPatientId} AND id != ${real.id} AND status = 'draft'`
    )

  let deletedDrafts: string[] = []
  for (const d of draftsOnReal) {
    await db.delete(intakes).where(eq(intakes.id, d.id))
    deletedDrafts.push(d.id)
  }

  return NextResponse.json({
    ok: true,
    realPatientId,
    realIntake: {
      id: real.id,
      status: real.status,
      has_ai_brief: real.has_ai_brief,
      previously_linked_to: real.patient_id,
    },
    relinked,
    deletedDrafts,
    allCandidates: candidates.map(c => ({ id: c.id, patient_id: c.patient_id, status: c.status, has_ai_brief: c.has_ai_brief })),
  })
}
