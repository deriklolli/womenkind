import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * GET /api/visit-prep?appointmentId=xxx
 *
 * Gathers all available patient data since their last completed visit and
 * generates an AI narrative pre-visit brief for the provider.
 */
export async function GET(req: NextRequest) {
  const appointmentId = req.nextUrl.searchParams.get('appointmentId')
  if (!appointmentId) {
    return NextResponse.json({ error: 'appointmentId required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  // ── 1. Get the appointment + patient info ──
  const { data: appointment, error: aptErr } = await supabase
    .from('appointments')
    .select(`
      id, starts_at, patient_id, provider_id,
      appointment_types ( name, duration_minutes ),
      patients ( id, date_of_birth, state, phone, profiles ( first_name, last_name, email ) )
    `)
    .eq('id', appointmentId)
    .single()

  if (aptErr || !appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  const patientId = appointment.patient_id

  // ── 2. Find last completed visit (anchor for "since last visit") ──
  const { data: lastVisit } = await supabase
    .from('appointments')
    .select('id, starts_at, completed_at')
    .eq('patient_id', patientId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sinceDate = lastVisit?.completed_at || lastVisit?.starts_at || null

  // ── 3. Gather data in parallel ──
  const [
    { data: intake },
    { data: labOrders },
    { data: prescriptions },
    { data: refillRequests },
    { data: messages },
    { data: wearableMetrics },
  ] = await Promise.all([
    // Latest intake with AI brief
    supabase
      .from('intakes')
      .select('answers, ai_brief, status, submitted_at')
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Lab orders (all if no prior visit, otherwise since last visit)
    supabase
      .from('lab_orders')
      .select('lab_partner, tests, clinical_indication, status, results, ordered_at, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),

    // Active prescriptions
    supabase
      .from('prescriptions')
      .select('medication_name, dosage, frequency, status, prescribed_at')
      .eq('patient_id', patientId)
      .order('prescribed_at', { ascending: false }),

    // Refill requests (join prescription for medication name)
    supabase
      .from('refill_requests')
      .select('status, patient_note, provider_note, created_at, prescriptions ( medication_name )')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(10),

    // Recent messages from patient
    supabase
      .from('messages')
      .select('subject, body, sender_type, sender_id, created_at')
      .eq('sender_id', patientId)
      .eq('sender_type', 'patient')
      .order('created_at', { ascending: false })
      .limit(10),

    // Wearable metrics (last 14 days)
    supabase
      .from('wearable_metrics')
      .select('metric_type, value, metric_date')
      .eq('patient_id', patientId)
      .gte('metric_date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      .order('metric_date', { ascending: false }),
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
    const brief = intake.ai_brief
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
  if (labOrders && labOrders.length > 0) {
    const labLines = labOrders.map((order: any) => {
      const status = order.status
      const partner = order.lab_partner === 'quest' ? 'Quest' : order.lab_partner === 'labcorp' ? 'Labcorp' : order.lab_partner
      const date = order.ordered_at ? new Date(order.ordered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'

      if (status === 'results_available' && order.results) {
        const resultLines = order.results.map((r: any) => {
          const flagStr = r.flag && r.flag !== 'normal' ? ` [${r.flag.toUpperCase()}]` : ''
          return `  - ${r.testName}: ${r.value} ${r.unit} (ref: ${r.referenceRange})${flagStr}`
        })
        return `${partner} — Ordered ${date} — Results:\n${resultLines.join('\n')}`
      }
      return `${partner} — Ordered ${date} — Status: ${status}`
    })
    sections.push(`LAB ORDERS:\n${labLines.join('\n\n')}`)
  }

  // Prescriptions
  if (prescriptions && prescriptions.length > 0) {
    const rxLines = prescriptions.map((rx: any) => {
      const date = rx.prescribed_at ? new Date(rx.prescribed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
      return `- ${rx.medication_name} ${rx.dosage || ''} ${rx.frequency || ''} (${rx.status})${date ? ` — prescribed ${date}` : ''}`
    })
    sections.push(`PRESCRIPTIONS:\n${rxLines.join('\n')}`)
  }

  // Refill requests
  if (refillRequests && refillRequests.length > 0) {
    const refillLines = refillRequests.map((r: any) => {
      const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const medName = r.prescriptions?.medication_name || 'Unknown medication'
      return `- ${medName} — ${r.status} (${date})${r.patient_note ? ` — Patient: "${r.patient_note}"` : ''}`
    })
    sections.push(`REFILL REQUESTS:\n${refillLines.join('\n')}`)
  }

  // Messages from patient (already filtered in query)
  if (messages && messages.length > 0) {
    const msgLines = messages.slice(0, 5).map((m: any) => {
      const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const preview = m.body?.length > 120 ? m.body.slice(0, 120) + '...' : m.body
      return `- [${date}] ${m.subject || '(no subject)'}: "${preview}"`
    })
    sections.push(`RECENT PATIENT MESSAGES:\n${msgLines.join('\n')}`)
  }

  // Wearable trends — grouped by clinical domain with menopause-specific context
  if (wearableMetrics && wearableMetrics.length > 0) {
    const byType: Record<string, number[]> = {}
    for (const m of wearableMetrics as any[]) {
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
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Claude API error:', errorText)
    return NextResponse.json({ error: 'Failed to generate brief' }, { status: 500 })
  }

  const data = await response.json()
  const narrative = data.content?.[0]?.text || ''

  return NextResponse.json({
    narrative,
    patientName,
    appointmentType: aptType,
    appointmentDate: aptDate,
    isFirstVisit: !lastVisit,
  })
}
