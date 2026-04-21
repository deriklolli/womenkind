import type { NextRequest } from 'next/server'

// ── Drizzle mock ──────────────────────────────────────────────────────────────

const mockDbUpdate = jest.fn()
const mockDbSet = jest.fn()
const mockDbWhere = jest.fn()
const mockDbInsert = jest.fn()
const mockDbQueryFindFirst = jest.fn()

// Chainable update: db.update(table).set({}).where()
mockDbWhere.mockResolvedValue([])
mockDbSet.mockReturnValue({ where: mockDbWhere })
mockDbUpdate.mockReturnValue({ set: mockDbSet })

jest.mock('@/lib/db', () => ({
  db: {
    update: mockDbUpdate,
    insert: mockDbInsert,
    query: {
      encounter_notes: { findFirst: mockDbQueryFindFirst },
      patients: { findFirst: jest.fn().mockResolvedValue(null) },
    },
  },
}))

jest.mock('@/lib/db/schema', () => ({
  encounter_notes: { id: 'id', assemblyai_transcript_id: 'assemblyai_transcript_id' },
  patients: { id: 'id' },
  profiles: { id: 'id' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((col, val) => ({ col, val })),
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

    // Default: note found for transcript lookup
    mockDbQueryFindFirst.mockResolvedValue(FAKE_NOTE)

    // Reset update chain
    mockDbWhere.mockResolvedValue([])
    mockDbSet.mockReturnValue({ where: mockDbWhere })
    mockDbUpdate.mockReturnValue({ set: mockDbSet })

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

    // Find the db.update().set() call that includes chief_complaint (the SOAP note update)
    const setCalls = mockDbSet.mock.calls
    const soapSetCall = setCalls.find((args: unknown[]) =>
      typeof args[0] === 'object' && args[0] !== null && 'chief_complaint' in (args[0] as object)
    )

    expect(soapSetCall).toBeDefined()
    expect((soapSetCall![0] as Record<string, unknown>).recording_url).toBeNull()
  })
})
