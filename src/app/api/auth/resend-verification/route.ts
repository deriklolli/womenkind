// src/app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { generateVerificationToken } from '@/lib/auth-tokens'
import { buildEngagementEmail, FROM, alreadySentRecently, logEngagement } from '@/lib/engagement'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session || session.role !== 'patient') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, session.patientId!),
  })

  if (!patient || patient.onboarding_status !== 'unverified') {
    return NextResponse.json({ error: 'Not applicable' }, { status: 400 })
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, patient.profile_id),
  })

  if (!profile?.email) {
    return NextResponse.json({ error: 'No email on file' }, { status: 400 })
  }

  const recentlySent = await alreadySentRecently(patient.id, 'email_verification_resend', 0.007)
  if (recentlySent) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com'
  const { token, ts } = generateVerificationToken(patient.id)
  const verifyUrl = `${appUrl}/signup/verified?patientId=${patient.id}&token=${token}&ts=${ts}`

  await resend.emails.send({
    from: FROM,
    to: profile.email,
    subject: 'Verify your email — Womenkind Health',
    html: buildEngagementEmail({
      patientId: patient.id,
      heading: 'Verify your email address',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:#422a1f;line-height:1.6;">Hi ${profile.first_name}, click below to verify your email address.</p><p style="margin:0;font-size:14px;color:rgba(66,42,31,0.6);">This link expires in 24 hours.</p>`,
      ctaText: 'Verify my email',
      ctaUrl: verifyUrl,
    }),
  })

  await logEngagement(patient.id, 'email_verification_resend', 'email')

  return NextResponse.json({ ok: true })
}
