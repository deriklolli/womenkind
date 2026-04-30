import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notification_preferences, patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyUnsubscribeToken } from '@/lib/engagement'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const token = searchParams.get('token')

  if (!patientId || !token || !verifyUnsubscribeToken(patientId, token)) {
    return new NextResponse('Invalid unsubscribe link.', { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  const patient = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1)
  if (patient.length === 0) {
    return new NextResponse('Patient not found.', { status: 404, headers: { 'Content-Type': 'text/html' } })
  }

  await db.insert(notification_preferences)
    .values({
      patient_id:        patientId,
      checkin_reminders: false,
      progress_updates:  false,
      care_alerts:       false,
    })
    .onConflictDoUpdate({
      target: notification_preferences.patient_id,
      set: {
        checkin_reminders: false,
        progress_updates:  false,
        care_alerts:       false,
        updated_at:        new Date(),
      },
    })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.womenkindhealth.com'
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Unsubscribed</title></head>
<body style="margin:0;padding:40px 20px;background-color:#f7f3ee;font-family:'Plus Jakarta Sans',Arial,sans-serif;text-align:center;">
  <img src="${appUrl}/womenkind-logo.png" alt="Womenkind" style="height:32px;margin-bottom:32px;" /><br/>
  <h1 style="font-size:24px;font-weight:400;color:#280f49;">You've been unsubscribed.</h1>
  <p style="color:rgba(66,42,31,0.6);max-width:400px;margin:16px auto;">You won't receive engagement emails from Womenkind. Prescription refill and lab result notifications will still be sent as part of your care.</p>
  <p style="margin-top:24px;"><a href="${appUrl}/patient/settings" style="color:#944fed;text-decoration:none;font-size:14px;">Manage preferences in Settings</a></p>
</body>
</html>`
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
}
