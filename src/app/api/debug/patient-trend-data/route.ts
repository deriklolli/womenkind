import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles, visits, wearable_metrics, prescriptions } from '@/lib/db/schema'
import { eq, and, gte, desc } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers()
  const supabaseUser = userList?.users?.find(u => u.email === email)
  if (!supabaseUser) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const rdsProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, supabaseUser.id) })
  const rdsPatient = await db.query.patients.findFirst({ where: eq(patients.profile_id, supabaseUser.id) })
  if (!rdsPatient) return NextResponse.json({ error: 'patient not found' }, { status: 404 })

  const patientId = rdsPatient.id
  const since = new Date()
  since.setDate(since.getDate() - 168) // 24 weeks
  const sinceIso = since.toISOString().slice(0, 10)

  // Daily check-ins
  const checkins = await db.select({
    visit_date: visits.visit_date,
    symptom_scores: visits.symptom_scores,
  }).from(visits).where(
    and(eq(visits.patient_id, patientId), eq(visits.source, 'daily'), gte(visits.visit_date, sinceIso))
  ).orderBy(desc(visits.visit_date)).limit(50)

  // Wearable metrics
  const wearable = await db.select({
    metric_type: wearable_metrics.metric_type,
    metric_date: wearable_metrics.metric_date,
    value: wearable_metrics.value,
  }).from(wearable_metrics).where(
    and(eq(wearable_metrics.patient_id, patientId), gte(wearable_metrics.metric_date, sinceIso))
  ).orderBy(desc(wearable_metrics.metric_date)).limit(200)

  // Distinct metric types
  const metricTypes = Array.from(new Set(wearable.map(w => w.metric_type)))

  // Prescriptions
  const rxList = await db.select({
    medication_name: prescriptions.medication_name,
    dosage: prescriptions.dosage,
    prescribed_at: prescriptions.prescribed_at,
    status: prescriptions.status,
  }).from(prescriptions).where(eq(prescriptions.patient_id, patientId))

  // Recent visits (non-daily)
  const providerVisits = await db.select({
    visit_date: visits.visit_date,
    visit_type: visits.visit_type,
    source: visits.source,
  }).from(visits).where(
    and(eq(visits.patient_id, patientId), gte(visits.visit_date, sinceIso))
  ).orderBy(desc(visits.visit_date)).limit(20)

  return NextResponse.json({
    patientId,
    name: rdsProfile ? `${rdsProfile.first_name ?? ''} ${rdsProfile.last_name ?? ''}`.trim() : null,
    checkinCount: checkins.length,
    checkins: checkins.slice(0, 5),
    wearableMetricTypes: metricTypes,
    wearableSampleByType: metricTypes.reduce((acc, t) => {
      acc[t] = wearable.filter(w => w.metric_type === t).slice(0, 3)
      return acc
    }, {} as Record<string, typeof wearable>),
    prescriptions: rxList,
    recentVisits: providerVisits,
  })
}
