import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles, visits, notifications } from '@/lib/db/schema'
import { eq, and, gte } from 'drizzle-orm'
import { Resend } from 'resend'
import { alreadySentRecently, logEngagement, isEngagementEnabled, buildEngagementEmail } from '@/lib/engagement'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'

  // Active patients = is_active AND has at least one daily check-in
  const activePatients = await db
    .selectDistinct({ id: patients.id, profile_id: patients.profile_id })
    .from(patients)
    .innerJoin(visits, and(eq(visits.patient_id, patients.id), eq(visits.source, 'daily')))
    .where(eq(patients.is_active, true))

  // Monday of current week
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const mondayIso = monday.toISOString().slice(0, 10)

  let sent = 0
  let skipped = 0

  for (const patient of activePatients) {
    if (!await isEngagementEnabled(patient.id, 'weekly_nudge')) { skipped++; continue }
    if (await alreadySentRecently(patient.id, 'weekly_nudge', 7)) { skipped++; continue }

    // Skip if already checked in this week
    const checkedIn = await db.select({ id: visits.id })
      .from(visits)
      .where(and(
        eq(visits.patient_id, patient.id),
        eq(visits.source, 'daily'),
        gte(visits.visit_date, mondayIso),
      ))
      .limit(1)
    if (checkedIn.length > 0) { skipped++; continue }

    const profile = await db.select({ email: profiles.email, first_name: profiles.first_name })
      .from(profiles).where(eq(profiles.id, patient.profile_id)).limit(1)
    if (!profile[0]?.email) { skipped++; continue }

    const firstName = profile[0].first_name ?? 'there'
    const html = buildEngagementEmail({
      heading: 'Time for your weekly check-in',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName}, your weekly symptom check-in takes about 60 seconds and helps Dr. Urban track your progress over time.</p>`,
      ctaText: 'Log Check-In',
      ctaUrl:  `${appUrl}/patient/dashboard`,
      patientId: patient.id,
    })

    await resend.emails.send({
      from: FROM,
      to:   profile[0].email,
      subject: 'Your weekly check-in is ready',
      html,
    })

    await db.insert(notifications).values({
      patient_id: patient.id,
      type:       'checkin_reminder',
      title:      'Time for your check-in',
      body:       "Log how you're feeling this week — takes 60 seconds.",
      link_view:  'scorecard',
    })

    await logEngagement(patient.id, 'weekly_nudge', 'email')
    await logEngagement(patient.id, 'weekly_nudge', 'in_app')
    sent++
  }

  return NextResponse.json({ sent, skipped })
}
