import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import {
  profiles, patients, appointments, visits, encounter_notes,
  intakes, prescriptions, refill_requests, messages, notifications,
  subscriptions, clinic_appointment_requests, phi_access_log,
  lab_orders, provider_notes, patient_wearable_connections,
  wearable_metrics, wearable_sync_log, care_presentations,
  engagement_log, notification_preferences,
} from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'

/**
 * DELETE /api/debug/cleanup-test-patient?email=...
 *
 * Removes a test patient and all linked records from RDS + Supabase auth.
 * Only available when ENABLE_TEST_ROUTES=true. Idempotent — no-op if not found.
 */
export async function DELETE(req: NextRequest) {
  if (process.env.ENABLE_TEST_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const patientRow = await db
    .select({ patientId: patients.id, profileId: patients.profile_id })
    .from(patients)
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(profiles.email, email))
    .limit(1)

  const row = patientRow[0]
  if (!row) {
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  const { patientId, profileId } = row

  await db.delete(notification_preferences).where(eq(notification_preferences.patient_id, patientId))
  await db.delete(engagement_log).where(eq(engagement_log.patient_id, patientId))
  await db.delete(care_presentations).where(eq(care_presentations.patient_id, patientId))
  await db.delete(wearable_metrics).where(eq(wearable_metrics.patient_id, patientId))
  const connections = await db.query.patient_wearable_connections.findMany({
    where: eq(patient_wearable_connections.patient_id, patientId),
    columns: { id: true },
  })
  if (connections.length > 0) {
    await db.delete(wearable_sync_log).where(inArray(wearable_sync_log.connection_id, connections.map(c => c.id)))
  }
  await db.delete(patient_wearable_connections).where(eq(patient_wearable_connections.patient_id, patientId))
  await db.delete(lab_orders).where(eq(lab_orders.patient_id, patientId))
  await db.delete(provider_notes).where(eq(provider_notes.patient_id, patientId))
  await db.delete(phi_access_log).where(eq(phi_access_log.patient_id, patientId))
  await db.delete(clinic_appointment_requests).where(eq(clinic_appointment_requests.patient_id, patientId))
  await db.delete(notifications).where(eq(notifications.patient_id, patientId))
  await db.delete(messages).where(eq(messages.sender_id, profileId))
  await db.delete(messages).where(eq(messages.recipient_id, profileId))
  await db.delete(refill_requests).where(eq(refill_requests.patient_id, patientId))
  await db.delete(prescriptions).where(eq(prescriptions.patient_id, patientId))
  await db.delete(encounter_notes).where(eq(encounter_notes.patient_id, patientId))
  await db.delete(visits).where(eq(visits.patient_id, patientId))
  await db.delete(appointments).where(eq(appointments.patient_id, patientId))
  await db.delete(intakes).where(eq(intakes.patient_id, patientId))
  await db.delete(subscriptions).where(eq(subscriptions.patient_id, patientId))
  await db.delete(patients).where(eq(patients.id, patientId))
  await db.delete(profiles).where(eq(profiles.id, profileId))

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profileId)

  return NextResponse.json({ ok: true, deleted: 1, authError: authError?.message ?? null })
}
