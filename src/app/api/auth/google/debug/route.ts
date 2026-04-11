import { NextResponse } from 'next/server'

/**
 * GET /api/auth/google/debug
 * Returns non-sensitive config info to diagnose OAuth issues.
 * Does NOT expose secrets — only shows whether env vars are set and what redirect URI we're building.
 */
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
