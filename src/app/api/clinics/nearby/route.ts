import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

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
 * get_nearby_clinics Haversine stored procedure.
 *
 * Returns:
 *   { clinics: NearbyClinic[], hasLocation: boolean }
 *   hasLocation=false means the patient has no coordinates stored yet —
 *   the client should prompt for a zip code first.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get('patientId')
    const radiusMiles = parseFloat(searchParams.get('radiusMiles') || '60')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    if (session.role === 'patient' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the patient's profile_id so we can look up their home coordinates
    const patientRows = await db
      .select({ profile_id: patients.profile_id })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1)

    const patient = patientRows[0]
    if (!patient?.profile_id) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Fetch home coordinates from profile
    const profileRows = await db
      .select({
        home_lat: profiles.home_lat,
        home_lng: profiles.home_lng,
        home_zip: profiles.home_zip,
      })
      .from(profiles)
      .where(eq(profiles.id, patient.profile_id))
      .limit(1)

    const profile = profileRows[0]

    // No coordinates stored yet — tell the client to prompt for zip
    if (!profile?.home_lat || !profile?.home_lng) {
      return NextResponse.json({ clinics: [], hasLocation: false })
    }

    const lat = profile.home_lat
    const lng = profile.home_lng

    // Run the Haversine stored procedure
    const rows = await db.execute(
      sql`SELECT * FROM get_nearby_clinics(${lat}, ${lng}, ${radiusMiles})`
    )

    return NextResponse.json({
      clinics: Array.from(rows) as NearbyClinic[],
      hasLocation: true,
    })
  } catch (err: any) {
    console.error('[nearby] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
