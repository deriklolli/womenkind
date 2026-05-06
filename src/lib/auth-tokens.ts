// src/lib/auth-tokens.ts
import { createHmac, timingSafeEqual } from 'crypto'

// Token expires after 24 hours. Message = "verify:{patientId}:{timestamp}"
export function generateVerificationToken(patientId: string): { token: string; ts: string } {
  const ts = Date.now().toString()
  const message = `verify:${patientId}:${ts}`
  const token = createHmac('sha256', process.env.CRON_SECRET!).update(message).digest('hex')
  return { token, ts }
}

export function verifyVerificationToken(
  patientId: string,
  token: string,
  ts: string
): boolean {
  const tsNum = parseInt(ts, 10)
  if (isNaN(tsNum)) return false
  // Reject tokens older than 24 hours
  if (Date.now() - tsNum > 24 * 60 * 60 * 1000) return false
  const message = `verify:${patientId}:${ts}`
  const expected = createHmac('sha256', process.env.CRON_SECRET!).update(message).digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'))
}
