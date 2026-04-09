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

  // Submit a real transcript job using AssemblyAI's own sample audio
  const res = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      Authorization: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: 'https://assembly.ai/sports_injuries.mp3',
      speech_model: 'universal-2',
      speaker_labels: true,
      speakers_expected: 2,
    }),
  })

  const body = await res.json()

  return NextResponse.json({
    httpStatus: res.status,
    keyPrefix: key.slice(0, 8) + '...',
    assemblyResponse: body,
  })
}
