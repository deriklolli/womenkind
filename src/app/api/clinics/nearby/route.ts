import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export interface NearbyClinic {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string | null
  timezone: string
  distance_miles: number
}

/**
 * GET /api/clinics/nearby?patientId=xxx&radiusMiles=60
 * Looks up the patient's stored home coordinates and runs the
 * get_nearby_clinics Haversine RPC.
 *
 * Returns:
 *   { clinics: NearbyClinic[], hasLocation: boolean }
 *   hasLocation=false means the patient has no coordinates stored yet —
 *   the client should prompt for a zip code first.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const radiusMiles = parseFloat(searchParams.get('radiusMiles') || '60')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Get the patient's profile_id so we can look up their home coordinates
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .select('profile_id')
      .eq('id', patientId)
      .maybeSingle()

    if (patientErr || !patient?.profile_id) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Fetch home coordinates from profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('home_lat, home_lng, home_zip')
      .eq('id', patient.profile_id)
      .maybeSingle()

    if (profileErr) {
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
    }

    // No coordinates stored yet — tell the client to prompt for zip
    if (!profile?.home_lat || !profile?.home_lng) {
      return NextResponse.json({ clinics: [], hasLocation: false })
    }

    // Run the Haversine RPC
    const { data: clinics, error: rpcErr } = await supabase.rpc('get_nearby_clinics', {
      patient_lat: profile.home_lat,
      patient_lng: profile.home_lng,
      radius_miles: radiusMiles,
    })

    if (rpcErr) {
      console.error('[nearby] RPC error:', rpcErr)
      return NextResponse.json({ error: 'Failed to query clinics' }, { status: 500 })
    }

    return NextResponse.json({
      clinics: (clinics || []) as NearbyClinic[],
      hasLocation: true,
    })
  } catch (err: any) {
    console.error('[nearby] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
