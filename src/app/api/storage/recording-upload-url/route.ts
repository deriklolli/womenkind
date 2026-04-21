import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { getUploadUrl } from '@/lib/s3'

/**
 * POST /api/storage/recording-upload-url
 *
 * Returns a pre-signed S3 PUT URL and the S3 key for a new audio recording.
 * The client uploads directly to S3 — audio data never passes through this server.
 *
 * Body: { patientId: string, mimeType: string }
 * Response: { uploadUrl: string, s3Key: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { patientId, mimeType } = await req.json()

    if (!patientId || !mimeType) {
      return NextResponse.json({ error: 'Missing patientId or mimeType' }, { status: 400 })
    }

    const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
    const s3Key = `ambient/${Date.now()}_${patientId}.${ext}`

    const uploadUrl = await getUploadUrl(s3Key, mimeType)

    return NextResponse.json({ uploadUrl, s3Key })
  } catch (err: any) {
    console.error('[recording-upload-url] Error:', err)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
