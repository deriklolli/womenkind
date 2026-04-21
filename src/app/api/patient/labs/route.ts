import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

/**
 * GET /api/patient/labs?patientId=<uuid>
 *
 * Returns lab_orders for the given patient from RDS via Drizzle.
 * Requires the caller to be authenticated as that patient (or as a provider).
 * results is a json column not yet in the Drizzle schema — fetched via raw SQL.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')

  if (!patientId) {
    return NextResponse.json({ error: 'patientId required' }, { status: 400 })
  }

  // Patients can only fetch their own labs; providers can fetch any
  if (session.role === 'patient' && session.patientId !== patientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db.execute(sql`
    SELECT
      id,
      lab_partner,
      tests,
      clinical_indication,
      status,
      ordered_at,
      created_at
    FROM lab_orders
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
  `)

  return NextResponse.json({ labOrders: rows })
}
