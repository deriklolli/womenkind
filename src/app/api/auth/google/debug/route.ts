import { NextResponse } from 'next/server'

/**
 * GET /api/auth/google/debug
 * Returns non-sensitive config info to diagnose OAuth issues.
 * Does NOT expose secrets — only shows whether env vars are set and what redirect URI we're building.
 */
export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const encryptionKey = process.env.ENCRYPTION_KEY

  const baseUrl = (appUrl || '').replace(/\/+$/, '')
  const redirectUri = `${baseUrl}/api/auth/google/callback`

  return NextResponse.json({
    env: {
      GOOGLE_OAUTH_CLIENT_ID: clientId ? `${clientId.substring(0, 20)}...` : '❌ NOT SET',
      GOOGLE_OAUTH_CLIENT_SECRET: clientSecret ? '✅ set' : '❌ NOT SET',
      NEXT_PUBLIC_APP_URL: appUrl || '❌ NOT SET',
      ENCRYPTION_KEY: encryptionKey ? '✅ set' : '❌ NOT SET',
    },
    computed: {
      redirectUri,
    },
    instructions: {
      step1: 'In Google Cloud Console → APIs & Services → Credentials → Your OAuth 2.0 Client',
      step2: `Add this EXACT redirect URI: ${redirectUri}`,
      step3: 'Under OAuth consent screen, add josephurbanmd@gmail.com as a test user (if app is in "Testing" mode)',
      step4: 'Make sure "Google Calendar API" is enabled under APIs & Services → Enabled APIs',
    },
  })
}
