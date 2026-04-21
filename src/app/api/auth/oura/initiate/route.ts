import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { buildOuraOAuthUrl } from "@/lib/oura"
import { encodeState } from "@/lib/oauth-state"
import { db } from "@/lib/db"
import { patients } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * POST /api/auth/oura/initiate
 * Starts the Oura OAuth flow for a patient to connect their ring.
 * Returns the URL to redirect the patient to Oura's consent screen.
 */
export async function POST(req: NextRequest) {
  try {
    const { patientId } = await req.json()
    if (!patientId) {
      return NextResponse.json({ error: "patientId required" }, { status: 400 })
    }

    // Verify this is a real patient
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, patientId),
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    // Generate CSRF state token with HMAC signature
    const state = encodeState({
      patientId,
      nonce: randomUUID(),
      ts: Date.now(),
    })

    const url = buildOuraOAuthUrl(state)

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error("Oura OAuth initiate error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
