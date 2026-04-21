import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's role from RDS session data.
 * Used by client pages that need to redirect based on role after auth actions.
 */
export async function GET() {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ role: 'unknown' })
  }

  return NextResponse.json({ role: session.role })
}
