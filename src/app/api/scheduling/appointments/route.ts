import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'
import { eq, and, gte, lte, ne, asc } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/scheduling/appointments?providerId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * GET /api/scheduling/appointments?patientId=xxx
 *
 * Returns appointments for a provider (date range) or patient.
 */
export async function GET(req: NextRequest) {
  try {
    const providerId = req.nextUrl.searchParams.get('providerId')
    const patientId = req.nextUrl.searchParams.get('patientId')
    const startDate = req.nextUrl.searchParams.get('startDate')
    const endDate = req.nextUrl.searchParams.get('endDate')
    const status = req.nextUrl.searchParams.get('status')
    const includeCanceled = req.nextUrl.searchParams.get('includeCanceled') === 'true'

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Patients can only query their own appointments; providers can query any
    if (patientId && session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (providerId && session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conditions = []

    if (providerId) {
      conditions.push(eq(appointments.provider_id, providerId))
    }

    if (patientId) {
      conditions.push(eq(appointments.patient_id, patientId))
    }

    if (startDate) {
      conditions.push(gte(appointments.starts_at, new Date(`${startDate}T00:00:00`)))
    }

    if (endDate) {
      conditions.push(lte(appointments.starts_at, new Date(`${endDate}T23:59:59`)))
    }

    if (status) {
      conditions.push(eq(appointments.status, status))
    } else if (!includeCanceled) {
      // By default, exclude canceled
      conditions.push(ne(appointments.status, 'canceled'))
    }

    const data = await db.query.appointments.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        appointment_types: true,
        patients: {
          with: {
            profiles: true,
            subscriptions: true,
          },
        },
      },
      orderBy: [asc(appointments.starts_at)],
    })

    return NextResponse.json({ appointments: data })
  } catch (err: any) {
    console.error('Failed to fetch appointments:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/scheduling/appointments
 * Update an appointment (mark complete, add notes, etc.)
 *
 * Body: { appointmentId, status?, providerNotes? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    const { appointmentId, status, providerNotes } = await req.json()

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 })
    }

    const updates: Record<string, any> = { updated_at: new Date() }

    if (status) {
      updates.status = status
      if (status === 'completed') {
        updates.completed_at = new Date()
      }
      if (status === 'canceled') {
        updates.canceled_at = new Date()
      }
    }

    if (providerNotes !== undefined) {
      updates.provider_notes = providerNotes
    }

    const [data] = await db
      .update(appointments)
      .set(updates)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.provider_id, session.providerId!)))
      .returning()

    if (!data) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ appointment: data })
  } catch (err: any) {
    console.error('Failed to update appointment:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
