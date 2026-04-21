import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { refill_requests, prescriptions, patients, profiles } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/refill-requests?patientId=xxx  — patient's own requests
 * GET /api/refill-requests?providerId=xxx — provider's queue
 * GET /api/refill-requests?providerId=xxx&status=pending — filtered
 */
export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get('patientId')
    const providerId = req.nextUrl.searchParams.get('providerId')
    const status = req.nextUrl.searchParams.get('status')

    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (patientId && session.role !== 'provider' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (providerId && session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build conditions array
    const conditions = []
    if (patientId) conditions.push(eq(refill_requests.patient_id, patientId))
    if (providerId) conditions.push(eq(refill_requests.provider_id, providerId))
    if (status) conditions.push(eq(refill_requests.status, status))

    const data = await db
      .select({
        id: refill_requests.id,
        prescription_id: refill_requests.prescription_id,
        patient_id: refill_requests.patient_id,
        provider_id: refill_requests.provider_id,
        patient_note: refill_requests.patient_note,
        provider_note: refill_requests.provider_note,
        status: refill_requests.status,
        reviewed_at: refill_requests.reviewed_at,
        updated_at: refill_requests.updated_at,
        created_at: refill_requests.created_at,
        // prescription fields
        medication_name: prescriptions.medication_name,
        dosage: prescriptions.dosage,
        frequency: prescriptions.frequency,
        // patient/profile fields
        patient_profile_id: patients.profile_id,
        first_name: profiles.first_name,
        last_name: profiles.last_name,
        email: profiles.email,
      })
      .from(refill_requests)
      .leftJoin(prescriptions, eq(refill_requests.prescription_id, prescriptions.id))
      .leftJoin(patients, eq(refill_requests.patient_id, patients.id))
      .leftJoin(profiles, eq(patients.profile_id, profiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(refill_requests.created_at))

    // Shape response to match original nested structure
    const refillRequests = data.map((row) => ({
      id: row.id,
      prescription_id: row.prescription_id,
      patient_id: row.patient_id,
      provider_id: row.provider_id,
      patient_note: row.patient_note,
      provider_note: row.provider_note,
      status: row.status,
      reviewed_at: row.reviewed_at,
      updated_at: row.updated_at,
      created_at: row.created_at,
      prescriptions: {
        medication_name: row.medication_name,
        dosage: row.dosage,
        frequency: row.frequency,
      },
      patients: {
        id: row.patient_id,
        profiles: {
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
        },
      },
    }))

    return NextResponse.json({ refillRequests })
  } catch (err: any) {
    console.error('Failed to fetch refill requests:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/refill-requests
 * Patient submits a new refill request.
 * Body: { prescriptionId, patientId, providerId, patientNote? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'patient') {
      return NextResponse.json({ error: 'Forbidden — patients only' }, { status: 403 })
    }
    const patientId = session.patientId!

    const { prescriptionId, providerId, patientNote } = await req.json()

    if (!prescriptionId || !providerId) {
      return NextResponse.json(
        { error: 'prescriptionId and providerId are required' },
        { status: 400 }
      )
    }

    // Check for existing pending request for this prescription
    const existing = await db
      .select({ id: refill_requests.id })
      .from(refill_requests)
      .where(
        and(
          eq(refill_requests.prescription_id, prescriptionId),
          eq(refill_requests.status, 'pending')
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A pending refill request already exists for this prescription', existingId: existing[0].id },
        { status: 409 }
      )
    }

    const [data] = await db
      .insert(refill_requests)
      .values({
        prescription_id: prescriptionId,
        patient_id: patientId,
        provider_id: providerId,
        patient_note: patientNote || null,
        status: 'pending',
      })
      .returning()

    return NextResponse.json({ refillRequest: data })
  } catch (err: any) {
    console.error('Failed to create refill request:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/refill-requests
 * Provider approves or denies a refill request.
 * Body: { requestId, status: 'approved' | 'denied', providerNote? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    const { requestId, status, providerNote } = await req.json()

    if (!requestId || !status) {
      return NextResponse.json({ error: 'requestId and status are required' }, { status: 400 })
    }

    if (!['approved', 'denied'].includes(status)) {
      return NextResponse.json({ error: 'status must be approved or denied' }, { status: 400 })
    }

    // Update the refill request
    const [request] = await db
      .update(refill_requests)
      .set({
        status,
        provider_note: providerNote || null,
        reviewed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(refill_requests.id, requestId))
      .returning()

    if (!request) {
      return NextResponse.json({ error: 'Refill request not found' }, { status: 404 })
    }

    // If approved, fetch prescription and update it
    if (status === 'approved') {
      const [rx] = await db
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.id, request.prescription_id))
        .limit(1)

      if (rx) {
        const newRefillsUsed = (rx.refills_used || 0) + 1
        const now = new Date()
        const daysSupply = Math.ceil((rx.quantity_dispensed || 30) / (rx.doses_per_day || 1))
        const newRunsOutAt = new Date(now.getTime() + daysSupply * 24 * 60 * 60 * 1000)

        await db
          .update(prescriptions)
          .set({
            refills_used: newRefillsUsed,
            last_filled_at: now,
            runs_out_at: newRunsOutAt,
            updated_at: now,
          })
          .where(eq(prescriptions.id, rx.id))
      }
    }

    return NextResponse.json({ refillRequest: request })
  } catch (err: any) {
    console.error('Failed to update refill request:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
