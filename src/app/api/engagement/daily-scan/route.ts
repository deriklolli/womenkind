import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { patients, profiles, visits, prescriptions, notifications } from '@/lib/db/schema'
import { eq, and, gte, lte, ne } from 'drizzle-orm'
import { Resend } from 'resend'
import { alreadySentRecently, logEngagement, isEngagementEnabled, buildEngagementEmail } from '@/lib/engagement'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const now    = new Date()

  const activePatients = await db
    .selectDistinct({ id: patients.id, profile_id: patients.profile_id })
    .from(patients)
    .innerJoin(visits, and(eq(visits.patient_id, patients.id), eq(visits.source, 'daily')))
    .where(eq(patients.is_active, true))

  // Supabase admin client to read last_sign_in_at from auth.users
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const loginMap = new Map(users.map(u => [u.id, u.last_sign_in_at ? new Date(u.last_sign_in_at) : null]))

  const results = { missed_checkins: 0, no_login: 0, rx_refill: 0, post_visit: 0, skipped: 0 }

  for (const patient of activePatients) {
    const profile = await db.select({ email: profiles.email, first_name: profiles.first_name })
      .from(profiles).where(eq(profiles.id, patient.profile_id)).limit(1)
    if (!profile[0]?.email) { results.skipped++; continue }
    const firstName = profile[0].first_name ?? 'there'
    const email     = profile[0].email

    // ── A: Missed check-ins (no daily check-in in last 14 days) ───────────────
    if (await isEngagementEnabled(patient.id, 'missed_checkins') && !await alreadySentRecently(patient.id, 'missed_checkins', 7)) {
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const recentCheckin = await db.select({ id: visits.id })
        .from(visits)
        .where(and(eq(visits.patient_id, patient.id), eq(visits.source, 'daily'), gte(visits.visit_date, fourteenDaysAgo)))
        .limit(1)
      if (recentCheckin.length === 0) {
        const html = buildEngagementEmail({
          heading: `We've missed you, ${firstName}`,
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Life gets busy &mdash; we get it. Your symptom data is most useful when it&rsquo;s consistent, but there&rsquo;s no pressure. Jump back in whenever you&rsquo;re ready.</p>`,
          ctaText: 'Log a Check-In',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          patientId: patient.id,
        })
        await resend.emails.send({ from: FROM, to: email, subject: "We've missed you", html })
        await logEngagement(patient.id, 'missed_checkins', 'email')
        results.missed_checkins++
      }
    }

    // ── B: No login in 30+ days ───────────────────────────────────────────────
    if (await isEngagementEnabled(patient.id, 'no_login') && !await alreadySentRecently(patient.id, 'no_login', 14)) {
      const lastLogin = loginMap.get(patient.profile_id)
      const daysSince = lastLogin ? (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24) : 999
      if (daysSince >= 30) {
        const html = buildEngagementEmail({
          heading: 'Your care team is still here',
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName} &mdash; we haven&rsquo;t gone anywhere. Your health journey continues whenever you&rsquo;re ready to pick it up. Log in to see your progress and connect with Dr. Urban.</p>`,
          ctaText: 'Go to My Dashboard',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          patientId: patient.id,
        })
        await resend.emails.send({ from: FROM, to: email, subject: 'Your care team is still here', html })
        await logEngagement(patient.id, 'no_login', 'email')
        results.no_login++
      }
    }

    // ── C: Rx refill due in ≤7 days ───────────────────────────────────────────
    if (!await alreadySentRecently(patient.id, 'rx_refill', 7)) {
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const duePrescriptions = await db.select({ id: prescriptions.id, medication_name: prescriptions.medication_name, runs_out_at: prescriptions.runs_out_at })
        .from(prescriptions)
        .where(and(
          eq(prescriptions.patient_id, patient.id),
          eq(prescriptions.status, 'active'),
          gte(prescriptions.runs_out_at, now),
          lte(prescriptions.runs_out_at, sevenDaysFromNow),
        ))
      for (const rx of duePrescriptions) {
        if (!rx.runs_out_at) continue
        const runOutDate = rx.runs_out_at.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Denver' })
        const html = buildEngagementEmail({
          heading: `Time to refill your ${rx.medication_name}`,
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Your <strong>${rx.medication_name}</strong> prescription runs out around <strong>${runOutDate}</strong>. Request your refill now to avoid a gap in your treatment.</p>`,
          ctaText: 'Request Refill',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          patientId: patient.id,
        })
        await resend.emails.send({ from: FROM, to: email, subject: `Time to refill your ${rx.medication_name}`, html })
        await db.insert(notifications).values({
          patient_id: patient.id,
          type:       'rx_refill_reminder',
          title:      `Refill due: ${rx.medication_name}`,
          body:       'Your prescription runs out soon. Request a refill now.',
          link_view:  'refill',
        })
        await logEngagement(patient.id, 'rx_refill', 'email',   { medication_name: rx.medication_name })
        await logEngagement(patient.id, 'rx_refill', 'in_app',  { medication_name: rx.medication_name })
        results.rx_refill++
      }
    }

    // ── D: Post-visit follow-up (provider visits created 47–71 hours ago) ─────
    if (await isEngagementEnabled(patient.id, 'post_visit') && !await alreadySentRecently(patient.id, 'post_visit', 30)) {
      const cutoffStart = new Date(now.getTime() - 71 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const cutoffEnd   = new Date(now.getTime() - 47 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const recentVisit = await db.select({ id: visits.id })
        .from(visits)
        .where(and(
          eq(visits.patient_id, patient.id),
          ne(visits.source, 'daily'),
          gte(visits.visit_date, cutoffStart),
          lte(visits.visit_date, cutoffEnd),
        ))
        .limit(1)
      if (recentVisit.length > 0) {
        const html = buildEngagementEmail({
          heading: 'How are you feeling after your visit?',
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName} &mdash; we hope your visit with Dr. Urban went well. Your next check-in is a great way to start tracking progress against your care plan. And if you have any questions, we&rsquo;re always here.</p>`,
          ctaText: 'Log a Check-In',
          ctaUrl:  `${appUrl}/patient/dashboard`,
          secondaryCtaText: 'Message Dr. Urban',
          secondaryCtaUrl:  `${appUrl}/patient/dashboard`,
          patientId: patient.id,
        })
        await resend.emails.send({ from: FROM, to: email, subject: 'How are you feeling after your visit?', html })
        await logEngagement(patient.id, 'post_visit', 'email')
        results.post_visit++
      }
    }
  }

  return NextResponse.json(results)
}
