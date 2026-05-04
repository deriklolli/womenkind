import { NextResponse } from 'next/server'

export const maxDuration = 60

import { db } from '@/lib/db'
import { patients, intakes, visits, prescriptions, lab_orders, provider_notes, profiles, appointments } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
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

async function verifyIntakeBelongsToPatient(intakeId: string, patientId: string | undefined): Promise<boolean> {
  if (!patientId) return false
  const rows = await db
    .select({ id: intakes.id })
    .from(intakes)
    .where(and(eq(intakes.id, intakeId), eq(intakes.patient_id, patientId)))
    .limit(1)
  return rows.length > 0
}

async function executeAction(action: string, params: Record<string, any>, context: ChatContext | undefined, sessionProviderId: string | null) {
  try {
    switch (action) {
      case 'add_risk_flag': {
        const { intakeId, flagType, flag } = params

        if (!await verifyIntakeBelongsToPatient(intakeId, context?.patientId)) {
          return { success: false, error: 'Forbidden — intake does not belong to current patient' }
        }

        const intakeRows = await db
          .select({ ai_brief: intakes.ai_brief })
          .from(intakes)
          .where(eq(intakes.id, intakeId))
          .limit(1)

        const intake = intakeRows[0]
        if (!intake) return { success: false, error: 'Intake not found' }

        const existing = intake.ai_brief
        const brief = existing
          ? (typeof existing === 'string' ? JSON.parse(existing) : { ...(existing as any) })
          : {}
        if (!brief.risk_flags) brief.risk_flags = { urgent: [], contraindications: [], considerations: [] }
        if (!brief.risk_flags[flagType]) brief.risk_flags[flagType] = []
        brief.risk_flags[flagType].push(flag)

        await db.update(intakes).set({ ai_brief: brief }).where(eq(intakes.id, intakeId))

        return { success: true, message: `Added "${flag}" to ${flagType} risk flags` }
      }

      case 'remove_risk_flag': {
        const { intakeId: iId, flagType: fType, flag: fText } = params

        if (!await verifyIntakeBelongsToPatient(iId, context?.patientId)) {
          return { success: false, error: 'Forbidden — intake does not belong to current patient' }
        }

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
        const { patientId, noteType, content } = params

        if (patientId !== context?.patientId) {
          console.warn('add_provider_note: params.patientId does not match context.patientId — skipping action')
          return { success: false, error: 'Patient ID mismatch' }
        }

        await db.insert(provider_notes).values({
          patient_id: patientId,
          provider_id: sessionProviderId!,
          note_type: noteType || 'general',
          content,
        })

        return { success: true, message: 'Provider note added successfully' }
      }

      case 'update_ai_brief': {
        const { intakeId: uIntakeId, field, operation, value } = params

        if (!await verifyIntakeBelongsToPatient(uIntakeId, context?.patientId)) {
          return { success: false, error: 'Forbidden — intake does not belong to current patient' }
        }

        const intakeRows = await db
          .select({ ai_brief: intakes.ai_brief })
          .from(intakes)
          .where(eq(intakes.id, uIntakeId))
          .limit(1)

        const uIntake = intakeRows[0]
        if (!uIntake?.ai_brief) return { success: false, error: 'No AI brief found' }

        const ub = typeof uIntake.ai_brief === 'string' ? JSON.parse(uIntake.ai_brief) : uIntake.ai_brief as any

        // Navigate to the nested field using dot-path
        const parts = (field as string).split('.')
        let target = ub
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {}
          target = target[parts[i]]
        }
        const lastKey = parts[parts.length - 1]

        if (operation === 'append') {
          if (!Array.isArray(target[lastKey])) target[lastKey] = []
          target[lastKey].push(value)
        } else {
          target[lastKey] = value
        }

        await db.update(intakes).set({ ai_brief: ub }).where(eq(intakes.id, uIntakeId))

        return { success: true, message: `Updated ${field} in AI brief` }
      }

      case 'update_symptom_severity': {
        const { intakeId: sIntakeId, domain, severity } = params

        if (!await verifyIntakeBelongsToPatient(sIntakeId, context?.patientId)) {
          return { success: false, error: 'Forbidden — intake does not belong to current patient' }
        }

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
      if (process.env.NODE_ENV !== 'development') {
        // Verify the requesting provider has a care relationship with this patient
        const relationship = await db
          .select({ id: appointments.id })
          .from(appointments)
          .where(and(
            eq(appointments.patient_id, context.patientId),
            eq(appointments.provider_id, session.providerId!)
          ))
          .limit(1)
        if (relationship.length === 0) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      if (process.env.NODE_ENV === 'development') {
        patientContext = `CURRENT PATIENT CONTEXT:\nPatient ID: ${context.patientId}\nPage: ${context.page}\n(Patient data not available in local development — RDS is prod-only)`
      } else {
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
    }

    const systemPrompt = `You are Womenkind AI, a clinical documentation assistant embedded in the Womenkind provider portal. You help Dr. Joseph Urban Jr. manage his menopause care practice.

Your PRIMARY role when viewing a patient is to capture clinical updates — allergies, reactions, treatment changes, observations — and persist them so they influence all future AI outputs for this patient. You are speaking directly with Dr. Urban. Use clinical terminology and be concise.

${patientContext}

CAPABILITIES — You can take these actions when Dr. Urban requests them. You may emit multiple action blocks in a single response when appropriate.

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

5. UPDATE AI BRIEF FIELD: To update a specific field in the patient's AI clinical brief (affects visit prep, care presentations, and all future AI outputs):
\`\`\`action
{"action": "update_ai_brief", "params": {"intakeId": "<intake_id>", "field": "risk_flags.contraindications|risk_flags.considerations|risk_flags.urgent|treatment_pathway|md_command.treatment_options", "operation": "append|replace", "value": "<string or object>"}}
\`\`\`

CLINICAL UPDATE RULES (CRITICAL):
- When Dr. Urban mentions an ALLERGY or ADVERSE REACTION: emit EXACTLY TWO actions — add_provider_note (note_type: "clinical") AND add_risk_flag (flagType: "contraindications"). Do NOT use update_ai_brief for allergies — add_risk_flag always works even when no brief exists and is the correct action for contraindications.
- When Dr. Urban mentions a TREATMENT CHANGE or NEW MEDICATION PLAN: emit add_provider_note AND update_ai_brief to update treatment_pathway or md_command.treatment_options.
- When Dr. Urban mentions a NEW CLINICAL FINDING or SAFETY CONCERN: emit add_provider_note AND add_risk_flag with the appropriate flagType.
- Always acknowledge the update explicitly: "I've noted that [patient] had [update] and flagged it as [category]. This will be reflected in all future AI outputs for this patient."
- Use the actual IDs from the patient context — never make up IDs.
- If no patient is loaded, say so and decline to execute actions.
- Be concise — Dr. Urban is busy.
- For clinical questions, reference current menopause care guidelines (NAMS, IMS).`

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

    // Execute all action blocks in the response
    const actionRegex = /```action\n([\s\S]*?)\n```/g
    const actionMatches = Array.from(responseText.matchAll(actionRegex))
    for (const match of actionMatches) {
      try {
        const actionData = JSON.parse(match[1])
        const result = await executeAction(actionData.action, actionData.params, context, session.providerId ?? null)
        responseText = responseText.replace(match[0], '').trim()
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
