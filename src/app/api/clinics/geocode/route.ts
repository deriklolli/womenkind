import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * POST /api/clinics/geocode
 * Converts a US zip code to lat/lng using OpenStreetMap Nominatim (no API key required).
 * Stores the result on profiles.home_lat, profiles.home_lng, profiles.home_zip.
 *
 * Body: { patientId: string, zip: string }
 * Returns: { lat: number, lng: number } or { error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { patientId, zip } = await req.json()

    if (!patientId || !zip) {
      return NextResponse.json({ error: 'patientId and zip are required' }, { status: 400 })
    }

    if (session.role === 'patient' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const cleanZip = String(zip).trim().slice(0, 10)

    // Geocode via OpenStreetMap Nominatim — free, no API key
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleanZip)}&country=US&format=json&limit=1`,
      {
        headers: {
          // Nominatim requires a User-Agent identifying the application
          'User-Agent': 'Womenkind/1.0 (womenkindhealth.com)',
          Accept: 'application/json',
        },
      }
    )

    if (!geoRes.ok) {
      return NextResponse.json({ error: 'Geocoding request failed' }, { status: 502 })
    }

    const geoData = await geoRes.json()
    if (!geoData || geoData.length === 0) {
      return NextResponse.json({ error: 'Zip code not found' }, { status: 404 })
    }

    const lat = parseFloat(geoData[0].lat)
    const lng = parseFloat(geoData[0].lon)

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates returned' }, { status: 502 })
    }

    // Look up the profile_id for this patient
    const patientRows = await db
      .select({ profile_id: patients.profile_id })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1)

    const patient = patientRows[0]
    if (!patient?.profile_id) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Store coordinates + zip on the patient's profile
    await db
      .update(profiles)
      .set({ home_lat: lat, home_lng: lng, home_zip: cleanZip })
      .where(eq(profiles.id, patient.profile_id))

    return NextResponse.json({ lat, lng })
  } catch (err: any) {
    console.error('[geocode] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
