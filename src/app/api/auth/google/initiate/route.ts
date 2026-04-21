import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { buildOAuthUrl } from "@/lib/google-calendar"
import { encodeState } from "@/lib/oauth-state"
import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * POST /api/auth/google/initiate
 * Starts the Google OAuth flow for a provider to connect their calendar.
 * Returns the URL to redirect the provider to Google's consent screen.
 */
export async function POST(req: NextRequest) {
  try {
    const { providerId } = await req.json()
    if (!providerId) {
      return NextResponse.json({ error: "providerId required" }, { status: 400 })
    }

    // Verify this is a real provider
    const provider = await db.query.providers.findFirst({
      where: eq(providers.id, providerId),
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    // Generate CSRF state token with HMAC signature
    const state = encodeState({
      providerId,
      nonce: randomUUID(),
      ts: Date.now(),
    })

    const url = buildOAuthUrl(state)

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error("OAuth initiate error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
