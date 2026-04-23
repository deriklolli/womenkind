import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

import { getServerSession } from '@/lib/getServerSession'
import { invokeModel } from '@/lib/bedrock'
import { db } from '@/lib/db'
import {
  appointments,
  intakes,
  lab_orders,
  prescriptions,
  refill_requests,
  messages,
  wearable_metrics,
} from '@/lib/db/schema'
import { eq, and, desc, gte } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * GET /api/visit-prep?appointmentId=xxx
 *
 * Gathers all available patient data since their last completed visit and
 * generates an AI narrative pre-visit brief for the provider.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const appointmentId = req.nextUrl.searchParams.get('appointmentId')
  if (!appointmentId) {
    return NextResponse.json({ error: 'appointmentId required' }, { status: 400 })
  }

  // ── 1. Get the appointment + patient info ──
  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    with: {
      appointment_types: true,
      patients: {
        with: { profiles: true },
      },
    },
  })

  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  if (appointment.provider_id !== session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const patientId = appointment.patient_id

  // ── 2. Find last completed visit (anchor for "since last visit") ──
  const lastVisit = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.patient_id, patientId),
      eq(appointments.status, 'completed')
    ),
    orderBy: [desc(appointments.completed_at)],
    columns: { id: true, starts_at: true, completed_at: true },
  })

  // ── 3. Gather data in parallel ──
  const [
    intake,
    labOrderRows,
    prescriptionRows,
    refillRequestRows,
    messageRows,
    wearableMetricRows,
  ] = await Promise.all([
    // Latest intake with AI brief
    db.query.intakes.findFirst({
      where: eq(intakes.patient_id, patientId),
      orderBy: [desc(intakes.submitted_at)],
      columns: { answers: true, ai_brief: true, status: true, submitted_at: true },
    }),

    // Lab orders (all)
    db.select({
      lab_partner: lab_orders.lab_partner,
      tests: lab_orders.tests,
      clinical_indication: lab_orders.clinical_indication,
      status: lab_orders.status,
      ordered_at: lab_orders.ordered_at,
      created_at: lab_orders.created_at,
    }).from(lab_orders)
      .where(eq(lab_orders.patient_id, patientId))
      .orderBy(desc(lab_orders.created_at)),

    // Active prescriptions
    db.select({
      medication_name: prescriptions.medication_name,
      dosage: prescriptions.dosage,
      frequency: prescriptions.frequency,
      status: prescriptions.status,
      prescribed_at: prescriptions.prescribed_at,
    }).from(prescriptions)
      .where(eq(prescriptions.patient_id, patientId))
      .orderBy(desc(prescriptions.prescribed_at)),

    // Refill requests (with prescription name)
    db.query.refill_requests.findMany({
      where: eq(refill_requests.patient_id, patientId),
      orderBy: [desc(refill_requests.created_at)],
      limit: 10,
      columns: { status: true, patient_note: true, provider_note: true, created_at: true },
      with: {
        prescriptions: { columns: { medication_name: true } },
      },
    }),

    // Recent messages from patient
    db.select({
      subject: messages.subject,
      body: messages.body,
      sender_type: messages.sender_type,
      sender_id: messages.sender_id,
      created_at: messages.created_at,
    }).from(messages)
      .where(and(
        eq(messages.sender_id, patientId),
        eq(messages.sender_type, 'patient')
      ))
      .orderBy(desc(messages.created_at))
      .limit(10),

    // Wearable metrics (last 14 days)
    db.select({
      metric_type: wearable_metrics.metric_type,
      value: wearable_metrics.value,
      metric_date: wearable_metrics.metric_date,
    }).from(wearable_metrics)
      .where(and(
        eq(wearable_metrics.patient_id, patientId),
        gte(wearable_metrics.metric_date, new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      ))
      .orderBy(desc(wearable_metrics.metric_date)),
  ])

  // ── 4. Build the context document ──
  const sections: string[] = []

  // Patient basics
  const patient = (appointment as any).patients
  const profile = patient?.profiles
  const patientName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : 'Patient'
  const aptType = (appointment as any).appointment_types?.name || 'Visit'
  const aptDuration = (appointment as any).appointment_types?.duration_minutes || 30
  const aptDate = new Date(appointment.starts_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  sections.push(`UPCOMING VISIT: ${aptType} (${aptDuration} min) on ${aptDate}`)
  sections.push(`PATIENT: ${patientName}${patient?.date_of_birth ? `, DOB: ${patient.date_of_birth}` : ''}${patient?.state ? `, ${patient.state}` : ''}`)

  if (lastVisit) {
    const lastDate = new Date(lastVisit.completed_at || lastVisit.starts_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    sections.push(`LAST VISIT: ${lastDate}`)
  } else {
    sections.push('LAST VISIT: None — this is the patient\'s first visit')
  }

  // Intake summary (use AI brief if available, otherwise raw answers)
  if (intake?.ai_brief) {
    const brief = intake.ai_brief as any
    const overview = brief.symptom_summary?.overview || ''
    const stage = brief.metadata?.menopausal_stage || ''
    const burden = brief.metadata?.symptom_burden || ''
    const urgentFlags = brief.risk_flags?.urgent || []
    const contraindications = brief.risk_flags?.contraindications || []

    sections.push(`CLINICAL BRIEF (from intake):\n${overview}\nStage: ${stage} | Burden: ${burden}`)
    if (urgentFlags.length) sections.push(`URGENT FLAGS: ${urgentFlags.join('; ')}`)
    if (contraindications.length) sections.push(`CONTRAINDICATIONS: ${contraindications.join('; ')}`)
  }

  // Lab results
  if (labOrderRows && labOrderRows.length > 0) {
    const labLines = labOrderRows.map((order: any) => {
      const status = order.status
      const partner = order.lab_partner === 'quest' ? 'Quest' : order.lab_partner === 'labcorp' ? 'Labcorp' : order.lab_partner
      const date = order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'
      return `${partner} — Ordered ${date} — Status: ${status}`
    })
    sections.push(`LAB ORDERS:\n${labLines.join('\n\n')}`)
  }

  // Prescriptions
  if (prescriptionRows && prescriptionRows.length > 0) {
    const rxLines = prescriptionRows.map((rx: any) => {
      const date = rx.prescribed_at ? new Date(rx.prescribed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
      return `- ${rx.medication_name} ${rx.dosage || ''} ${rx.frequency || ''} (${rx.status})${date ? ` — prescribed ${date}` : ''}`
    })
    sections.push(`PRESCRIPTIONS:\n${rxLines.join('\n')}`)
  }

  // Refill requests
  if (refillRequestRows && refillRequestRows.length > 0) {
    const refillLines = refillRequestRows.map((r: any) => {
      const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const medName = r.prescriptions?.medication_name || 'Unknown medication'
      return `- ${medName} — ${r.status} (${date})${r.patient_note ? ` — Patient: "${r.patient_note}"` : ''}`
    })
    sections.push(`REFILL REQUESTS:\n${refillLines.join('\n')}`)
  }

  // Messages from patient
  if (messageRows && messageRows.length > 0) {
    const msgLines = messageRows.slice(0, 5).map((m: any) => {
      const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const preview = m.body?.length > 120 ? m.body.slice(0, 120) + '...' : m.body
      return `- [${date}] ${m.subject || '(no subject)'}: "${preview}"`
    })
    sections.push(`RECENT PATIENT MESSAGES:\n${msgLines.join('\n')}`)
  }

  // Wearable trends — grouped by clinical domain with menopause-specific context
  if (wearableMetricRows && wearableMetricRows.length > 0) {
    const byType: Record<string, number[]> = {}
    for (const m of wearableMetricRows as any[]) {
      if (!byType[m.metric_type]) byType[m.metric_type] = []
      byType[m.metric_type].push(m.value)
    }

    // Clinical labels and thresholds relevant to menopause
    const metricMeta: Record<string, { label: string; unit: string; note?: string }> = {
      sleep_score:               { label: 'Sleep quality score', unit: '/100', note: '<70 is clinically notable; estrogen/progesterone decline disrupts sleep architecture' },
      sleep_deep_minutes:        { label: 'Deep (N3) sleep', unit: 'min', note: 'Reduced N3 common in menopause; progesterone promotes slow-wave sleep' },
      sleep_rem_minutes:         { label: 'REM sleep', unit: 'min', note: 'Supports mood regulation; disruption correlates with mood/cognitive symptoms' },
      sleep_total_minutes:       { label: 'Total sleep duration', unit: 'min' },
      sleep_efficiency:          { label: 'Sleep efficiency', unit: '%', note: '<85% is clinically relevant; common in menopause-related insomnia' },
      sleep_light_minutes:       { label: 'Light sleep', unit: 'min' },
      temperature_deviation:     { label: 'Skin temperature deviation', unit: '°C', note: 'VASOMOTOR BIOMARKER: spikes >0.5°C correlate directly with hot flash/night sweat events; persistent elevation = undertreated VMS' },
      temperature_trend_deviation: { label: 'Temperature trend deviation', unit: '°C', note: 'Multi-day trend; upward drift suggests worsening vasomotor activity' },
      hrv_average:               { label: 'Heart rate variability (HRV)', unit: 'ms', note: 'Low HRV (<30ms) indicates autonomic stress; often improves with HRT; reflects physiological burden of VMS' },
      resting_heart_rate:        { label: 'Resting heart rate', unit: 'bpm', note: 'Elevated RHR common with estrogen decline; tracks alongside VMS severity' },
      readiness_score:           { label: 'Recovery/readiness score', unit: '/100', note: 'Composite of HRV, RHR, and sleep; low scores reflect cumulative physiological load' },
      respiratory_rate:          { label: 'Respiratory rate', unit: 'br/min' },
    }

    const domainOrder = [
      ['VASOMOTOR BIOMARKER', ['temperature_deviation', 'temperature_trend_deviation']],
      ['SLEEP ARCHITECTURE', ['sleep_score', 'sleep_efficiency', 'sleep_deep_minutes', 'sleep_rem_minutes', 'sleep_light_minutes', 'sleep_total_minutes']],
      ['AUTONOMIC & CARDIOVASCULAR', ['hrv_average', 'resting_heart_rate', 'respiratory_rate', 'readiness_score']],
    ] as [string, string[]][]

    const domainSections: string[] = []
    const seen = new Set<string>()

    for (const [domain, keys] of domainOrder) {
      const lines: string[] = []
      for (const key of keys) {
        const vals = byType[key]
        if (!vals || vals.length === 0) continue
        seen.add(key)
        const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
        const recent = vals[0]?.toFixed(1)
        const meta = metricMeta[key] || { label: key.replace(/_/g, ' '), unit: '' }
        const flagNote = meta.note ? ` — ${meta.note}` : ''
        lines.push(`  • ${meta.label}: recent ${recent}${meta.unit}, avg ${avg}${meta.unit} (n=${vals.length} days)${flagNote}`)
      }
      if (lines.length) domainSections.push(`[${domain}]\n${lines.join('\n')}`)
    }

    // Any remaining metrics not in the domain map
    const remaining = Object.entries(byType).filter(([k]) => !seen.has(k))
    if (remaining.length) {
      const extraLines = remaining.map(([type, vals]) => {
        const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
        const recent = vals[0]?.toFixed(1)
        return `  • ${type.replace(/_/g, ' ')}: recent ${recent}, avg ${avg} (n=${vals.length})`
      })
      domainSections.push(`[OTHER]\n${extraLines.join('\n')}`)
    }

    sections.push(`WEARABLE BIOMETRICS — Oura Ring (past 14 days):\n${domainSections.join('\n\n')}`)
  }

  const contextDocument = sections.join('\n\n')

  // ── 5. Generate AI narrative ──
  let narrative: string
  try {
    narrative = await invokeModel({
      maxTokens: 2048,
      system: `You are a clinical assistant for Dr. Urban at Womenkind, a telehealth menopause care platform. Generate a concise pre-visit narrative brief.

Your role:
- Synthesize ALL available patient data into a natural, readable narrative
- Lead with what's most clinically relevant for THIS visit
- Highlight changes since last visit if data exists
- Connect dots across data sources (e.g., wearable trends + lab results + symptoms)
- Flag anything that needs attention or follow-up
- End with 2-3 specific talking points for the visit

OURA WEARABLE CLINICAL INTERPRETATION (apply when wearable data is present):
- Temperature deviation spikes >0.5°C are objective evidence of vasomotor events — use to confirm or challenge patient-reported hot flash frequency
- Persistent low HRV (<30ms) with elevated RHR suggests autonomic burden from undertreated VMS; typically improves with effective HRT
- Fragmented sleep architecture (low deep sleep, low REM, low efficiency) is a hallmark menopause pattern; correlates with mood instability and cognitive symptoms
- Low readiness scores reflect cumulative physiological load; relevant to discussing treatment urgency
- When wearable data conflicts with subjective report (e.g., patient minimizes symptoms but temperature spikes are frequent), note the discrepancy explicitly

Tone: Clinical but readable — like a trusted colleague handing off a patient. No boilerplate.
Format: Natural prose paragraphs. No JSON, no bullet lists, no markdown headers. Just a clean narrative that Dr. Urban can scan in 30 seconds before the call.
Length: 150-250 words. Be concise.`,
      messages: [
        {
          role: 'user',
          content: `Generate a pre-visit brief for Dr. Urban. Here is everything we know about this patient:\n\n${contextDocument}`,
        },
      ],
    })
  } catch (err) {
    console.error('Bedrock error:', err)
    return NextResponse.json({ error: 'Failed to generate brief' }, { status: 500 })
  }

  return NextResponse.json({
    narrative,
    patientName,
    appointmentType: aptType,
    appointmentDate: aptDate,
    isFirstVisit: !lastVisit,
  })
}
