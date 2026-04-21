/**
 * Tests for POST /api/intake/submit
 *
 * This route sits at the top of the funnel — it finalises the patient intake,
 * optionally generates an AI clinical brief via Claude, and fires confirmation
 * emails to both patient and provider.
 *
 * Strategy: mock @supabase/supabase-js (the route uses createClient directly),
 * global.fetch (for the Anthropic API call), resend, and @/lib/phi-audit.
 *
 * What we verify:
 * - Happy path (no AI key) → { success: true, briefGenerated: false }
 * - Happy path (with AI key) → { success: true, briefGenerated: true }
 * - AI brief failure is non-fatal → submission still succeeds
 * - DB update error → 500
 * - PHI access log is always called
 * - Provider is resolved before updating intake
 */

import type { NextRequest } from 'next/server'

// ── Bedrock mock ──────────────────────────────────────────────────────────────

const mockInvokeModel = jest.fn()

jest.mock('@/lib/bedrock', () => ({
  invokeModel: (...args: unknown[]) => mockInvokeModel(...args),
}))

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockFrom = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ── PHI audit mock ────────────────────────────────────────────────────────────

const mockLogPhiAccess = jest.fn()

jest.mock('@/lib/phi-audit', () => ({
  logPhiAccess: (...args: unknown[]) => mockLogPhiAccess(...args),
}))

// ── getServerSession mock ─────────────────────────────────────────────────────
// Default: authenticated provider — bypasses the patientId ownership guard so
// existing tests continue to exercise submission logic rather than the auth layer.

const mockGetServerSession = jest.fn()

jest.mock('@/lib/getServerSession', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

// ── Resend mock ───────────────────────────────────────────────────────────────

const mockEmailSend = jest.fn().mockResolvedValue({ id: 'email_123' })

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailSend },
  })),
}))

// ── Chain factory ─────────────────────────────────────────────────────────────

function makeChain(resolveWith: unknown = { data: null, error: null }) {
  const resolved = Promise.resolve(resolveWith)
  const chain: any = {
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  }
  ;['select', 'eq', 'neq', 'limit', 'update', 'insert'].forEach(
    m => { chain[m] = jest.fn().mockReturnValue(chain) }
  )
  chain.single = jest.fn().mockResolvedValue(resolveWith)
  chain.maybeSingle = jest.fn().mockResolvedValue(resolveWith)
  return chain
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/intake/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const VALID_BODY = {
  intakeId: 'intake-uuid-123',
  patientId: 'patient-uuid-456',
  answers: {
    full_name: 'Jane Doe',
    top_concern: 'Hot flashes and sleep issues',
    hf_freq: 'More than 10 per day',
    hf_severity: 'Severe',
    menstrual: 'Postmenopausal',
  },
}

const MOCK_AI_BRIEF = {
  symptom_summary: {
    overview: 'Postmenopausal patient with severe vasomotor symptoms.',
    domains: [],
  },
  risk_flags: { urgent: [], contraindications: [], considerations: [] },
  treatment_pathway: {
    recommended_approach: 'HRT evaluation',
    options: [],
    patient_preferences: 'Open to hormonal options',
  },
  suggested_questions: [],
  metadata: {
    menopausal_stage: 'Post-menopause',
    symptom_burden: 'high',
    complexity: 'moderate',
    generated_at: new Date().toISOString(),
  },
}

/** Setup mockFrom to route tables to appropriate responses */
function setupTables(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    providers: { data: { id: 'provider-uuid-789' }, error: null },
    intakes: { data: null, error: null },
    patients: {
      data: {
        profiles: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
      },
      error: null,
    },
    ...overrides,
  }
  mockFrom.mockImplementation((table: string) => makeChain(defaults[table] ?? { data: null, error: null }))
}

/** Mock a successful Bedrock invokeModel response */
function mockBedrockSuccess(brief = MOCK_AI_BRIEF) {
  mockInvokeModel.mockResolvedValue(JSON.stringify(brief))
}

