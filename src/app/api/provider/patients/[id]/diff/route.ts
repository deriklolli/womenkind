import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, MD_NP } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { patients, visits, lab_orders, provider_notes } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { computeLiveWMI } from '@/lib/wmi-scoring'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, MD_NP)
  if (roleError) return roleError

  const patientId = params.id

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    columns: { last_md_review_at: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const since = patient.last_md_review_at

  if (!since) {
    return NextResponse.json({ since: null, wmiDelta: null, wmiNow: null, wmiBefore: null, newLabs: 0, latestLabName: null, rnNotes: 0, newMessages: 0 })
  }

  const allVisits = await db.query.visits.findMany({
    where: eq(visits.patient_id, patientId),
    columns: { symptom_scores: true, visit_date: true, source: true },
    orderBy: (v, { desc }) => [desc(v.visit_date)],
  })

  const visitsBefore = allVisits.filter(v => new Date(v.visit_date) <= since)
  const visitsAfter  = allVisits.filter(v => new Date(v.visit_date) > since)
  const wmiNow    = visitsAfter.length  > 0 ? computeLiveWMI(visitsAfter  as Parameters<typeof computeLiveWMI>[0]) : null
  const wmiBefore = visitsBefore.length > 0 ? computeLiveWMI(visitsBefore as Parameters<typeof computeLiveWMI>[0]) : null
  const wmiDelta  = wmiNow != null && wmiBefore != null ? Math.round(wmiNow - wmiBefore) : null

  const [labRows, rnNoteRows] = await Promise.all([
    db.query.lab_orders.findMany({
      where: and(eq(lab_orders.patient_id, patientId), gt(lab_orders.created_at, since)),
      columns: { id: true, tests: true },
    }),
    db.query.provider_notes.findMany({
      where: and(eq(provider_notes.patient_id, patientId), gt(provider_notes.created_at, since)),
      columns: { id: true },
    }),
  ])

  return NextResponse.json({
    since: since.toISOString(),
    wmiDelta,
    wmiNow,
    wmiBefore,
    newLabs: labRows.length,
    latestLabName: (labRows[0]?.tests as { name?: string }[] | null)?.[0]?.name ?? null,
    rnNotes: rnNoteRows.length,
    newMessages: 0,
  })
}
