import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { patientIds } = await req.json()
  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    return NextResponse.json({ error: 'patientIds array required' }, { status: 400 })
  }

  // Collect profile_ids so we can delete from Supabase auth
  const patientRows = await db.query.patients.findMany({
    where: inArray(patients.id, patientIds),
    columns: { id: true, profile_id: true },
  })
  const profileIds = patientRows.map(p => p.profile_id)

  // Delete all patient-linked records in dependency order
  await db.delete(notification_preferences).where(inArray(notification_preferences.patient_id, patientIds))
  await db.delete(engagement_log).where(inArray(engagement_log.patient_id, patientIds))
  await db.delete(care_presentations).where(inArray(care_presentations.patient_id, patientIds))
  await db.delete(wearable_metrics).where(inArray(wearable_metrics.patient_id, patientIds))
  // wearable_sync_log links via connection_id — delete connections first, log cascades
  const connections = await db.query.patient_wearable_connections.findMany({
    where: inArray(patient_wearable_connections.patient_id, patientIds),
    columns: { id: true },
  })
  if (connections.length > 0) {
    await db.delete(wearable_sync_log).where(inArray(wearable_sync_log.connection_id, connections.map(c => c.id)))
  }
  await db.delete(patient_wearable_connections).where(inArray(patient_wearable_connections.patient_id, patientIds))
  await db.delete(lab_orders).where(inArray(lab_orders.patient_id, patientIds))
  await db.delete(provider_notes).where(inArray(provider_notes.patient_id, patientIds))
  await db.delete(phi_access_log).where(inArray(phi_access_log.patient_id, patientIds))
  await db.delete(clinic_appointment_requests).where(inArray(clinic_appointment_requests.patient_id, patientIds))
  await db.delete(notifications).where(inArray(notifications.patient_id, patientIds))
  // messages links via sender_id/recipient_id (profile IDs, not patient IDs)
  await db.delete(messages).where(inArray(messages.sender_id, profileIds))
  await db.delete(messages).where(inArray(messages.recipient_id, profileIds))
  await db.delete(refill_requests).where(inArray(refill_requests.patient_id, patientIds))
  await db.delete(prescriptions).where(inArray(prescriptions.patient_id, patientIds))
  await db.delete(encounter_notes).where(inArray(encounter_notes.patient_id, patientIds))
  await db.delete(visits).where(inArray(visits.patient_id, patientIds))
  await db.delete(appointments).where(inArray(appointments.patient_id, patientIds))
  await db.delete(intakes).where(inArray(intakes.patient_id, patientIds))
  await db.delete(subscriptions).where(inArray(subscriptions.patient_id, patientIds))
  await db.delete(patients).where(inArray(patients.id, patientIds))
  await db.delete(profiles).where(inArray(profiles.id, profileIds))

  // Delete from Supabase auth
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const authResults: { id: string; deleted: boolean; error?: string }[] = []
  for (const profileId of profileIds) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(profileId)
    authResults.push({ id: profileId, deleted: !error, error: error?.message })
  }

  return NextResponse.json({ ok: true, deleted: patientIds.length, authResults })
}
