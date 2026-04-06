import { NextRequest, NextResponse } from 'next/server'
import { disconnectOura } from '@/lib/oura'

/**
 * POST /api/auth/oura/disconnect
 * Disconnects a patient's Oura Ring. Tokens are cleared but historical
 * metric data is preserved (it belongs to the patient).
 */
export async function POST(req: NextRequest) {
  try {
    const { patientId } = await req.json()
    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    await disconnectOura(patientId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Oura disconnect error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
