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
      patients ( id, profiles ( first_name, last_name, email, phone, dob, state ) )
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
      .select('answers, ai_brief, status, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Lab orders (all if no prior visit, otherwise since last visit)
    supabase
      .from('lab_orders')
      .select('lab_partner, tests, clinical_indication, status, results, ordered_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false }),

    // Active prescriptions
    supabase
      .from('prescriptions')
      .select('medication_name, dosage, frequency, status, prescribed_at, notes')
      .eq('patient_id', patientId)
      .order('prescribed_at', { ascending: false }),

    // Refill requests
    supabase
      .from('refill_requests')
      .select('medication_name, status, notes, provider_notes, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(10),

    // Recent messages from patient
    supabase
      .from('messages')
      .select('subject, body, sender_role, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(10),

    // Wearable metrics (last 14 days)
    supabase
      .from('wearable_metrics')
      .select('metric_type, value, recorded_date')
      .eq('patient_id', patientId)
      .gte('recorded_date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
      .order('recorded_date', { ascending: false }),
  ])

  // ── 4. Build the context document ──
  const sections: string[] = []

  // Patient basics
  const profile = (appointment as any).patients?.profiles
  const patientName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : 'Patient'
  const aptType = (appointment as any).appointment_types?.name || 'Visit'
  const aptDuration = (appointment as any).appointment_types?.duration_minutes || 30
  const aptDate = new Date(appointment.starts_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  sections.push(`UPCOMING VISIT: ${aptType} (${aptDuration} min) on ${aptDate}`)
  sections.push(`PATIENT: ${patientName}${profile?.dob ? `, DOB: ${profile.dob}` : ''}${profile?.state ? `, ${profile.state}` : ''}`)

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
      return `- ${r.medication_name} — ${r.status} (${date})${r.notes ? ` — Patient: "${r.notes}"` : ''}`
    })
    sections.push(`REFILL REQUESTS:\n${refillLines.join('\n')}`)
  }

  // Messages from patient
  if (messages && messages.length > 0) {
    const patientMsgs = messages.filter((m: any) => m.sender_role === 'patient')
    if (patientMsgs.length > 0) {
      const msgLines = patientMsgs.slice(0, 5).map((m: any) => {
        const date = new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const preview = m.body?.length > 120 ? m.body.slice(0, 120) + '...' : m.body
        return `- [${date}] ${m.subject || '(no subject)'}: "${preview}"`
      })
      sections.push(`RECENT PATIENT MESSAGES:\n${msgLines.join('\n')}`)
    }
  }

  // Wearable trends (summarize by metric type)
  if (wearableMetrics && wearableMetrics.length > 0) {
    const byType: Record<string, number[]> = {}
    for (const m of wearableMetrics as any[]) {
      if (!byType[m.metric_type]) byType[m.metric_type] = []
      byType[m.metric_type].push(m.value)
    }
    const trendLines = Object.entries(byType).map(([type, vals]) => {
      const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
      const recent = vals[0]?.toFixed(1)
      const oldest = vals[vals.length - 1]?.toFixed(1)
      const label = type.replace(/_/g, ' ')
      return `- ${label}: recent ${recent}, avg ${avg} (14-day range: ${oldest}→${recent}, n=${vals.length})`
    })
    sections.push(`WEARABLE BIOMETRICS (past 14 days):\n${trendLines.join('\n')}`)
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
