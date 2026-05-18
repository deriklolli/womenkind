import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { Resend } from 'resend'
import { buildEngagementEmail } from '@/lib/engagement'
import { logPhiAccess } from '@/lib/phi-audit'
import { getServerSession } from '@/lib/getServerSession'
import { generateClinicalBrief } from '@/lib/intake-brief'
import { computeWMI } from '@/lib/wmi-scoring'
import { generateComponentBodies } from '@/lib/intake-component-bodies'
import { db } from '@/lib/db'
import { intakes, providers, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const maxDuration = 300

/**
 * POST /api/intake/submit
 * Finalizes an intake: marks as submitted, triggers AI brief generation
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { intakeId, patientId: bodyPatientId, answers } = await req.json()

    // If a patientId is supplied, verify it belongs to the authenticated user.
    // Providers submitting on a patient's behalf are also allowed.
    if (bodyPatientId && session.role === 'patient' && session.patientId !== bodyPatientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // For authenticated patients, always use the session patientId — this ensures
    // the intake is correctly linked even when the form sends patientId: null
    // (can happen when the intake-init call resolves after the first auto-save).
    const patientId = session.role === 'patient' ? (session.patientId ?? bodyPatientId) : bodyPatientId

    // Verify payment before allowing submission.
    // Providers bypass this check (submitting on behalf of patient).
    // Dev mode also bypasses so local testing doesn't require Stripe.
    // Two valid payment proofs:
    //   1. intake.paid = true  → legacy intake-first flow (Stripe charged with intakeId)
    //   2. onboarding_status in ['paid','active'] → new funnel (membership charged before
    //      intake exists; webhook sets patients.onboarding_status but can't know intakeId)
    if (session.role === 'patient' && process.env.NODE_ENV !== 'development') {
      const [intakePayment, patientRow] = await Promise.all([
        db.query.intakes.findFirst({
          where: eq(intakes.id, intakeId),
          columns: { paid: true },
        }),
        db.query.patients.findFirst({
          where: eq(patients.id, session.patientId!),
          columns: { onboarding_status: true },
        }),
      ])
      // null = pre-funnel patient (created before onboarding tracking). Treat as paid.
      // Only block explicit pre-payment funnel states ('pending', 'verified').
      const onboardingStatus = patientRow?.onboarding_status
      const membershipPaid = onboardingStatus == null || ['paid', 'active'].includes(onboardingStatus)
      if (!intakePayment?.paid && !membershipPaid) {
        return NextResponse.json({ error: 'Payment required' }, { status: 402 })
      }
    }

    // 1. Resolve provider — look up the first active provider as the intake recipient
    //    (single-provider MVP; extend this to match by location/specialty in multi-provider phase)
    const providerRow = await db.query.providers.findFirst({
      where: eq(providers.is_active, true),
    })
    const providerId = providerRow?.id ?? null

    // 2. Save intake as submitted — INSERT if no intakeId yet (auto-save may not have
    //    fired before Submit was clicked), otherwise UPDATE the existing draft.
    const intakeValues = {
      status: 'submitted' as const,
      answers,
      submitted_at: new Date(),
      ...(patientId ? { patient_id: patientId } : {}),
      ...(providerId ? { provider_id: providerId } : {}),
    }
    let finalIntakeId: string | null = intakeId
    if (!intakeId) {
      const [row] = await db.insert(intakes).values(intakeValues).returning({ id: intakes.id })
      finalIntakeId = row.id
    } else {
      await db.update(intakes).set(intakeValues).where(eq(intakes.id, intakeId))
    }

    // 2a. Compute WMI scores deterministically (pure math — fast, no AI needed)
    const wmiScores = computeWMI(answers)
    await db
      .update(intakes)
      .set({ wmi_scores: wmiScores })
      .where(eq(intakes.id, finalIntakeId!))

    // Advance onboarding_status from paid → active immediately so the patient
    // reaches their dashboard without waiting for Bedrock.
    if (patientId) {
      await db
        .update(patients)
        .set({ onboarding_status: 'active' })
        .where(eq(patients.id, patientId))
        .catch((err) => console.error('Failed to advance onboarding_status:', err))
    }

    // Send intake confirmation emails (fire and forget)
    if (patientId && process.env.RESEND_API_KEY) {
      sendIntakeEmails({ patientId, intakeId: finalIntakeId! }).catch(err =>
        console.error('[RESEND] Intake email error:', err)
      )
    }

    logPhiAccess({ providerId, patientId, recordType: 'intake', recordId: finalIntakeId, action: 'create', route: '/api/intake/submit', req })

    // Run Bedrock brief + component bodies in the background so the patient
    // is not blocked. waitUntil keeps the serverless function alive after the
    // response is sent.
    waitUntil(generateBriefInBackground({ intakeId: finalIntakeId!, patientId, answers, wmiScores }))

    return NextResponse.json({ success: true, briefGenerated: false })
  } catch (err: any) {
    console.error('Intake submit error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function generateBriefInBackground({
  intakeId,
  patientId,
  answers,
  wmiScores,
}: {
  intakeId: string
  patientId: string | null
  answers: Record<string, any>
  wmiScores: any
}) {
  let aiBrief: any = null
  try {
    aiBrief = await generateClinicalBrief(answers, wmiScores)
    await db.update(intakes).set({ ai_brief: aiBrief }).where(eq(intakes.id, intakeId))
  } catch (err) {
    console.error('[submit] AI brief generation error:', err)
    return
  }

  try {
    let firstName: string | null = null
    if (patientId) {
      const p = await db.query.patients.findFirst({
        where: eq(patients.id, patientId),
        with: { profiles: { columns: { first_name: true } } },
      })
      firstName = p?.profiles?.first_name ?? null
    }
    const component_bodies = await generateComponentBodies(answers, aiBrief, firstName)
    await db
      .update(intakes)
      .set({ ai_brief: { ...aiBrief, component_bodies } })
      .where(eq(intakes.id, intakeId))
  } catch (err) {
    console.error('[submit] Component bodies generation error:', err)
  }
}

async function sendIntakeEmails(
  { patientId, intakeId }: { patientId: string; intakeId: string }
) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const from = process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>'

  // Fetch patient name + email via join
  const patientRow = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    with: { profiles: true },
  })

  const profile = patientRow?.profiles ?? null
  const patientEmail = profile?.email
  const firstName = profile?.first_name || 'there'

  const submittedAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/Denver',
  }) + ' MT'

  // Email 1 — Patient confirmation
  if (patientEmail) {
    await resend.emails.send({
      from,
      to: patientEmail,
      subject: `We received your intake, ${firstName}`,
      html: buildEngagementEmail({
        heading: `Your intake is in, ${firstName}`,
        bodyHtml: `
          <p style="font-size: 15px; color: #7b6a62; line-height: 1.7; margin: 0;">
            Thank you for completing your health intake. Your provider will review it before your consultation. If you have any questions in the meantime, you can reach us through your dashboard.
          </p>
        `,
        ctaText: 'View Your Dashboard',
        ctaUrl: `${appUrl}/patient/dashboard`,
        patientId,
      }),
    })
    console.log(`[RESEND] Intake confirmation sent to ${patientEmail}`)
  }

  // Email 2 — Provider alert
  const providerEmail = process.env.PROVIDER_EMAIL
  if (providerEmail) {
    const patientFullName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : 'A new patient'

    await resend.emails.send({
      from,
      to: providerEmail,
      subject: 'New patient intake ready for review',
      html: buildEngagementEmail({
        heading: 'New intake ready to review',
        bodyHtml: `
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
            A new patient has completed their health intake.
          </p>
          <div style="background-color: #f7f3ee; border-radius: 12px; padding: 24px;">
            <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">${patientFullName}</p>
            <p style="margin: 0; font-size: 13px; color: #a1958f;">Submitted ${submittedAt}</p>
          </div>
        `,
        ctaText: 'Review Intake',
        ctaUrl: `${appUrl}/provider/patients/${patientId}`,
        patientId: '',
      }),
    })
    console.log(`[RESEND] New intake alert sent to ${providerEmail}`)
  }
}

