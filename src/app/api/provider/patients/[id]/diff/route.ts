import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients, visits, prescription_changes } from '@/lib/db/schema'
import { and, eq, gte } from 'drizzle-orm'
import { computeLiveWMI } from '@/lib/wmi-scoring'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, params.id),
    columns: { last_md_review_at: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const since = patient.last_md_review_at ?? new Date(0)

  const [wmiVisits, rxChanges] = await Promise.all([
    // Recent daily check-ins for WMI delta
    db.query.visits.findMany({
      where: and(eq(visits.patient_id, params.id), gte(visits.created_at, since)),
      columns: { symptom_scores: true, visit_date: true, source: true, checked_in_at: true },
      orderBy: (v, { asc }) => [asc(v.visit_date)],
      limit: 50,
    }),
    // Prescription changes since last review
    db.query.prescription_changes.findMany({
      where: and(
        eq(prescription_changes.patient_id, params.id),
        gte(prescription_changes.created_at, since),
      ),
      orderBy: (r, { desc }) => [desc(r.created_at)],
    }),
  ])

  // Compute WMI delta: compare earliest vs latest daily check-in since review
  const dailyVisits = wmiVisits
    .filter(v => v.source === 'daily' && v.symptom_scores != null)
    .map(v => ({
      symptom_scores: v.symptom_scores as Record<string, number> | null,
      visit_date: v.visit_date,
      source: v.source,
      checked_in_at: v.checked_in_at,
    }))

  let wmiDelta: { from: number | null; to: number | null; delta: number | null } | null = null

  if (dailyVisits.length >= 2) {
    // Sorted ascending by visit_date — earliest is [0], latest is [last]
    const earliest = [dailyVisits[0]]
    const latest = [dailyVisits[dailyVisits.length - 1]]
    const fromWmi = computeLiveWMI(earliest)
    const toWmi = computeLiveWMI(latest)
    wmiDelta = {
      from: fromWmi,
      to: toWmi,
      delta: fromWmi != null && toWmi != null ? toWmi - fromWmi : null,
    }
  } else if (dailyVisits.length === 1) {
    const toWmi = computeLiveWMI(dailyVisits)
    wmiDelta = { from: null, to: toWmi, delta: null }
  }

  return NextResponse.json({
    since: patient.last_md_review_at,
    wmiDelta,
    rxChanges,
    messageCount: 0, // messages table has no patient_id column; wire up when available
    rnNotes: [],     // no rn_note source in visits yet
  })
}
