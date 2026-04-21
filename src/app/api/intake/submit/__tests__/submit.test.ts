/**
 * Tests for POST /api/intake/submit
 *
 * This route sits at the top of the funnel — it finalises the patient intake,
 * optionally generates an AI clinical brief via Claude, and fires confirmation
 * emails to both patient and provider.
 *
 * Strategy: mock @/lib/db (Drizzle), @/lib/bedrock, resend, and @/lib/phi-audit.
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

// ── Drizzle db mock ───────────────────────────────────────────────────────────

const mockUpdate = jest.fn()
const mockSet = jest.fn()
const mockWhere = jest.fn()
const mockQueryProvidersFindFirst = jest.fn()
const mockQueryPatientsFindFirst = jest.fn()

// Drizzle update chain: db.update(...).set(...).where(...)
mockWhere.mockResolvedValue(undefined)
mockSet.mockReturnValue({ where: mockWhere })
mockUpdate.mockReturnValue({ set: mockSet })

jest.mock('@/lib/db', () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
    query: {
      providers: { findFirst: (...args: unknown[]) => mockQueryProvidersFindFirst(...args) },
      patients: { findFirst: (...args: unknown[]) => mockQueryPatientsFindFirst(...args) },
    },
  },
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
    // Default: active provider found
    mockQueryProvidersFindFirst.mockResolvedValue({ id: 'provider-uuid-789' })
    // Default: patient with profile found (for emails)
    mockQueryPatientsFindFirst.mockResolvedValue({
      id: 'patient-uuid-456',
      profiles: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    })
    // Default: update chain resolves
    mockWhere.mockResolvedValue(undefined)
    mockSet.mockReturnValue({ where: mockWhere })
    mockUpdate.mockReturnValue({ set: mockSet })
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
    mockSet.mockImplementation((args: unknown) => {
      capturedUpdateArgs = args
      return { where: mockWhere }
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
    // providers query must be called
    expect(mockQueryProvidersFindFirst).toHaveBeenCalled()
  })

  // ── Happy path (with AI brief) ────────────────────────────────────────────

  it('returns { success: true, briefGenerated: true } when Bedrock responds successfully', async () => {
    mockBedrockSuccess()

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, briefGenerated: true })
  })

  it('calls invokeModel with a patient profile in the messages', async () => {
    mockBedrockSuccess()

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

    let callCount = 0
    let aiBriefSaved: unknown = null
    mockSet.mockImplementation((args: unknown) => {
      callCount++
      if (callCount === 2) {
        // Second set() call = saving the brief
        aiBriefSaved = args
      }
      return { where: mockWhere }
    })

    const { POST } = await import('../route')
    await POST(makeRequest(VALID_BODY))

    expect(aiBriefSaved).toMatchObject({ ai_brief: MOCK_AI_BRIEF })
  })

  // ── AI brief failure is non-fatal ─────────────────────────────────────────

  it('still returns success when Bedrock throws', async () => {
    mockBedrockFailure()

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, briefGenerated: false })
  })

  it('still returns success when Bedrock rejects with a network-style error', async () => {
    mockInvokeModel.mockRejectedValue(new Error('Network error'))

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  // ── Database error → 500 ──────────────────────────────────────────────────

  it('returns 500 when the intake update fails', async () => {
    mockWhere.mockRejectedValue(new Error('database connection lost'))

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
