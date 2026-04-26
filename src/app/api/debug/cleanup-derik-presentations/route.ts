import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { care_presentations, patients, profiles } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

/**
 * POST /api/debug/cleanup-derik-presentations
 * Deletes the 5 oldest care_presentations for dlolli@gmail.com (test account).
 * Always preserves the most recent presentation.
 */
export async function POST() {
  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.email, 'dlolli@gmail.com'),
      columns: { id: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found for dlolli@gmail.com' }, { status: 404 })
    }

    const patient = await db.query.patients.findFirst({
      where: eq(patients.profile_id, profile.id),
      columns: { id: true },
    })
    if (!patient) {
      return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })
    }

    const all = await db.query.care_presentations.findMany({
      where: eq(care_presentations.patient_id, patient.id),
      orderBy: (p, { desc }) => [desc(p.created_at)],
      columns: { id: true, created_at: true },
    })

    if (all.length <= 1) {
      return NextResponse.json({
        ok: true,
        message: `Only ${all.length} presentation(s) exist; nothing to delete.`,
        kept: all.map((p) => ({ id: p.id, created_at: p.created_at })),
        deleted: [],
      })
    }

    // Keep the most recent, delete up to 5 of the oldest
    const candidates = all.slice(1) // skip newest
    const toDelete = candidates.slice(-5).map((p) => ({ id: p.id, created_at: p.created_at }))
    const kept = all.filter((p) => !toDelete.find((d) => d.id === p.id))

    if (toDelete.length) {
      await db
        .delete(care_presentations)
        .where(inArray(care_presentations.id, toDelete.map((p) => p.id)))
    }

    return NextResponse.json({
      ok: true,
      patient_id: patient.id,
      total_before: all.length,
      total_after: all.length - toDelete.length,
      deleted: toDelete,
      kept: kept.map((p) => ({ id: p.id, created_at: p.created_at })),
    })
  } catch (err: unknown) {
    console.error('cleanup-derik-presentations error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
