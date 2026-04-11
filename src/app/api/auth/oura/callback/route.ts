import { NextRequest, NextResponse } from "next/server"
import { exchangeOuraCode, saveOuraConnection, syncOuraData } from "@/lib/oura"
import { decodeState } from "@/lib/oauth-state"

/**
 * GET /api/auth/oura/callback
 * Handles the OAuth callback from Oura after the patient consents.
 * Exchanges code for tokens, stores them, triggers initial 30-day sync,
 * and redirects back to the patient dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")
    const rawState = req.nextUrl.searchParams.get("state")
    const error = req.nextUrl.searchParams.get("error")

    // Handle user denial
    if (error) {
      return NextResponse.redirect(
        new URL("/patient/dashboard?oura=denied", req.url)
      )
    }

    if (!code || !rawState) {
      return NextResponse.redirect(
        new URL("/patient/dashboard?oura=error&reason=missing_params", req.url)
      )
    }

    // Decode and verify state
    const oauthState = decodeState(rawState)
    if (!oauthState) {
      return NextResponse.redirect(
        new URL("/patient/dashboard?oura=error&reason=invalid_state", req.url)
      )
    }

    const patientId = oauthState.patientId
    if (!patientId) {
      return NextResponse.redirect(
        new URL("/patient/dashboard?oura=error&reason=missing_patient_id", req.url)
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeOuraCode(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/patient/dashboard?oura=error&reason=no_refresh_token", req.url)
      )
    }

    // Save the connection
    const connectionId = await saveOuraConnection(patientId, tokens)

    // Trigger initial sync (last 30 days) — don't block the redirect on this
    syncOuraData(connectionId, patientId, 30).catch(err => {
      console.error("Initial Oura sync failed:", err)
    })

    // Redirect back to patient dashboard with success
    return NextResponse.redirect(
      new URL("/patient/dashboard?oura=connected", req.url)
    )
  } catch (err: any) {
    console.error("Oura OAuth callback error:", err)
    return NextResponse.redirect(
      new URL(`/patient/dashboard?oura=error&reason=${encodeURIComponent(err.message)}`, req.url)
    )
  }
}
