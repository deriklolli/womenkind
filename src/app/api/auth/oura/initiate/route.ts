import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { buildOuraOAuthUrl } from '@/lib/oura'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * POST /api/auth/oura/initiate
 * Starts the Oura OAuth flow for a patient to connect their ring.
 * Returns the URL to redirect the patient to Oura's consent screen.
 */
export async function POST(req: NextRequest) {
  try {
    const { patientId } = await req.json()
    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    // Verify this is a real patient
    const supabase = getSupabase()
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Generate CSRF state token that encodes the patient ID
    const statePayload = JSON.stringify({
      patientId,
      nonce: crypto.randomBytes(16).toString('hex'),
    })
    const state = Buffer.from(statePayload).toString('base64url')

    const url = buildOuraOAuthUrl(state)

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('Oura OAuth initiate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
