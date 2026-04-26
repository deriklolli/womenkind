import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encounter_notes, patients, profiles } from '@/lib/db/schema'
import { and, eq, ilike } from 'drizzle-orm'

export async function GET() {
  const targets = [
    { first: 'Janel', last: 'Ashburn' },
    { first: 'Hilary', last: 'Hays' },
  ]

  const out = []
  for (const t of targets) {
    const profile = await db.query.profiles.findFirst({
      where: and(ilike(profiles.first_name, t.first), ilike(profiles.last_name, t.last)),
      columns: { id: true },
    })
    if (!profile) { out.push({ patient: `${t.first} ${t.last}`, error: 'no profile' }); continue }
    const patient = await db.query.patients.findFirst({
      where: eq(patients.profile_id, profile.id),
      columns: { id: true },
    })
    if (!patient) { out.push({ patient: `${t.first} ${t.last}`, error: 'no patient' }); continue }
    const notes = await db.query.encounter_notes.findMany({
      where: eq(encounter_notes.patient_id, patient.id),
      orderBy: (n, { desc }) => [desc(n.created_at)],
    })
    out.push({
      patient: `${t.first} ${t.last}`,
      patient_id: patient.id,
      notes: notes.map((n) => ({
        id: n.id,
        status: n.status,
        source: n.source,
        created_at: n.created_at,
        chief_complaint_len: n.chief_complaint?.length ?? 0,
        hpi_len: n.hpi?.length ?? 0,
        plan_len: n.plan?.length ?? 0,
        transcript_len: n.transcript?.length ?? 0,
        chief_complaint_preview: n.chief_complaint?.slice(0, 120) ?? null,
      })),
    })
  }

  return NextResponse.json(out)
}
