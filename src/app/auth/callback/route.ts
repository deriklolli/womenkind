import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /auth/callback
 * Handles Supabase email verification redirect.
 * Exchanges the token_hash for a session, then redirects to /signup/verified.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') || '/signup/verified'

  if (token_hash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (!error) {
      return NextResponse.redirect(new URL(next, req.url))
    }
  }

  // If verification fails, redirect to login with error
  return NextResponse.redirect(new URL('/patient/login?error=verification_failed', req.url))
}
