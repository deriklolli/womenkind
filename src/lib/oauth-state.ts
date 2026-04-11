import { createHmac, timingSafeEqual } from 'crypto'

const STATE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY is not set')
  return key
}

function sign(payload: string): string {
  return createHmac('sha256', getKey()).update(payload).digest('hex')
}

export interface OAuthState {
  providerId?: string
  patientId?: string
  nonce: string
  ts: number
}

/** Encode and sign an OAuth state object for use in the `state` query param. */
export function encodeState(state: OAuthState): string {
  const payload = JSON.stringify(state)
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = sign(encoded)
  return `${encoded}.${sig}`
}

/** Decode and verify an OAuth state string. Returns null if invalid or expired. */
export function decodeState(raw: string): OAuthState | null {
  try {
    const lastDot = raw.lastIndexOf('.')
    if (lastDot === -1) return null
    const encoded = raw.slice(0, lastDot)
    const sig = raw.slice(lastDot + 1)

    // Constant-time comparison
    const expectedSig = sign(encoded)
    const sigBuf = Buffer.from(sig, 'hex')
    const expectedBuf = Buffer.from(expectedSig, 'hex')
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null

    // Decode payload
    const payload = Buffer.from(encoded, 'base64url').toString('utf8')
    const state = JSON.parse(payload) as OAuthState

    // Check expiry
    if (Date.now() - state.ts > STATE_TTL_MS) return null

    return state
  } catch {
    return null
  }
}