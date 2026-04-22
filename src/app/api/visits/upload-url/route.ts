import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { getUploadUrl } from '@/lib/s3'

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session || session.role !== 'provider') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { patientId, contentType } = await req.json()
  if (!patientId || !contentType) {
    return NextResponse.json({ error: 'Missing patientId or contentType' }, { status: 400 })
  }

  const ext = contentType.includes('ogg') ? 'ogg' : 'webm'
  const key = `ambient/${Date.now()}_${patientId}.${ext}`
  const uploadUrl = await getUploadUrl(key, contentType)

  return NextResponse.json({ uploadUrl, key })
}
