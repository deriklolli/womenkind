import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
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

    // Save to Supabase
    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({
        patient_id: patientId,
        provider_id: session.providerId || null,
        visit_id: visitId || null,
        canvas_prescription_id: result.canvasPrescriptionId,
        medication_name: medicationName,
        dosage,
        frequency,
        quantity: quantity || 30,
        refills: refills || 0,
        pharmacy: pharmacy || '',
        status: 'sent',
        prescribed_at: result.sentAt,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ prescription: data, canvas: result })
  } catch (err: any) {
    console.error('Prescribe error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send prescription' }, { status: 500 })
  }
}
