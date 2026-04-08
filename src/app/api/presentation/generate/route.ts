import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

export async function POST(req: Request) {
  try {
    const {
      patientId,
      providerId,
      selectedComponents,
      componentNotes,
      welcomeMessage,
      closingMessage,
    } = await req.json()

    if (!patientId || !providerId || !selectedComponents?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get the latest intake for this patient (optional link)
    const { data: latestIntake } = await supabase
      .from('intakes')
      .select('id')
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()

    // Get patient email for sending
    const { data: patient } = await supabase
      .from('patients')
      .select('profiles ( first_name, last_name, email )')
      .eq('id', patientId)
      .single()

    const patientProfile = (patient as any)?.profiles
    const patientEmail = patientProfile?.email
    const patientFirstName = patientProfile?.first_name || 'there'

    // Create the presentation record
    const { data: presentation, error } = await supabase
      .from('care_presentations')
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        intake_id: latestIntake?.id || null,
        selected_components: selectedComponents,
        component_notes: componentNotes,
        welcome_message: welcomeMessage,
        closing_message: closingMessage,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const presentationUrl = `${appUrl}/presentation/${presentation.id}`

    // Send email via Resend
    let emailSent = false
    if (patientEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = getResend()
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>',
          to: patientEmail,
          subject: 'Your Personalized Care Summary is Ready',
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; border: 1px solid #f2f1f4;">
          <tr>
            <td style="padding: 48px 44px;">
              <h1 style="font-family: Georgia, 'Playfair Display', serif; font-size: 22px; color: #280f49; margin: 0 0 8px 0; font-weight: normal;">
                Hi ${patientFirstName},
              </h1>
              <p style="font-size: 15px; color: #7b6a62; line-height: 1.7; margin: 0 0 8px 0;">
                Your provider has prepared a personalized care summary just for you.
              </p>
              <p style="font-size: 15px; color: #7b6a62; line-height: 1.7; margin: 0 0 32px 0;">
                It covers what's happening in your body and the recommended plan to help you feel your best.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #944fed; border-radius: 9999px;">
                          <a href="${presentationUrl}" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 15px; font-weight: 500; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;">
                            View Your Care Summary&nbsp;&nbsp;&#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="font-size: 13px; color: #b3aaa5; line-height: 1.5; margin: 28px 0 0 0; text-align: center;">
                You can also access this anytime from your patient portal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 24px 48px 24px;">
        <p style="font-size: 12px; color: #d0cac7; margin: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;">
          Womenkind — Personalized menopause &amp; midlife care
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
          `,
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
