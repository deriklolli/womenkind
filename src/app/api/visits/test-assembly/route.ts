import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/visits/test-assembly
 * Temporary debug endpoint — delete after confirming AssemblyAI works.
 */
export async function GET() {
  const key = process.env.ASSEMBLYAI_API_KEY

  if (!key) {
    return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not set in environment' }, { status: 500 })
  }

  // Ping AssemblyAI account endpoint to confirm key validity
  const res = await fetch('https://api.assemblyai.com/v2/account', {
    headers: { Authorization: key },
  })

  const body = await res.json()

  return NextResponse.json({
    httpStatus: res.status,
    keyPrefix: key.slice(0, 8) + '...',
    assemblyResponse: body,
  })
}
