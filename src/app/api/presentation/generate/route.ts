import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intakes, patients, care_presentations, encounter_notes } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { Resend } from 'resend'
import { buildEngagementEmail } from '@/lib/engagement'
import { populateDeepDives } from '@/lib/populate-deep-dives'

export const maxDuration = 300

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    const {
      patientId,
      selectedComponents,
      componentNotes,
      welcomeMessage,
      closingMessage,
    } = await req.json()

    if (!patientId || !selectedComponents?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the latest intake and most recent encounter note in parallel
    const [latestIntake, latestEncounterNote] = await Promise.all([
      db.query.intakes.findFirst({
        where: eq(intakes.patient_id, patientId),
        orderBy: (intakes, { desc }) => [desc(intakes.submitted_at)],
      }),
      db.query.encounter_notes.findFirst({
        where: and(
          eq(encounter_notes.patient_id, patientId),
          inArray(encounter_notes.status, ['draft', 'signed'])
        ),
        orderBy: (n, { desc }) => [desc(n.created_at)],
        columns: { appointment_id: true },
      }),
    ])

    // Get patient email for sending
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, patientId),
      with: { profiles: true },
    })

    const patientProfile = patient?.profiles
    const patientEmail = patientProfile?.email
    const patientFirstName = patientProfile?.first_name || 'there'

    // Create the presentation record
    const [presentation] = await db
      .insert(care_presentations)
      .values({
        patient_id: patientId,
        provider_id: session.providerId!,
        intake_id: latestIntake?.id || null,
        appointment_id: latestEncounterNote?.appointment_id || null,
        selected_components: selectedComponents,
        component_notes: componentNotes,
        welcome_message: welcomeMessage,
        closing_message: closingMessage,
        status: 'sent',
      })
      .returning({ id: care_presentations.id })

    if (!presentation) {
      throw new Error('Failed to create presentation')
    }

    // Generate AI deep-dive content for every selected component before
    // sending the email. This is the personalized lead, dr_card, dr_quote,
    // dr_body, plan, and stat that powers each section. Without this step
    // the patient sees only the static editorial fallback copy.
    try {
      const result = await populateDeepDives(presentation.id)
      console.log(
        `[presentation/generate] deep dives populated for ${presentation.id}: ${result.generated.length} components, followUp=${result.isFollowUp}, notes=${result.hadConsultationNotes}, wearable=${result.hadWearableData}`
      )
    } catch (ddErr) {
      console.error('[presentation/generate] deep-dive generation failed:', ddErr)
      // Don't fail the whole request — the presentation row exists and the
      // provider can manually re-trigger via /api/presentations/[id]/generate-deep-dive
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const presentationUrl = `${appUrl}/presentation-blueprint.html?id=${presentation.id}`

    // Send email via Resend
    let emailSent = false
    if (patientEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = getResend()
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>',
          to: patientEmail,
          subject: 'Your Personalized Care Summary is Ready',
          html: buildEngagementEmail({
            heading: `Hi ${patientFirstName},`,
            bodyHtml: `
              <p style="font-size: 15px; color: #7b6a62; line-height: 1.7; margin: 0 0 8px 0;">
                Your provider has prepared a personalized care summary just for you.
              </p>
              <p style="font-size: 15px; color: #7b6a62; line-height: 1.7; margin: 0 0 8px 0;">
                It covers what's happening in your body and the recommended plan to help you feel your best.
              </p>
              <p style="font-size: 13px; color: #b3aaa5; line-height: 1.5; margin: 0; text-align: center;">
                You can also access this anytime from your patient portal.
              </p>
            `,
            ctaText: 'View Your Care Summary',
            ctaUrl: presentationUrl,
            patientId,
          }),
        })
        emailSent = true
        console.log(`[RESEND] Care presentation email sent to ${patientEmail}`)
      } catch (emailErr) {
        console.error('[RESEND] Failed to send email:', emailErr)
        // Don't fail the whole request if email fails
      }
    } else {
      console.log(`[EMAIL SKIPPED] No patient email or RESEND_API_KEY not set`)
    }

    return NextResponse.json({
      id: presentation.id,
      url: presentationUrl,
      status: 'sent',
      emailSent,
    })
  } catch (err) {
    console.error('Generate presentation error:', err)
    return NextResponse.json({ error: 'Failed to generate presentation' }, { status: 500 })
  }
}