/** Mock a failed Bedrock invokeModel response */
function mockBedrockFailure() {
  mockInvokeModel.mockRejectedValue(new Error('Bedrock error'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/intake/submit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupTables()
    delete process.env.RESEND_API_KEY
    // Bedrock fails by default — AI brief generation is skipped
    mockBedrockFailure()
    // Authenticated provider session by default
    mockGetServerSession.mockResolvedValue({
      userId: 'user-uuid-provider',
      patientId: null,
      providerId: 'provider-uuid-789',
      role: 'provider',
    })
  })

  // ── Happy path (no AI brief) ──────────────────────────────────────────────

  it('returns { success: true, briefGenerated: false } when Bedrock fails', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, briefGenerated: false })
  })

  it('updates the intake status to submitted with answers and timestamp', async () => {
    let capturedUpdateArgs: unknown = null
    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain({ data: null, error: null })
      if (table === 'intakes') {
        chain.update = jest.fn().mockImplementation((args: unknown) => {
          capturedUpdateArgs = args
          return chain
        })
      }
      return chain
    })

    const { POST } = await import('../route')
    await POST(makeRequest(VALID_BODY))

    expect(capturedUpdateArgs).toMatchObject({
      status: 'submitted',
      answers: VALID_BODY.answers,
    })
  })

  it('resolves the active provider and links it to the intake', async () => {
    const { POST } = await import('../route')
    await POST(makeRequest(VALID_BODY))
    // providers table must be queried
    expect(mockFrom).toHaveBeenCalledWith('providers')
  })

  // ── Happy path (with AI brief) ────────────────────────────────────────────

  it('returns { success: true, briefGenerated: true } when Bedrock responds successfully', async () => {
    mockBedrockSuccess()
    setupTables()

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, briefGenerated: true })
  })

  it('calls invokeModel with a patient profile in the messages', async () => {
    mockBedrockSuccess()
    setupTables()

    const { POST } = await import('../route')
    await POST(makeRequest(VALID_BODY))

    expect(mockInvokeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    )
  })

  it('saves the AI brief to the intake record', async () => {
    mockBedrockSuccess()

    let aiBriefSaved: unknown = null
    let intakesCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      const chain = makeChain({ data: null, error: null })
      if (table === 'intakes') {
        intakesCallCount++
        if (intakesCallCount === 2) {
          // Second intakes call = saving the brief
          chain.update = jest.fn().mockImplementation((args: unknown) => {
            aiBriefSaved = args
            return chain
          })
        }
      }
      if (table === 'providers') return makeChain({ data: { id: 'provider-uuid-789' }, error: null })
      return chain
    })

    const { POST } = await import('../route')
    await POST(makeRequest(VALID_BODY))

    expect(aiBriefSaved).toMatchObject({ ai_brief: MOCK_AI_BRIEF })
  })

  // ── AI brief failure is non-fatal ─────────────────────────────────────────

  it('still returns success when Bedrock throws', async () => {
    mockBedrockFailure()
    setupTables()

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, briefGenerated: false })
  })

  it('still returns success when Bedrock rejects with a network-style error', async () => {
    mockInvokeModel.mockRejectedValue(new Error('Network error'))
    setupTables()

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  // ── Database error → 500 ──────────────────────────────────────────────────

  it('returns 500 when the Supabase intake update fails', async () => {
    setupTables({
      intakes: { data: null, error: { message: 'database connection lost' } },
    })

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('database connection lost')
  })

  // ── PHI audit log ─────────────────────────────────────────────────────────

  it('calls logPhiAccess on every successful submission', async () => {
    const { POST } = await import('../route')
    await POST(makeRequest(VALID_BODY))
    expect(mockLogPhiAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: VALID_BODY.patientId,
        recordType: 'intake',
        recordId: VALID_BODY.intakeId,
        action: 'create',
        route: '/api/intake/submit',
      })
    )
  })

  it('calls logPhiAccess even when Bedrock fails', async () => {
    const { POST } = await import('../route')
    await POST(makeRequest(VALID_BODY))
    expect(mockLogPhiAccess).toHaveBeenCalledTimes(1)
  })
})
