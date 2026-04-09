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

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // List files in the recordings bucket to find a real file
  const { data: files, error: listErr } = await supabase.storage
    .from('recordings')
    .list('ambient', { limit: 5, sortBy: { column: 'created_at', order: 'desc' } })

  if (listErr || !files?.length) {
    return NextResponse.json({ error: 'No files in recordings bucket', listErr })
  }

  const latestFile = `ambient/${files[0].name}`

  // Create signed URL with service role
  const { data: signedData, error: signedErr } = await supabase.storage
    .from('recordings')
    .createSignedUrl(latestFile, 3600)

  if (signedErr || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to create signed URL', signedErr })
  }

  // Submit to AssemblyAI
  const res = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_url: signedData.signedUrl,
      speech_models: ['universal-2'],
      speaker_labels: true,
      speakers_expected: 2,
    }),
  })

  const body = await res.json()

  return NextResponse.json({
    httpStatus: res.status,
    file: latestFile,
    signedUrlPrefix: signedData.signedUrl.slice(0, 80) + '...',
    assemblyResponse: body,
  })
}
