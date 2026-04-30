import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles, visits, appointments } from '@/lib/db/schema'
import { eq, and, gte, lte, gt } from 'drizzle-orm'
import { Resend } from 'resend'
import { alreadySentRecently, logEngagement, isEngagementEnabled, buildEngagementEmail } from '@/lib/engagement'
import { computeLiveWMI } from '@/lib/wmi-scoring'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

const DOMAIN_NAMES: Record<string, string> = {
  vasomotor: 'Vasomotor', sleep: 'Sleep', energy: 'Energy', mood: 'Mood',
  cognition: 'Cognition', gsm: 'Hormonal', bone: 'Bone Health',
  weight: 'Metabolism', libido: 'Libido', cardio: 'Cardiovascular',
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString().slice(0, 10)
  const sixtyDaysAgoIso  = sixtyDaysAgo.toISOString().slice(0, 10)

  const activePatients = await db
    .selectDistinct({ id: patients.id, profile_id: patients.profile_id })
    .from(patients)
    .innerJoin(visits, and(eq(visits.patient_id, patients.id), eq(visits.source, 'daily')))
    .where(eq(patients.is_active, true))

  let sent = 0
  let skipped = 0

  for (const patient of activePatients) {
    if (!await isEngagementEnabled(patient.id, 'monthly_recap')) { skipped++; continue }
    if (await alreadySentRecently(patient.id, 'monthly_recap', 28)) { skipped++; continue }

    const profile = await db.select({ email: profiles.email, first_name: profiles.first_name })
      .from(profiles).where(eq(profiles.id, patient.profile_id)).limit(1)
    if (!profile[0]?.email) { skipped++; continue }

    const recentCheckins = await db.select({ visit_date: visits.visit_date, symptom_scores: visits.symptom_scores, source: visits.source })
      .from(visits)
      .where(and(eq(visits.patient_id, patient.id), eq(visits.source, 'daily'), gte(visits.visit_date, thirtyDaysAgoIso)))
    if (recentCheckins.length === 0) { skipped++; continue }

    const prevCheckins = await db.select({ visit_date: visits.visit_date, symptom_scores: visits.symptom_scores, source: visits.source })
      .from(visits)
      .where(and(
        eq(visits.patient_id, patient.id), eq(visits.source, 'daily'),
        gte(visits.visit_date, sixtyDaysAgoIso), lte(visits.visit_date, thirtyDaysAgoIso),
      ))

    const toWmiInput = (rows: typeof recentCheckins) =>
      rows.map(r => ({ ...r, symptom_scores: r.symptom_scores as Record<string, number> | null }))

    const currentWmi = computeLiveWMI(toWmiInput(recentCheckins))
    const prevWmi    = prevCheckins.length > 0 ? computeLiveWMI(toWmiInput(prevCheckins)) : null
    const wmiDelta   = currentWmi !== null && prevWmi !== null ? Math.round((currentWmi - prevWmi) * 10) / 10 : null

    // Top improving domain (lower burden = better for most domains)
    let topDomain: string | null = null
    let topImprovement = -Infinity
    for (const domain of Object.keys(DOMAIN_NAMES)) {
      const recentWithScore = recentCheckins.filter(c => c.symptom_scores && typeof (c.symptom_scores as any)[domain] === 'number')
      const prevWithScore   = prevCheckins.filter(c => c.symptom_scores && typeof (c.symptom_scores as any)[domain] === 'number')
      if (recentWithScore.length === 0 || prevWithScore.length === 0) continue
      const avgRecent = recentWithScore.reduce((s, c) => s + (c.symptom_scores as any)[domain], 0) / recentWithScore.length
      const avgPrev   = prevWithScore.reduce((s, c) => s + (c.symptom_scores as any)[domain], 0) / prevWithScore.length
      const improvement = avgPrev - avgRecent  // lower is better on burden scale
      if (improvement > topImprovement) { topImprovement = improvement; topDomain = domain }
    }

    const upcomingAppt = await db.select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.patient_id, patient.id), gt(appointments.ends_at, now), eq(appointments.status, 'confirmed')))
      .limit(1)
    const hasUpcoming = upcomingAppt.length > 0

    const firstName  = profile[0].first_name ?? 'there'
    const monthName  = now.toLocaleDateString('en-US', { month: 'long' })
    const wmiDisplay = currentWmi !== null ? Math.round(currentWmi) : null
    const deltaText  = wmiDelta !== null
      ? wmiDelta > 0 ? `<span style="color:#0e7a5a">&#9650; ${wmiDelta} pts</span>`
        : wmiDelta < 0 ? `<span style="color:#b91c1c">&#9660; ${Math.abs(wmiDelta)} pts</span>`
        : 'Holding steady'
      : ''

    const bodyHtml = `
      <p style="margin:0 0 20px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName}, here&rsquo;s your ${monthName} summary.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ee;border-radius:14px;padding:20px;margin:0 0 20px;">
        <tr>
          <td style="text-align:center;padding:8px 16px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Womenkind Score</p>
            <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#280f49;">${wmiDisplay ?? '&mdash;'}</p>
            ${deltaText ? `<p style="margin:4px 0 0;font-size:13px;">${deltaText} from last month</p>` : ''}
          </td>
          <td style="text-align:center;padding:8px 16px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Check-ins</p>
            <p style="margin:4px 0 0;font-size:32px;font-weight:700;color:#280f49;">${recentCheckins.length}</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(66,42,31,0.5);">in the past 30 days</p>
          </td>
          ${topDomain ? `<td style="text-align:center;padding:8px 16px;"><p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(66,42,31,0.45);">Most Improved</p><p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#280f49;">${DOMAIN_NAMES[topDomain]}</p></td>` : ''}
        </tr>
      </table>
      ${!hasUpcoming ? `<p style="margin:0 0 8px;font-size:14px;color:rgba(66,42,31,0.6);line-height:1.6;">You don&rsquo;t have a follow-up visit scheduled. Regular check-ins with Dr. Urban help keep your treatment plan on track.</p>` : ''}
    `

    const html = buildEngagementEmail({
      heading: `Your ${monthName} progress`,
      bodyHtml,
      ctaText: 'View Your Dashboard',
      ctaUrl:  `${appUrl}/patient/dashboard`,
      secondaryCtaText: !hasUpcoming ? 'Book a Follow-Up Visit' : undefined,
      secondaryCtaUrl:  !hasUpcoming ? `${appUrl}/patient/schedule` : undefined,
      patientId: patient.id,
    })

    await resend.emails.send({
      from: FROM,
      to:   profile[0].email,
      subject: `Your ${monthName} progress with Womenkind`,
      html,
    })

    await logEngagement(patient.id, 'monthly_recap', 'email', { wmi: currentWmi, checkin_count: recentCheckins.length })
    sent++
  }

  return NextResponse.json({ sent, skipped })
}
