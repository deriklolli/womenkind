import { NextRequest, NextResponse } from "next/server"
import {
  exchangeCodeForTokens,
  getGoogleEmail,
  saveCalendarConnection,
} from "@/lib/google-calendar"
import { decodeState } from "@/lib/oauth-state"

/**
 * GET /api/auth/google/callback
 * Handles the OAuth callback from Google after the provider consents.
 * Exchanges the code for tokens, stores them, and redirects to settings.
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")
    const rawState = req.nextUrl.searchParams.get("state")
    const error = req.nextUrl.searchParams.get("error")

    // Handle user denial
    if (error) {
      return NextResponse.redirect(
        new URL("/provider/settings?calendar=denied", req.url)
      )
    }

    if (!code || !rawState) {
      return NextResponse.redirect(
        new URL("/provider/settings?calendar=error&reason=missing_params", req.url)
      )
    }

    // Decode and verify state
    const oauthState = decodeState(rawState)
    if (!oauthState) {
      return NextResponse.redirect(
        new URL("/provider/settings?calendar=error&reason=invalid_state", req.url)
      )
    }

    const providerId = oauthState.providerId
    if (!providerId) {
      return NextResponse.redirect(
        new URL("/provider/settings?calendar=error&reason=missing_provider_id", req.url)
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/provider/settings?calendar=error&reason=no_refresh_token", req.url)
      )
    }

    // Get the Google email for display
    const googleEmail = await getGoogleEmail(tokens.access_token)

    // Save the connection
    await saveCalendarConnection(providerId, tokens, googleEmail)

    // Redirect back to provider settings with success
    return NextResponse.redirect(
      new URL(`/provider/settings?calendar=connected&email=${encodeURIComponent(googleEmail)}`, req.url)
    )
  } catch (err: any) {
    console.error("OAuth callback error:", err)
    return NextResponse.redirect(
      new URL(`/provider/settings?calendar=error&reason=${encodeURIComponent(err.message)}`, req.url)
    )
  }
}
