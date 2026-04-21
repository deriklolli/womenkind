import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { logPhiAccess } from '@/lib/phi-audit'
import { getServerSession } from '@/lib/getServerSession'
import { generateClinicalBrief } from '@/lib/intake-brief'
import { db } from '@/lib/db'
import { intakes, providers, patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/intake/submit
 * Finalizes an intake: marks as submitted, triggers AI brief generation
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { intakeId, patientId, answers } = await req.json()

    // If a patientId is supplied, verify it belongs to the authenticated user.
    // Providers submitting on a patient's behalf are also allowed.
    if (patientId && session.role === 'patient' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. Resolve provider — look up the first active provider as the intake recipient
    //    (single-provider MVP; extend this to match by location/specialty in multi-provider phase)
    const providerRow = await db.query.providers.findFirst({
      where: eq(providers.is_active, true),
    })
    const providerId = providerRow?.id ?? null

    // 2. Update intake status to submitted (and link to patient + provider if resolved)
    await db
      .update(intakes)
      .set({
        status: 'submitted',
        answers,
        submitted_at: new Date(),
        ...(patientId ? { patient_id: patientId } : {}),
        ...(providerId ? { provider_id: providerId } : {}),
      })
      .where(eq(intakes.id, intakeId))

    // 2. Generate AI clinical brief via Bedrock
    let aiBrief = null
    try {
      aiBrief = await generateClinicalBrief(answers)

      // Save brief to intake
      await db
        .update(intakes)
        .set({ ai_brief: aiBrief })
        .where(eq(intakes.id, intakeId))
    } catch (aiErr) {
      console.error('AI brief generation error:', aiErr)
      // Don't fail the submission — brief can be generated later
    }

    // Send intake confirmation emails (fire and forget)
    if (patientId && process.env.RESEND_API_KEY) {
      sendIntakeEmails({ patientId, intakeId }).catch(err =>
        console.error('[RESEND] Intake email error:', err)
      )
    }

    logPhiAccess({ providerId, patientId, recordType: 'intake', recordId: intakeId, action: 'create', route: '/api/intake/submit', req })
    return NextResponse.json({
      success: true,
      briefGenerated: !!aiBrief,
    })
  } catch (err: any) {
    console.error('Intake submit error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
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
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body bgcolor="#f7f3ee" style="margin: 0; padding: 0; background-color: #f7f3ee; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee;">
    <tr>
      <td align="center" style="padding: 48px 24px 40px 24px;">
        <img src="${appUrl}/womenkind-logo-dark.png" alt="Womenkind" style="height: 96px;" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 24px 48px 24px;">
        <table role="presentation" width="610" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 610px; width: 100%; background-color: #ffffff; border-radius: 20px; border: 1px solid #f2f1f4;">
          <tr>
            <td style="padding: 48px 44px;">
              <h1 style="font-family: Georgia, 'Playfair Display', serif; font-size: 26px; color: #280f49; margin: 0 0 8px 0; font-weight: normal;">
                Your intake is in, ${firstName}
              </h1>
              <p style="font-size: 15px; color: #7b6a62; line-height: 1.7; margin: 0 0 32px 0;">
                Thank you for completing your health intake. Your provider will review it before your consultation. If you have any questions in the meantime, you can reach us through your dashboard.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #944fed; border-radius: 9999px;">
                          <a href="${appUrl}/patient/dashboard" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 15px; font-weight: 500; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;">
                            View Your Dashboard&nbsp;&nbsp;&#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 24px 48px 24px;">
        <p style="font-size: 12px; color: #d0cac7; margin: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;">
          Womenkind &mdash; Personalized menopause &amp; midlife care
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
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
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body bgcolor="#f7f3ee" style="margin: 0; padding: 0; background-color: #f7f3ee; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee;">
    <tr>
      <td align="center" style="padding: 48px 24px 40px 24px;">
        <img src="${appUrl}/womenkind-logo-dark.png" alt="Womenkind" style="height: 96px;" />
      </td>
    </tr>
    <tr>
      <td align="center">
        <table role="presentation" width="610" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 610px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 36px 32px 36px;">
              <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: normal; font-family: Georgia, 'Playfair Display', serif; color: #280f49;">
                New intake ready to review
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
                A new patient has completed their health intake.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">
                      ${patientFullName}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #a1958f;">
                      Submitted ${submittedAt}
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/provider/patients/${patientId}" style="display: inline-block; padding: 14px 32px; background-color: #944fed; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
                      Review Intake
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 32px 24px 48px 24px;">
        <p style="margin: 0; font-size: 12px; color: #bdb4b1;">
          Womenkind &mdash; Personalized menopause &amp; midlife care
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    })
    console.log(`[RESEND] New intake alert sent to ${providerEmail}`)
  }
}

