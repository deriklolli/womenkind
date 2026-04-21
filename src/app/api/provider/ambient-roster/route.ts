import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { appointments, patients, profiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/provider/ambient-roster
 *
 * Returns a deduplicated list of patients for the authenticated provider,
 * built from their appointments. Each entry includes:
 *   { appointmentId, patientId, patientName }
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db
    .select({
      appointmentId: appointments.id,
      patientId: appointments.patient_id,
      firstName: profiles.first_name,
      lastName: profiles.last_name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patient_id, patients.id))
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(appointments.provider_id, session.providerId))
    .orderBy(desc(appointments.starts_at))

  // Deduplicate by patientId, keeping the most recent appointment per patient
  const seen = new Set<string>()
  const roster: { appointmentId: string; patientId: string; patientName: string }[] = []

  for (const row of rows) {
    if (seen.has(row.patientId)) continue
    seen.add(row.patientId)
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown'
    roster.push({
      appointmentId: row.appointmentId,
      patientId: row.patientId,
      patientName: name,
    })
  }

  return NextResponse.json({ roster })
}
