import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { lab_orders } from '@/lib/db/schema'
import { sendLabOrder } from '@/lib/canvas-client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      patientId,
      providerId,
      labPartner,
      tests,
      clinicalIndication,
      visitId,
    } = body

    if (!patientId || !tests || tests.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Send via Canvas (mocked)
    const result = await sendLabOrder({
      patientId,
      providerId,
      labPartner: labPartner || 'quest',
      tests,
      clinicalIndication: clinicalIndication || '',
    })

    const [data] = await db
      .insert(lab_orders)
      .values({
        patient_id: patientId,
        provider_id: providerId || null,
        visit_id: visitId || null,
        canvas_order_id: result.canvasOrderId,
        lab_partner: labPartner || 'quest',
        tests,
        clinical_indication: clinicalIndication || '',
        status: 'sent',
        ordered_at: result.sentAt,
      })
      .returning()

    return NextResponse.json({ labOrder: data, canvas: result })
  } catch (err: any) {
    console.error('Lab order error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send lab order' }, { status: 500 })
  }
}
