import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import {
  patients, intakes, visits, subscriptions,
  prescriptions, lab_orders, provider_notes, encounter_notes, wearable_metrics,
} from '@/lib/db/schema'
import { eq, desc, ne, and, sql, gte } from 'drizzle-orm'
import { computeLiveWMI } from '@/lib/wmi-scoring'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const patientId = params.id

  // Fetch patient + profile via relation
  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    columns: {
      id: true,
      profile_id: true,
      date_of_birth: true,
      phone: true,
      state: true,
    },
    with: {
      profiles: {
        columns: {
          first_name: true,
          last_name: true,
          email: true,
        },
      },
    },
  })

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const [
    intakesRows,
    visitsRows,
    subscriptionsRows,
    prescriptionsRows,
    labOrdersRows,
    providerNotesRows,
    encounterNotesCount,
    latestEncounterNote,
  ] = await Promise.all([
    db.query.intakes.findMany({
      where: and(eq(intakes.patient_id, patientId), ne(intakes.status, 'draft')),
      columns: {
        id: true,
        status: true,
        answers: true,
        ai_brief: true,
        wmi_scores: true,
        provider_notes: true,
        submitted_at: true,
        reviewed_at: true,
      },
      orderBy: [desc(intakes.submitted_at)],
    }),

    db.query.visits.findMany({
      where: eq(visits.patient_id, patientId),
      columns: {
        id: true,
        visit_type: true,
        visit_date: true,
        symptom_scores: true,
        source: true,
      },
      orderBy: [desc(visits.visit_date)],
    }),

    db.query.subscriptions.findMany({
      where: eq(subscriptions.patient_id, patientId),
      columns: {
        id: true,
        status: true,
        plan_type: true,
        current_period_end: true,
      },
    }),

    db.query.prescriptions.findMany({
      where: eq(prescriptions.patient_id, patientId),
      columns: {
        id: true,
        medication_name: true,
        dosage: true,
        frequency: true,
        quantity_dispensed: true,
        refills: true,
        status: true,
        prescribed_at: true,
        created_at: true,
      },
      orderBy: [desc(prescriptions.created_at)],
    }),

    db.query.lab_orders.findMany({
      where: eq(lab_orders.patient_id, patientId),
      columns: {
        id: true,
        lab_partner: true,
        tests: true,
        clinical_indication: true,
        status: true,
        ordered_at: true,
        created_at: true,
      },
      orderBy: [desc(lab_orders.created_at)],
    }),

    db.query.provider_notes.findMany({
      where: eq(provider_notes.patient_id, patientId),
      columns: {
        id: true,
        content: true,
        note_type: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [desc(provider_notes.created_at)],
    }),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(encounter_notes)
      .where(
        and(
          eq(encounter_notes.patient_id, patientId),
          ne(encounter_notes.status, 'failed'),
        ),
      )
      .then((rows) => rows[0]?.count ?? 0),

    db.query.encounter_notes.findFirst({
      where: and(
        eq(encounter_notes.patient_id, patientId),
        eq(encounter_notes.status, 'signed'),
      ),
      columns: {
        assessment: true,
        plan: true,
      },
      orderBy: [desc(encounter_notes.created_at)],
    }),
  ])

  // Wearable metrics — last 7 days for live WMI modifiers
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)
  const recentWearables = await db
    .select({ metric_type: wearable_metrics.metric_type, value: wearable_metrics.value, metric_date: wearable_metrics.metric_date })
    .from(wearable_metrics)
    .where(and(
      eq(wearable_metrics.patient_id, patientId),
      gte(wearable_metrics.metric_date, sevenDaysAgoStr)
    ))

  const liveWmi = computeLiveWMI(visitsRows as any, recentWearables)

  return NextResponse.json({
    patient,
    intakes: intakesRows,
    // All visits (incl. daily) so PatientOverview domain cards reflect latest check-in
    visits: visitsRows,
    // Separate filtered list for the provider visits tab
    providerVisits: visitsRows.filter(v => v.source !== 'daily'),
    liveWmi,
    subscriptions: subscriptionsRows,
    prescriptions: prescriptionsRows,
    labOrders: labOrdersRows,
    providerNotes: providerNotesRows,
    encounterNotesCount,
    latestEncounterNote: latestEncounterNote ?? null,
  })
}
