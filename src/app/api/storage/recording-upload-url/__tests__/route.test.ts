import type { NextRequest } from 'next/server'

jest.mock('@/lib/getServerSession', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/s3', () => ({
  getUploadUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/signed-put-url'),
}))

import { getServerSession } from '@/lib/getServerSession'
import { getUploadUrl } from '@/lib/s3'

const PROVIDER_SESSION = { role: 'provider', providerId: 'provider-uuid' }

function makeRequest(body: object) {
  return new Request('http://localhost/api/storage/recording-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('POST /api/storage/recording-upload-url', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue(PROVIDER_SESSION)
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ patientId: 'p1', mimeType: 'audio/webm' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as patient', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ role: 'patient' })
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ patientId: 'p1', mimeType: 'audio/webm' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when patientId is missing', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ mimeType: 'audio/webm' }))
    expect(res.status).toBe(400)
  })

  it('returns uploadUrl and s3Key for webm', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ patientId: 'patient-uuid', mimeType: 'audio/webm' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uploadUrl).toBe('https://s3.amazonaws.com/signed-put-url')
    expect(body.s3Key).toMatch(/^ambient\/\d+_patient-uuid\.webm$/)
    expect(getUploadUrl).toHaveBeenCalledWith(body.s3Key, 'audio/webm')
  })

  it('uses .ogg extension for ogg mimeType', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ patientId: 'patient-uuid', mimeType: 'audio/ogg' }))
    const body = await res.json()
    expect(body.s3Key).toMatch(/\.ogg$/)
  })
})
