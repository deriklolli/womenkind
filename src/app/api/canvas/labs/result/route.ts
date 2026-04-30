import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { lab_orders, patients, profiles, notifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { logEngagement, buildEngagementEmail } from '@/lib/engagement'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'care@womenkindhealth.com'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const order = await db.select({ id: lab_orders.id, patient_id: lab_orders.patient_id, status: lab_orders.status })
    .from(lab_orders).where(eq(lab_orders.id, orderId)).limit(1)
  if (!order[0]) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order[0].status === 'resulted') return NextResponse.json({ ok: true, message: 'already resulted' })

  await db.update(lab_orders).set({ status: 'resulted' }).where(eq(lab_orders.id, orderId))

  const patientId = order[0].patient_id
  if (!patientId) return NextResponse.json({ ok: true })

  const patientRow = await db.select({ profile_id: patients.profile_id })
    .from(patients).where(eq(patients.id, patientId)).limit(1)
  if (!patientRow[0]) return NextResponse.json({ ok: true })

  const profileRow = await db.select({ email: profiles.email, first_name: profiles.first_name })
    .from(profiles).where(eq(profiles.id, patientRow[0].profile_id)).limit(1)
  if (!profileRow[0]?.email) return NextResponse.json({ ok: true })

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const firstName = profileRow[0].first_name ?? 'there'

  const html = buildEngagementEmail({
    heading: 'Your lab results are ready',
    bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:rgba(66,42,31,0.7);line-height:1.6;">Hi ${firstName} &mdash; your lab results are now available. Dr. Urban will review them and may follow up with you directly if anything needs attention.</p>`,
    ctaText: 'View in Dashboard',
    ctaUrl:  `${appUrl}/patient/dashboard`,
    patientId,
  })

  await resend.emails.send({ from: FROM, to: profileRow[0].email, subject: 'Your lab results are ready', html })

  await db.insert(notifications).values({
    patient_id: patientId,
    type:       'lab_results_ready',
    title:      'Your lab results are ready',
    body:       'Dr. Urban will review them shortly.',
    link_view:  'lab-results',
  })

  await logEngagement(patientId, 'lab_results_ready', 'email',  { lab_order_id: orderId })
  await logEngagement(patientId, 'lab_results_ready', 'in_app', { lab_order_id: orderId })

  return NextResponse.json({ ok: true })
}
