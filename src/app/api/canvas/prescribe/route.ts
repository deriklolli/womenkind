import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prescriptions, appointments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { sendPrescription } from '@/lib/canvas-client'

export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    const body = await request.json()
    const {
      patientId,
      medicationName,
      dosage,
      frequency,
      quantity,
      refills,
      pharmacy,
      visitId,
    } = body

    if (!patientId || !medicationName || !dosage || !frequency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the provider has a care relationship with this patient
    const [relationship] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.provider_id, session.providerId!),
          eq(appointments.patient_id, patientId)
        )
      )
      .limit(1)

    if (!relationship) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Send via Canvas (mocked)
    const result = await sendPrescription({
      patientId,
      providerId: session.providerId!,
      medicationName,
      dosage,
      frequency,
      quantity: quantity || 30,
      refills: refills || 0,
      pharmacy: pharmacy || '',
    })

    // NOTE: canvas_prescription_id, visit_id, and pharmacy are not in the Drizzle
    // prescriptions schema. Insert what the schema supports.
    const [data] = await db
      .insert(prescriptions)
      .values({
        patient_id: patientId,
        provider_id: session.providerId!,
        medication_name: medicationName,
        dosage,
        frequency,
        quantity_dispensed: quantity || 30,
        refills: refills || 0,
        status: 'active',
        prescribed_at: new Date(result.sentAt),
      })
      .returning()

    return NextResponse.json({ prescription: data, canvas: result })
  } catch (err: any) {
    console.error('Prescribe error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send prescription' }, { status: 500 })
  }
}
