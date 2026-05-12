import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clinic_appointment_requests, patients, profiles, clinics } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { buildEngagementEmail } from '@/lib/engagement'
import { getServerSession } from '@/lib/getServerSession'

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
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { patientId, clinicId, preferredDates, preferredTime, notes, contactPhone } =
      await req.json()

    if (!patientId || !clinicId || !preferredDates || !preferredTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (session.role === 'patient' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    html: buildEngagementEmail({
      heading: 'New in-person visit request',
      bodyHtml: `
        <p style="font-size: 14px; color: #7b6a62; line-height: 1.7; margin: 0 0 20px 0;">
          ${patientName} has requested an in-person appointment. Submitted ${submittedAt}.
        </p>
        <div style="background-color: #f7f3ee; border-radius: 12px; padding: 24px; margin-bottom: 8px;">
          <div style="padding-bottom: 12px;">
            <p style="margin: 0; font-size: 11px; font-weight: 600; color: #a1958f; text-transform: uppercase; letter-spacing: 0.06em;">Patient</p>
            <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 600; color: #280f49;">${patientName}</p>
            ${patientEmail ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #a1958f;">${patientEmail}</p>` : ''}
            ${opts.contactPhone ? `<p style="margin: 2px 0 0 0; font-size: 13px; color: #a1958f;">${opts.contactPhone}</p>` : ''}
          </div>
          <div style="padding: 12px 0; border-top: 1px solid #ede8e3;">
            <p style="margin: 0; font-size: 11px; font-weight: 600; color: #a1958f; text-transform: uppercase; letter-spacing: 0.06em;">Clinic</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #280f49;">${clinicLabel}</p>
          </div>
          <div style="padding: 12px 0; border-top: 1px solid #ede8e3;">
            <p style="margin: 0; font-size: 11px; font-weight: 600; color: #a1958f; text-transform: uppercase; letter-spacing: 0.06em;">Preferred dates</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #280f49;">${opts.preferredDates}</p>
          </div>
          <div style="padding-top: 12px; border-top: 1px solid #ede8e3; ${opts.notes ? 'padding-bottom: 12px;' : ''}">
            <p style="margin: 0; font-size: 11px; font-weight: 600; color: #a1958f; text-transform: uppercase; letter-spacing: 0.06em;">Preferred time of day</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #280f49;">${timeLabel}</p>
          </div>
          ${opts.notes ? `
          <div style="padding-top: 12px; border-top: 1px solid #ede8e3;">
            <p style="margin: 0; font-size: 11px; font-weight: 600; color: #a1958f; text-transform: uppercase; letter-spacing: 0.06em;">Additional notes</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #280f49; line-height: 1.6;">${opts.notes}</p>
          </div>` : ''}
        </div>
      `,
      ctaText: 'View Patient Profile',
      ctaUrl: `${appUrl}/provider/patients/${opts.patientId}`,
      patientId: '',
    }),
  })

  console.log(`[clinic/request] In-person request email sent to ${providerEmail}`)
}
