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
  // Resolve patient either from session (normal flow) or email cookie (session lost after signup)
  let patientId: string | null = null
  let profileEmail: string | null = null
  let firstName: string | null = null

  const session = await getServerSession()
  if (session?.role === 'patient' && session.patientId) {
    patientId = session.patientId
  } else {
    // Fall back to email passed from the verify page (stored in wk_signup_email cookie)
    const body = await req.json().catch(() => ({}))
    const email = body.email as string | undefined
    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rows = await db
      .select({ id: patients.id, email: profiles.email, firstName: profiles.first_name, status: patients.onboarding_status })
      .from(patients)
      .innerJoin(profiles, eq(patients.profile_id, profiles.id))
      .where(eq(profiles.email, email))
      .limit(1)
    const row = rows[0]
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    patientId = row.id
    profileEmail = row.email
    firstName = row.firstName
  }

  const patient = await db.query.patients.findFirst({ where: eq(patients.id, patientId!) })
  if (!patient || patient.onboarding_status !== 'unverified') {
    return NextResponse.json({ error: 'Not applicable' }, { status: 400 })
  }

  if (!profileEmail) {
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, patient.profile_id) })
    profileEmail = profile?.email ?? null
    firstName = profile?.first_name ?? null
  }

  if (!profileEmail) return NextResponse.json({ error: 'No email on file' }, { status: 400 })

  const recentlySent = await alreadySentRecently(patientId!, 'email_verification_resend', 0.007)
  if (recentlySent) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com'
  const { token, ts } = generateVerificationToken(patientId!)
  const verifyUrl = `${appUrl}/signup/verified?patientId=${patientId}&token=${token}&ts=${ts}`

  await resend.emails.send({
    from: FROM,
    to: profileEmail,
    subject: 'Verify your email — Womenkind Health',
    html: buildEngagementEmail({
      patientId: patientId!,
      heading: 'Verify your email address',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:#422a1f;line-height:1.6;">Hi ${firstName}, click below to verify your email address.</p><p style="margin:0 0 8px;font-size:14px;color:rgba(66,42,31,0.6);">This link expires in 24 hours.</p><p style="margin:0;font-size:14px;color:rgba(66,42,31,0.45);">Don't see this email? Check your spam or junk folder.</p>`,
      ctaText: 'Verify my email',
      ctaUrl: verifyUrl,
    }),
  })

  await logEngagement(patientId!, 'email_verification_resend', 'email')
  return NextResponse.json({ ok: true })
}
