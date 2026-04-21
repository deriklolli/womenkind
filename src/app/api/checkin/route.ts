import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { logPhiAccess } from '@/lib/phi-audit'
import { db } from '@/lib/db'
import { visits, appointments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/checkin
 * Called when a patient submits their pre-visit symptom check-in.
 *
 * Body: {
 *   appointmentId: string
 *   scores: {
 *     vasomotor: number   // 1–5
 *     sleep: number
 *     energy: number
 *     mood: number
 *     gsm: number
 *     overall: number
 *   }
 * }
 *
 * Creates a visit record linked to the appointment, or updates the
 * existing one if the patient is re-submitting.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { appointmentId, scores } = await req.json()

    if (!appointmentId || !scores) {
      return NextResponse.json(
        { error: 'appointmentId and scores are required' },
        { status: 400 }
      )
    }

    // Validate all 6 domains are present and in range 1–5
    const REQUIRED_DOMAINS = ['vasomotor', 'sleep', 'energy', 'mood', 'gsm', 'overall']
    for (const domain of REQUIRED_DOMAINS) {
      const val = scores[domain]
      if (typeof val !== 'number' || val < 1 || val > 5) {
        return NextResponse.json(
          { error: `Score for "${domain}" must be a number between 1 and 5` },
          { status: 400 }
        )
      }
    }

    // Fetch the appointment to get patient_id and visit_date
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
      columns: { id: true, patient_id: true, provider_id: true, starts_at: true, status: true },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Verify the patient checking in owns this appointment
    if (session.role === 'patient' && session.patientId !== appointment.patient_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (appointment.status === 'canceled') {
      return NextResponse.json({ error: 'Cannot check in for a canceled appointment' }, { status: 400 })
    }

    const now = new Date()
    const visitDate = appointment.starts_at.toISOString().split('T')[0]

    // Upsert: if a visit already exists for this appointment, update it
    const existing = await db.query.visits.findFirst({
      where: eq(visits.appointment_id, appointmentId),
      columns: { id: true },
    })

    let visit
    if (existing) {
      const [updated] = await db.update(visits).set({
        symptom_scores: scores,
        checked_in_at: now,
      }).where(eq(visits.id, existing.id)).returning()

      visit = updated
    } else {
      const [inserted] = await db.insert(visits).values({
        patient_id: appointment.patient_id,
        provider_id: appointment.provider_id,
        appointment_id: appointmentId,
        visit_type: 'follow_up',
        visit_date: visitDate,
        symptom_scores: scores,
        checked_in_at: now,
      }).returning()

      visit = inserted
    }

    logPhiAccess({ providerId: appointment.provider_id, patientId: appointment.patient_id, recordType: 'appointment', recordId: appointmentId, action: 'create', route: '/api/checkin', req })
    return NextResponse.json({ visit }, { status: 200 })
  } catch (err: any) {
    console.error('Check-in error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * GET /api/checkin?appointmentId=xxx
 * Returns the existing check-in for an appointment if one exists.
 * Used by the patient dashboard to know whether to show the check-in prompt.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appointmentId = req.nextUrl.searchParams.get('appointmentId')

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    const appt = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
      columns: { patient_id: true, provider_id: true },
    })
    if (!appt) return NextResponse.json({ checkedIn: false, visit: null })

    if (session.role === 'patient' && appt.patient_id !== session.patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (session.role === 'provider' && appt.provider_id !== session.providerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const visit = await db.query.visits.findFirst({
      where: eq(visits.appointment_id, appointmentId),
      columns: { id: true, checked_in_at: true, symptom_scores: true },
    })

    return NextResponse.json({ checkedIn: !!visit?.checked_in_at, visit })
  } catch (err: any) {
    console.error('Check-in GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
