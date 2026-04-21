import type { NextRequest } from 'next/server'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockUpdate = jest.fn()
const mockFrom = jest.fn()

function makeChain(resolveWith: unknown = { data: null, error: null }) {
  const chain: Record<string, jest.Mock> = {}
  ;['select', 'eq', 'neq'].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
  chain.single      = jest.fn().mockResolvedValue(resolveWith)
  chain.maybeSingle = jest.fn().mockResolvedValue(resolveWith)
  chain.update      = mockUpdate.mockReturnValue(chain)
  return chain
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ── Bedrock mock ──────────────────────────────────────────────────────────────

jest.mock('@/lib/bedrock', () => ({
  invokeModel: jest.fn().mockResolvedValue(JSON.stringify({
    chief_complaint: 'Fatigue',
    hpi: 'Patient reports improvement.',
    ros: 'No new symptoms.',
    assessment: 'Menopause management.',
    plan: 'Continue HRT.',
  })),
}))

// ── AssemblyAI + misc mocks ───────────────────────────────────────────────────

jest.mock('@/lib/phi-audit', () => ({ logPhiAccess: jest.fn() }))

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email_123' }) },
  })),
}))

const FAKE_TRANSCRIPT = {
  id: 'transcript-123',
  status: 'completed',
  text: 'Provider: How are you feeling? Patient: Much better.',
  utterances: [
    { speaker: 'A', text: 'How are you feeling?' },
    { speaker: 'B', text: 'Much better.' },
  ],
}

const FAKE_NOTE = { id: 'note-uuid', patient_id: 'patient-uuid', provider_id: 'provider-uuid' }
const WEBHOOK_SECRET = 'test-secret'

function makeRequest(body: object) {
  return new Request('http://localhost/api/visits/webhook/transcription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': WEBHOOK_SECRET,
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('POST /api/visits/webhook/transcription', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.WEBHOOK_SECRET = WEBHOOK_SECRET
    process.env.ASSEMBLYAI_API_KEY = 'assembly-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    mockFrom.mockReturnValue(makeChain({ data: FAKE_NOTE, error: null }))

    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('assemblyai.com/v2/transcript/') && (!opts?.method || opts.method === 'GET')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FAKE_TRANSCRIPT) })
      }
      if (url.includes('assemblyai.com/v2/transcript/') && opts?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }) as jest.Mock
  })

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET
    delete process.env.ASSEMBLYAI_API_KEY
  })

  it('returns 401 when webhook secret is missing', async () => {
    const { POST } = await import('../route')
    const req = new Request('http://localhost/api/visits/webhook/transcription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript_id: 'transcript-123', status: 'completed' }),
    }) as unknown as NextRequest

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when transcript_id is missing', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ status: 'completed' }))
    expect(res.status).toBe(400)
  })

  it('clears recording_url after successful transcription', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ transcript_id: 'transcript-123', status: 'completed' }))

    expect(res.status).toBe(200)

    const updateCalls = mockUpdate.mock.calls
    const soapUpdate = updateCalls.find((args: unknown[]) =>
      typeof args[0] === 'object' && args[0] !== null && 'chief_complaint' in (args[0] as object)
    )

    expect(soapUpdate).toBeDefined()
    expect((soapUpdate![0] as Record<string, unknown>).recording_url).toBeNull()
  })
})
