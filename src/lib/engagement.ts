import { createHmac } from 'crypto'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { engagement_log, notification_preferences } from '@/lib/db/schema'
import { eq, and, gte } from 'drizzle-orm'

export const resend = new Resend(process.env.RESEND_API_KEY)
export const FROM = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

// ── Frequency cap ─────────────────────────────────────────────────────────────

export async function alreadySentRecently(
  patientId: string,
  triggerType: string,
  withinDays: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000)
  const rows = await db.select({ id: engagement_log.id })
    .from(engagement_log)
    .where(and(
      eq(engagement_log.patient_id, patientId),
      eq(engagement_log.trigger_type, triggerType),
      gte(engagement_log.sent_at, cutoff),
    ))
    .limit(1)
  return rows.length > 0
}

// ── Log a sent message ────────────────────────────────────────────────────────

export async function logEngagement(
  patientId: string,
  triggerType: string,
  channel: 'email' | 'in_app',
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(engagement_log).values({
    patient_id:   patientId,
    trigger_type: triggerType,
    channel,
    metadata:     metadata ?? null,
  })
}

// ── Preference check ──────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, 'checkin_reminders' | 'progress_updates' | 'care_alerts'> = {
  weekly_nudge:    'checkin_reminders',
  missed_checkins: 'checkin_reminders',
  monthly_recap:   'progress_updates',
  score_drop:      'care_alerts',
  post_visit:      'care_alerts',
  // rx_refill and lab_results_ready not in map → always send
}

export async function isEngagementEnabled(patientId: string, triggerType: string): Promise<boolean> {
  const category = CATEGORY_MAP[triggerType]
  if (!category) return true  // clinical trigger — always send
  const rows = await db.select()
    .from(notification_preferences)
    .where(eq(notification_preferences.patient_id, patientId))
    .limit(1)
  if (rows.length === 0) return true  // no row = all defaults on
  return rows[0][category]
}

// ── Unsubscribe token ─────────────────────────────────────────────────────────

export function generateUnsubscribeToken(patientId: string): string {
  return createHmac('sha256', process.env.CRON_SECRET!).update(patientId).digest('hex')
}

export function verifyUnsubscribeToken(patientId: string, token: string): boolean {
  return generateUnsubscribeToken(patientId) === token
}

// ── Email HTML builder ────────────────────────────────────────────────────────

export function buildEngagementEmail(params: {
  heading: string
  bodyHtml: string
  ctaText: string
  ctaUrl: string
  secondaryCtaText?: string
  secondaryCtaUrl?: string
  patientId: string
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const token = generateUnsubscribeToken(params.patientId)
  const unsubUrl = `${appUrl}/api/engagement/unsubscribe?patientId=${encodeURIComponent(params.patientId)}&token=${token}`
  const prefsUrl = `${appUrl}/patient/settings`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7f3ee;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f3ee;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:48px 48px 32px;text-align:center;">
    <img src="${appUrl}/womenkind-logo.png" alt="Womenkind" style="height:32px;" />
  </td></tr>
  <tr><td style="background-color:#ffffff;border-radius:20px;padding:40px 48px;">
    <p style="margin:0 0 8px;font-size:12px;color:rgba(66,42,31,0.45);font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Womenkind Health</p>
    <h1 style="margin:0 0 20px;font-size:26px;font-weight:400;color:#280f49;line-height:1.3;">${params.heading}</h1>
    ${params.bodyHtml}
    <div style="margin:28px 0 0;">
      <a href="${params.ctaUrl}" style="display:inline-block;background-color:#944fed;color:white;padding:14px 32px;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;">${params.ctaText}</a>
    </div>
    ${params.secondaryCtaText ? `<p style="margin:16px 0 0;"><a href="${params.secondaryCtaUrl}" style="color:#944fed;text-decoration:none;font-size:14px;">${params.secondaryCtaText}</a></p>` : ''}
  </td></tr>
  <tr><td style="padding:24px 48px;text-align:center;">
    <p style="font-size:12px;color:rgba(66,42,31,0.45);margin:0 0 8px;">Womenkind Health · Concierge menopause care</p>
    <p style="font-size:11px;color:rgba(66,42,31,0.35);margin:0;">
      <a href="${prefsUrl}" style="color:rgba(66,42,31,0.45);text-decoration:underline;">Manage email preferences</a>
      &nbsp;·&nbsp;
      <a href="${unsubUrl}" style="color:rgba(66,42,31,0.45);text-decoration:underline;">Unsubscribe from all</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
