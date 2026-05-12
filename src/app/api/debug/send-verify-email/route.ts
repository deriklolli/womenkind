import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { generateVerificationToken } from '@/lib/auth-tokens'
import { buildEngagementEmail, FROM } from '@/lib/engagement'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const rows = await db.select({ id: patients.id, firstName: profiles.first_name })
    .from(patients).innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(profiles.email, email)).limit(1)
  const patient = rows[0]
  if (!patient) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const appUrl = 'https://www.womenkindhealth.com'
  const { token, ts } = generateVerificationToken(patient.id)
  const verifyUrl = `${appUrl}/signup/verified?patientId=${patient.id}&token=${token}&ts=${ts}`
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify your email — Womenkind Health',
    html: buildEngagementEmail({
      patientId: patient.id,
      heading: 'Verify your email address',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:#422a1f;line-height:1.6;">Hi ${patient.firstName}, click below to verify your email and continue setting up your Womenkind account.</p><p style="margin:0 0 8px;font-size:14px;color:rgba(66,42,31,0.6);">This link expires in 24 hours.</p><p style="margin:0;font-size:14px;color:rgba(66,42,31,0.45);">Don't see this email? Check your spam or junk folder.</p>`,
      ctaText: 'Verify my email',
      ctaUrl: verifyUrl,
    }),
  })
  return NextResponse.json({ ok: true, verifyUrl })
}
