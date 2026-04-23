import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { profiles, patients } from '@/lib/db/schema'
import { Resend } from 'resend'

/**
 * POST /api/auth/signup
 *
 * Server-side signup that bypasses Supabase's SMTP entirely:
 * 1. Creates the Supabase auth user via admin client (email pre-confirmed)
 * 2. Creates profiles + patients rows in RDS
 * 3. Signs the user in and returns session cookies
 * 4. Sends welcome email via Resend
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
  try {
    await db.insert(profiles).values({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
    }).onConflictDoNothing()

    await db.insert(patients).values({ profile_id: userId }).onConflictDoNothing()
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

  // Step 4: Send welcome email via Resend (fire-and-forget)
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const resend = new Resend(resendKey)
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://womenkind.vercel.app').replace(/\/+$/, '')
    resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Womenkind <onboarding@resend.dev>',
      to: email,
      subject: `Welcome to Womenkind, ${firstName}`,
      html: `<p>Hi ${firstName}, your account is ready. <a href="${appUrl}/intake">Start your intake survey</a>.</p>`,
    }).catch(e => console.error('[signup] Welcome email failed:', e))
  }

  return response
}
