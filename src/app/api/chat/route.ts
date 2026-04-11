import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { getServerSession } from '@/lib/getServerSession'

interface ChatContext {
  page: string
  patientId?: string
  patientName?: string
  intakeId?: string
  intakeStatus?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

async function getPatientContext(patientId: string) {
  // Fetch patient profile
  const { data: patient } = await getServiceSupabase()
    .from('patients')
    .select('*, profiles ( first_name, last_name, email )')
    .eq('id', patientId)
    .single()

  // Fetch intake
  const { data: intake } = await getServiceSupabase()
    .from('intakes')
    .select('*')
    .eq('patient_id', patientId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch visits
  const { data: visits } = await getServiceSupabase()
    .from('visits')
    .select('*')
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })
    .limit(5)

  // Fetch prescriptions
  const { data: prescriptions } = await getServiceSupabase()
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  // Fetch lab orders
  const { data: labOrders } = await getServiceSupabase()
    .from('lab_orders')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  // Fetch provider notes
  const { data: providerNotes } = await getServiceSupabase()
    .from('provider_notes')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  return {
    patient,
    intake,
    visits: visits || [],
    prescriptions: prescriptions || [],
    labOrders: labOrders || [],
    providerNotes: providerNotes || [],
  }
}

async function executeAction(action: string, params: Record<string, any>) {
  try {
    switch (action) {
      case 'add_risk_flag': {
        const { intakeId, flagType, flag } = params
        // flagType: 'urgent' | 'contraindications' | 'considerations'
        const { data: intake } = await getServiceSupabase()
          .from('intakes')
          .select('ai_brief')
          .eq('id', intakeId)
          .single()

        if (!intake?.ai_brief) return { success: false, error: 'No AI brief found' }

        const brief = typeof intake.ai_brief === 'string' ? JSON.parse(intake.ai_brief) : intake.ai_brief
        if (!brief.risk_flags) brief.risk_flags = { urgent: [], contraindications: [], considerations: [] }
        if (!brief.risk_flags[flagType]) brief.risk_flags[flagType] = []
        brief.risk_flags[flagType].push(flag)

        const { error } = await getServiceSupabase()
          .from('intakes')
          .update({ ai_brief: brief })
          .eq('id', intakeId)

        return error ? { success: false, error: error.message } : { success: true, message: `Added "${flag}" to ${flagType} risk flags` }
      }

      case 'remove_risk_flag': {
        const { intakeId: iId, flagType: fType, flag: fText } = params
        const { data: intakeData } = await getServiceSupabase()
          .from('intakes')
          .select('ai_brief')
          .eq('id', iId)
          .single()

        if (!intakeData?.ai_brief) return { success: false, error: 'No AI brief found' }

        const b = typeof intakeData.ai_brief === 'string' ? JSON.parse(intakeData.ai_brief) : intakeData.ai_brief
        if (b.risk_flags?.[fType]) {
          b.risk_flags[fType] = b.risk_flags[fType].filter((f: string) => !f.toLowerCase().includes(fText.toLowerCase()))
        }

        const { error: err } = await getServiceSupabase()
          .from('intakes')
          .update({ ai_brief: b })
          .eq('id', iId)

        return err ? { success: false, error: err.message } : { success: true, message: `Removed matching flag from ${fType}` }
      }

      case 'add_provider_note': {
        const { patientId, providerId, noteType, title, content } = params
        const { error } = await getServiceSupabase()
          .from('provider_notes')
          .insert({
            patient_id: patientId,
            provider_id: providerId || 'b0000000-0000-0000-0000-000000000001',
            note_type: noteType || 'general',
            title: title || null,
            content,
          })

        return error ? { success: false, error: error.message } : { success: true, message: 'Provider note added successfully' }
      }

      case 'update_symptom_severity': {
        const { intakeId: sIntakeId, domain, severity } = params
        const { data: sIntake } = await getServiceSupabase()
          .from('intakes')
          .select('ai_brief')
          .eq('id', sIntakeId)
          .single()

        if (!sIntake?.ai_brief) return { success: false, error: 'No AI brief found' }

        const sb = typeof sIntake.ai_brief === 'string' ? JSON.parse(sIntake.ai_brief) : sIntake.ai_brief
        const domainEntry = sb.symptom_summary?.domains?.find((d: any) =>
          d.domain.toLowerCase().includes(domain.toLowerCase())
        )
        if (domainEntry) {
          domainEntry.severity = severity
        }

        const { error: sErr } = await getServiceSupabase()
          .from('intakes')
          .update({ ai_brief: sb })
          .eq('id', sIntakeId)

        return sErr ? { success: false, error: sErr.message } : { success: true, message: `Updated ${domain} severity to ${severity}` }
      }

      default:
        return { success: false, error: `Unknown action: ${action}` }
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, context }: { messages: ChatMessage[]; context?: ChatContext } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        response: "The AI assistant isn't configured yet. Please add your ANTHROPIC_API_KEY to .env.local to enable this feature.",
      })
    }

    // Build patient context if we have a patient ID
    let patientContext = ''
    if (context?.patientId) {
      const data = await getPatientContext(context.patientId)
      patientContext = `
CURRENT PATIENT CONTEXT:
Patient: ${data.patient?.profiles?.first_name} ${data.patient?.profiles?.last_name}
Patient ID: ${context.patientId}
Page: ${context.page}

Intake Status: ${data.intake?.status || 'none'}
Intake ID: ${data.intake?.id || 'none'}

AI Clinical Brief:
${data.intake?.ai_brief ? JSON.stringify(data.intake.ai_brief, null, 2) : 'Not yet generated'}

Intake Answers:
${data.intake?.answers ? JSON.stringify(data.intake.answers, null, 2) : 'Not available'}

Recent Visits (${data.visits.length}):
${data.visits.map((v: any) => `- ${v.visit_date}: ${v.visit_type} (${v.status}) — ${v.chief_complaint || 'No complaint'}`).join('\n') || 'None'}

Active Prescriptions (${data.prescriptions.length}):
${data.prescriptions.map((p: any) => `- ${p.medication_name} ${p.dosage} — ${p.status}`).join('\n') || 'None'}

Lab Orders (${data.labOrders.length}):
${data.labOrders.map((l: any) => `- ${l.test_name} — ${l.status}`).join('\n') || 'None'}

Provider Notes (${data.providerNotes.length}):
${data.providerNotes.map((n: any) => `- [${n.note_type}] ${n.title || '(untitled)'}: ${n.content?.substring(0, 100)}...`).join('\n') || 'None'}
`
    }

    const systemPrompt = `You are Womenkind AI, an intelligent assistant embedded in the Womenkind provider portal. You help Dr. Joseph Urban Jr. manage his menopause care practice.

You have full access to patient data and can make changes when asked. You are speaking directly with Dr. Urban — use appropriate clinical terminology and be concise.

${patientContext}

CAPABILITIES — You can take these actions when Dr. Urban requests them:

1. ADD A RISK FLAG: To add a risk flag, respond with your message AND include this JSON block:
\`\`\`action
{"action": "add_risk_flag", "params": {"intakeId": "<intake_id>", "flagType": "urgent|contraindications|considerations", "flag": "The flag text"}}
\`\`\`

2. REMOVE A RISK FLAG: To remove a risk flag:
\`\`\`action
{"action": "remove_risk_flag", "params": {"intakeId": "<intake_id>", "flagType": "urgent|contraindications|considerations", "flag": "keyword to match"}}
\`\`\`

3. ADD A PROVIDER NOTE: To add a note to the patient chart:
\`\`\`action
{"action": "add_provider_note", "params": {"patientId": "<patient_id>", "noteType": "general|follow_up|phone_call|message|clinical", "title": "Note title", "content": "Note content"}}
\`\`\`

4. UPDATE SYMPTOM SEVERITY: To update a domain severity:
\`\`\`action
{"action": "update_symptom_severity", "params": {"intakeId": "<intake_id>", "domain": "domain name", "severity": "none|mild|moderate|severe"}}
\`\`\`

RULES:
- Always confirm what you're about to do before executing destructive changes
- When adding risk flags, choose the correct category (urgent, contraindications, or considerations)
- Use the actual IDs from the patient context — never make up IDs
- If you don't have enough context (no patient loaded), say so
- Be concise — Dr. Urban is busy
- For clinical questions, reference current menopause care guidelines (NAMS, IMS)
- You can answer general questions even without patient context`

    // Call Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('Claude API error:', errText)
      return NextResponse.json({
        response: 'Sorry, there was an error communicating with the AI. Please check the API key configuration.',
      })
    }

    const claudeData = await claudeRes.json()
    let responseText = claudeData.content?.[0]?.text || 'No response generated.'

    // Check for action blocks in the response
    const actionMatch = responseText.match(/```action\n([\s\S]*?)\n```/)
    if (actionMatch) {
      try {
        const actionData = JSON.parse(actionMatch[1])
        const result = await executeAction(actionData.action, actionData.params)

        // Remove the action block from the displayed response
        responseText = responseText.replace(/```action\n[\s\S]*?\n```/, '').trim()

        if (result.success) {
          responseText += `\n\n✓ ${result.message}`
        } else {
          responseText += `\n\n✗ Failed: ${result.error}`
        }
      } catch (parseErr) {
        console.error('Failed to parse action:', parseErr)
      }
    }

    return NextResponse.json({ response: responseText })
  } catch (err: any) {
    console.error('Chat API error:', err)
    return NextResponse.json({
      response: 'An unexpected error occurred. Please try again.',
    })
  }
}
