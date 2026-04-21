import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clinic_appointment_requests, patients, profiles, clinics } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'

/**
 * POST /api/clinics/request
 * Saves an in-person appointment request and emails the provider.
 *
 * Body: {
 *   patientId: string
 *   clinicId: string
 *   preferredDates: string   // freeform text
 *   preferredTime: 'morning' | 'afternoon' | 'either'
 *   notes?: string
 *   contactPhone?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { patientId, clinicId, preferredDates, preferredTime, notes, contactPhone } =
      await req.json()

    if (!patientId || !clinicId || !preferredDates || !preferredTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Save the request
    const [requestRow] = await db
      .insert(clinic_appointment_requests)
      .values({
        patient_id: patientId,
        clinic_id: clinicId,
        preferred_dates: preferredDates,
        preferred_time: preferredTime,
        notes: notes || null,
        contact_phone: contactPhone || null,
        status: 'pending',
      })
      .returning({ id: clinic_appointment_requests.id })

    if (!requestRow) {
      console.error('[clinic/request] Insert returned no row')
      return NextResponse.json({ error: 'Failed to save request' }, { status: 500 })
    }

    // Fire-and-forget email to provider
    if (process.env.RESEND_API_KEY) {
      sendProviderEmail({
        patientId,
        clinicId,
        preferredDates,
        preferredTime,
        notes,
        contactPhone,
      }).catch(err => console.error('[clinic/request] Email error:', err))
    }

    return NextResponse.json({ success: true, requestId: requestRow.id })
  } catch (err: any) {
    console.error('[clinic/request] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function sendProviderEmail(opts: {
  patientId: string
  clinicId: string
  preferredDates: string
  preferredTime: string
  notes?: string
  contactPhone?: string
}) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const from = process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>'
  const providerEmail = process.env.PROVIDER_EMAIL
  if (!providerEmail) return

  // Fetch patient name + email
  const patientRows = await db
    .select({
      first_name: profiles.first_name,
      last_name: profiles.last_name,
      email: profiles.email,
    })
    .from(patients)
    .leftJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(patients.id, opts.patientId))
    .limit(1)

  const profile = patientRows[0] || null
  const patientName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : 'A patient'
  const patientEmail = profile?.email || ''

  // Fetch clinic name
  const clinicRows = await db
    .select({
      name: clinics.name,
      address: clinics.address,
      city: clinics.city,
      state: clinics.state,
    })
    .from(clinics)
    .where(eq(clinics.id, opts.clinicId))
    .limit(1)

  const clinic = clinicRows[0] || null
  const clinicLabel = clinic
    ? `${clinic.name} — ${clinic.address}, ${clinic.city}, ${clinic.state}`
    : 'Unknown clinic'

  const timeLabel =
    opts.preferredTime === 'morning'
      ? 'Morning (before noon)'
      : opts.preferredTime === 'afternoon'
        ? 'Afternoon (noon–5 pm)'
        : 'Either / flexible'

  const submittedAt = new Date().toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Denver',
  }) + ' MT'

  await resend.emails.send({
    from,
    to: providerEmail,
    subject: `In-person visit request from ${patientName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body bgcolor="#f7f3ee" style="margin:0;padding:0;background-color:#f7f3ee;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee">
    <tr>
      <td align="center" style="padding:48px 24px 40px 24px;">
        <img src="${appUrl}/womenkind-logo-dark.png" alt="Womenkind" style="height:96px;" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 24px 48px 24px;">
        <table role="presentation" width="610" cellpadding="0" cellspacing="0" bgcolor="#ffffff"
          style="max-width:610px;width:100%;background-color:#ffffff;border-radius:20px;border:1px solid #f2f1f4;">
          <tr>
            <td style="padding:48px 44px;">
              <h1 style="font-family:Georgia,'Playfair Display',serif;font-size:24px;color:#280f49;margin:0 0 8px 0;font-weight:normal;">
                New in-person visit request
              </h1>
              <p style="font-size:14px;color:#7b6a62;line-height:1.7;margin:0 0 32px 0;">
                ${patientName} has requested an in-person appointment. Submitted ${submittedAt}.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                bgcolor="#f7f3ee" style="background-color:#f7f3ee;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <p style="margin:0;font-size:11px;font-weight:600;color:#a1958f;text-transform:uppercase;letter-spacing:0.06em;">Patient</p>
                          <p style="margin:4px 0 0 0;font-size:15px;font-weight:600;color:#280f49;">${patientName}</p>
                          ${patientEmail ? `<p style="margin:2px 0 0 0;font-size:13px;color:#a1958f;">${patientEmail}</p>` : ''}
                          ${opts.contactPhone ? `<p style="margin:2px 0 0 0;font-size:13px;color:#a1958f;">${opts.contactPhone}</p>` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:12px;border-top:1px solid #ede8e3;padding-top:12px;">
                          <p style="margin:0;font-size:11px;font-weight:600;color:#a1958f;text-transform:uppercase;letter-spacing:0.06em;">Clinic</p>
                          <p style="margin:4px 0 0 0;font-size:14px;color:#280f49;">${clinicLabel}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:12px;border-top:1px solid #ede8e3;padding-top:12px;">
                          <p style="margin:0;font-size:11px;font-weight:600;color:#a1958f;text-transform:uppercase;letter-spacing:0.06em;">Preferred dates</p>
                          <p style="margin:4px 0 0 0;font-size:14px;color:#280f49;">${opts.preferredDates}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="${opts.notes ? 'padding-bottom:12px;' : ''}border-top:1px solid #ede8e3;padding-top:12px;">
                          <p style="margin:0;font-size:11px;font-weight:600;color:#a1958f;text-transform:uppercase;letter-spacing:0.06em;">Preferred time of day</p>
                          <p style="margin:4px 0 0 0;font-size:14px;color:#280f49;">${timeLabel}</p>
                        </td>
                      </tr>
                      ${opts.notes ? `
                      <tr>
                        <td style="border-top:1px solid #ede8e3;padding-top:12px;">
                          <p style="margin:0;font-size:11px;font-weight:600;color:#a1958f;text-transform:uppercase;letter-spacing:0.06em;">Additional notes</p>
                          <p style="margin:4px 0 0 0;font-size:14px;color:#280f49;line-height:1.6;">${opts.notes}</p>
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color:#944fed;border-radius:9999px;">
                          <a href="${appUrl}/provider/patients/${opts.patientId}"
                            style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 32px;font-size:15px;font-weight:500;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;">
                            View Patient Profile&nbsp;&nbsp;&#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 24px 48px 24px;">
        <p style="font-size:12px;color:#d0cac7;margin:0;">
          Womenkind &mdash; Personalized menopause &amp; midlife care
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  })

  console.log(`[clinic/request] In-person request email sent to ${providerEmail}`)
}
