import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

/**
 * POST /api/auth/welcome
 * Sends a welcome email to a new patient after signup.
 * Body: { email: string, firstName: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, firstName } = await req.json()

    if (!email || !process.env.RESEND_API_KEY) {
      return NextResponse.json({ success: false })
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const name = firstName || 'there'

    const resend = getResend()
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>',
      to: email,
      subject: `Welcome to Womenkind, ${name}`,
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
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 36px 32px 36px;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #280f49;">
                Welcome to Womenkind, ${name}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #8e7f79; line-height: 1.6;">
                We're glad you're here. Womenkind is personalized menopause and midlife care, designed around you.
              </p>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #8e7f79; line-height: 1.6;">
                Your next step is to complete your intake survey. It takes about 15-20 minutes and helps your provider understand your health history, symptoms, and goals so they can prepare a personalized care plan before your first consultation.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 4px 0 32px 0;">
                    <a href="${appUrl}/intake" style="display: inline-block; padding: 14px 32px; background-color: #944fed; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 50px;">
                      Start Your Health Journey
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #bdb4b1; line-height: 1.5;">
                If you have any questions, simply reply to this email. We're here for you.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 32px 24px 48px 24px;">
        <p style="margin: 0; font-size: 12px; color: #d0cac7;">
          Womenkind -- Personalized menopause and midlife care
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Welcome email error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
