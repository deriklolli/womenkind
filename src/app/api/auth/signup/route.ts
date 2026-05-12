import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { profiles, patients } from '@/lib/db/schema'
import { Resend } from 'resend'
import { generateVerificationToken } from '@/lib/auth-tokens'
import { buildEngagementEmail, FROM } from '@/lib/engagement'

/**
 * POST /api/auth/signup
 *
 * Server-side signup that bypasses Supabase's SMTP entirely:
 * 1. Creates the Supabase auth user via admin client (email pre-confirmed)
 * 2. Creates profiles + patients rows in RDS (onboarding_status='unverified')
 * 3. Signs the user in and returns session cookies
 * 4. Sends verification email via Resend
 *
 * Body: { firstName, lastName, email, password }
 */
export async function POST(req: NextRequest) {
  const { firstName, lastName, email, password } = await req.json()

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Step 1: Create auth user via admin client (email_confirm: true skips Supabase SMTP)
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: adminData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, role: 'patient' },
  })

  if (createError) {
    const msg = createError.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  const userId = adminData.user.id

  // Step 2: Create RDS records
  let patientId: string
  try {
    await db.insert(profiles).values({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
    }).onConflictDoNothing()

    const [patient] = await db
      .insert(patients)
      .values({ profile_id: userId, onboarding_status: 'unverified' })
      .returning({ id: patients.id })

    if (!patient) {
      throw new Error('Patient insert returned no row')
    }

    patientId = patient.id
  } catch (dbErr: any) {
    // Clean up the Supabase auth user if RDS fails so the user can retry
    await adminClient.auth.admin.deleteUser(userId)
    console.error('[signup] RDS insert failed:', dbErr)
    return NextResponse.json({ error: 'Account creation failed. Please try again.' }, { status: 500 })
  }

  // Step 3: Sign in to establish session cookies on the response
  const response = NextResponse.json({ ok: true })
  const cookieStore = await cookies()
  const sessionClient = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as any)
        )
      },
    },
  })

  const { error: signInError } = await sessionClient.auth.signInWithPassword({ email, password })
  if (signInError) {
    console.error('[signup] Sign-in after creation failed:', signInError.message)
    // Still return ok — user can log in manually
  }

  // Step 4: Send verification email via Resend (awaited — fire-and-forget loses the call in serverless)
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com').replace(/\/+$/, '')
      const { token, ts } = generateVerificationToken(patientId)
      const verifyUrl = `${appUrl}/signup/verified?patientId=${patientId}&token=${token}&ts=${ts}`

      await resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Verify your email — Womenkind Health',
        html: buildEngagementEmail({
          patientId,
          heading: 'Verify your email address',
          bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:#422a1f;line-height:1.6;">Hi ${firstName}, click below to verify your email and continue setting up your Womenkind account.</p><p style="margin:0 0 8px;font-size:14px;color:rgba(66,42,31,0.6);">This link expires in 24 hours.</p><p style="margin:0;font-size:14px;color:rgba(66,42,31,0.45);">Don't see this email? Check your spam or junk folder.</p>`,
          ctaText: 'Verify my email',
          ctaUrl: verifyUrl,
        }),
      })
    } catch (err) {
      console.error('[signup] Verification email send error:', err)
    }
  }

  return response
}
