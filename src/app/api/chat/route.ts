import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, intakes, visits, prescriptions, lab_orders, provider_notes, profiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { invokeModel } from '@/lib/bedrock'

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
  // Fetch patient with profile
  const patientRows = await db
    .select({
      id: patients.id,
      profile_id: patients.profile_id,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
      email: profiles.email,
    })
    .from(patients)
    .leftJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(patients.id, patientId))
    .limit(1)

  const patientRow = patientRows[0] || null
  const patient = patientRow
    ? {
        ...patientRow,
        profiles: {
          first_name: patientRow.first_name,
          last_name: patientRow.last_name,
          email: patientRow.email,
        },
      }
    : null

  // Fetch most recent intake
  const intakeRows = await db
    .select()
    .from(intakes)
    .where(eq(intakes.patient_id, patientId))
    .orderBy(desc(intakes.started_at))
    .limit(1)
  const intake = intakeRows[0] || null

  // Fetch recent visits
  const visitRows = await db
    .select()
    .from(visits)
    .where(eq(visits.patient_id, patientId))
    .orderBy(desc(visits.visit_date))
    .limit(5)

  // Fetch prescriptions
  const prescriptionRows = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.patient_id, patientId))
    .orderBy(desc(prescriptions.created_at))

  // Fetch lab orders
  const labOrderRows = await db
    .select()
    .from(lab_orders)
    .where(eq(lab_orders.patient_id, patientId))
    .orderBy(desc(lab_orders.created_at))

  // Fetch provider notes
  const providerNoteRows = await db
    .select()
    .from(provider_notes)
    .where(eq(provider_notes.patient_id, patientId))
    .orderBy(desc(provider_notes.created_at))

  return {
    patient,
    intake,
    visits: visitRows,
    prescriptions: prescriptionRows,
    labOrders: labOrderRows,
    providerNotes: providerNoteRows,
  }
}

async function executeAction(action: string, params: Record<string, any>) {
  try {
    switch (action) {
      case 'add_risk_flag': {
        const { intakeId, flagType, flag } = params

        const intakeRows = await db
          .select({ ai_brief: intakes.ai_brief })
          .from(intakes)
          .where(eq(intakes.id, intakeId))
          .limit(1)

        const intake = intakeRows[0]
        if (!intake?.ai_brief) return { success: false, error: 'No AI brief found' }

        const brief = typeof intake.ai_brief === 'string' ? JSON.parse(intake.ai_brief) : intake.ai_brief as any
        if (!brief.risk_flags) brief.risk_flags = { urgent: [], contraindications: [], considerations: [] }
        if (!brief.risk_flags[flagType]) brief.risk_flags[flagType] = []
        brief.risk_flags[flagType].push(flag)

        await db.update(intakes).set({ ai_brief: brief }).where(eq(intakes.id, intakeId))

        return { success: true, message: `Added "${flag}" to ${flagType} risk flags` }
      }

      case 'remove_risk_flag': {
        const { intakeId: iId, flagType: fType, flag: fText } = params

        const intakeRows = await db
          .select({ ai_brief: intakes.ai_brief })
          .from(intakes)
          .where(eq(intakes.id, iId))
          .limit(1)

        const intakeData = intakeRows[0]
        if (!intakeData?.ai_brief) return { success: false, error: 'No AI brief found' }

        const b = typeof intakeData.ai_brief === 'string' ? JSON.parse(intakeData.ai_brief) : intakeData.ai_brief as any
        if (b.risk_flags?.[fType]) {
          b.risk_flags[fType] = b.risk_flags[fType].filter((f: string) => !f.toLowerCase().includes(fText.toLowerCase()))
        }

        await db.update(intakes).set({ ai_brief: b }).where(eq(intakes.id, iId))

        return { success: true, message: `Removed matching flag from ${fType}` }
      }

      case 'add_provider_note': {
        const { patientId, providerId, noteType, content } = params

        await db.insert(provider_notes).values({
          patient_id: patientId,
          provider_id: providerId || 'b0000000-0000-0000-0000-000000000001',
          note_type: noteType || 'general',
          content,
        })

        return { success: true, message: 'Provider note added successfully' }
      }

      case 'update_symptom_severity': {
        const { intakeId: sIntakeId, domain, severity } = params

        const intakeRows = await db
          .select({ ai_brief: intakes.ai_brief })
          .from(intakes)
          .where(eq(intakes.id, sIntakeId))
          .limit(1)

        const sIntake = intakeRows[0]
        if (!sIntake?.ai_brief) return { success: false, error: 'No AI brief found' }

        const sb = typeof sIntake.ai_brief === 'string' ? JSON.parse(sIntake.ai_brief) : sIntake.ai_brief as any
        const domainEntry = sb.symptom_summary?.domains?.find((d: any) =>
          d.domain.toLowerCase().includes(domain.toLowerCase())
        )
        if (domainEntry) {
          domainEntry.severity = severity
        }

        await db.update(intakes).set({ ai_brief: sb }).where(eq(intakes.id, sIntakeId))

        return { success: true, message: `Updated ${domain} severity to ${severity}` }
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
    if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { messages, context }: { messages: ChatMessage[]; context?: ChatContext } = await req.json()

    // Build patient context if we have a patient ID
    let patientContext = ''
    if (context?.patientId) {
      if (context?.patientId && session.patientId && session.patientId !== context.patientId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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

    // Call Claude via Bedrock
    let responseText: string
    try {
      responseText = await invokeModel({
        maxTokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      })
    } catch (err: any) {
      console.error('Bedrock error:', err)
      return NextResponse.json({
        response: 'Sorry, there was an error communicating with the AI.',
      })
    }

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
