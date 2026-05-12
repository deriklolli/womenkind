import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { buildEngagementEmail } from '@/lib/engagement'

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
      html: buildEngagementEmail({
        heading: `Welcome to Womenkind, ${name}`,
        bodyHtml: `
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #8e7f79; line-height: 1.6;">
            We're glad you're here. Womenkind is personalized menopause and midlife care, designed around you.
          </p>
          <p style="margin: 0; font-size: 14px; color: #8e7f79; line-height: 1.6;">
            Your next step is to complete your intake survey. It takes about 15-20 minutes and helps your provider understand your health history, symptoms, and goals so they can prepare a personalized care plan before your first consultation.
          </p>
        `,
        ctaText: 'Start Your Health Journey',
        ctaUrl: `${appUrl}/intake`,
        patientId: '',
      }),
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Welcome email error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
