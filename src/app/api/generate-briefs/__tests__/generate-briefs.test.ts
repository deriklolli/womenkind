/**
 * Tests for POST /api/generate-briefs
 *
 * This is a batch processing route that regenerates AI clinical briefs for all
 * submitted intakes that don't have one yet. It's protected by a shared secret
 * and is typically called on a schedule or manually by the provider.
 *
 * What we verify:
 * - Wrong secret → 401
 * - Missing secret → 401
 * - No pending intakes → { message: 'No intakes need briefs', count: 0 }
 * - Processes multiple intakes and returns results array
 * - Fetches Oura wearable data per patient before generating brief
 * - A single intake failure does NOT fail the whole batch (per-intake error isolation)
 * - Saves each generated brief back to the intake record
 * - Only processes intakes with status submitted/reviewed and no existing brief
 */

import type { NextRequest } from 'next/server'

// ── Bedrock mock ──────────────────────────────────────────────────────────────

const mockInvokeModel = jest.fn()

jest.mock('@/lib/bedrock', () => ({
  invokeModel: (...args: unknown[]) => mockInvokeModel(...args),
}))

// ── Drizzle db mock ───────────────────────────────────────────────────────────

// We need to intercept the chained Drizzle calls:
//   db.select(...).from(...).where(...) → returns rows array
//   db.update(...).set(...).where(...)  → resolves

const mockSelectWhere = jest.fn()
const mockSelectFrom = jest.fn()
const mockSelect = jest.fn()

const mockUpdateWhere = jest.fn()
const mockUpdateSet = jest.fn()
const mockUpdate = jest.fn()

// Update chain
mockUpdateWhere.mockResolvedValue(undefined)
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
mockUpdate.mockReturnValue({ set: mockUpdateSet })

// Select chain — default: returns []
mockSelectWhere.mockResolvedValue([])
mockSelectFrom.mockReturnValue({ where: mockSelectWhere })
mockSelect.mockReturnValue({ from: mockSelectFrom })

jest.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/generate-briefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const VALID_SECRET = { secret: 'womenkind-seed-2026' }

const MOCK_BRIEF = {
  symptom_summary: { overview: 'Test brief', domains: [] },
  risk_flags: { urgent: [], contraindications: [], considerations: [] },
  treatment_pathway: { recommended_approach: 'HRT', options: [], patient_preferences: 'Open' },
  suggested_questions: [],
  metadata: {
    menopausal_stage: 'Post-menopause',
    symptom_burden: 'high',
    complexity: 'moderate',
    generated_at: new Date().toISOString(),
  },
}

// Intakes with no ai_brief (pending)
const SAMPLE_INTAKES = [
  {
    id: 'intake-uuid-001',
    patient_id: 'patient-uuid-aaa',
    answers: { top_concern: 'Hot flashes', menstrual: 'Postmenopausal' },
    status: 'submitted',
    ai_brief: null,
  },
  {
    id: 'intake-uuid-002',
    patient_id: 'patient-uuid-bbb',
    answers: { top_concern: 'Sleep issues', menstrual: 'Perimenopausal' },
    status: 'reviewed',
    ai_brief: null,
  },
]

function mockBedrockSuccess(brief = MOCK_BRIEF) {
  mockInvokeModel.mockResolvedValue(JSON.stringify(brief))
}

function mockBedrockFailure() {
  mockInvokeModel.mockRejectedValue(new Error('Bedrock error'))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/generate-briefs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GENERATE_BRIEFS_SECRET = 'womenkind-seed-2026'
    mockBedrockSuccess()

    // Reset select chain to return empty by default
    mockSelectWhere.mockResolvedValue([])
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere })
    mockSelect.mockReturnValue({ from: mockSelectFrom })

    // Reset update chain
    mockUpdateWhere.mockResolvedValue(undefined)
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdate.mockReturnValue({ set: mockUpdateSet })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns 401 for a wrong secret', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ secret: 'wrong-secret' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when secret is missing', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(401)
  })

  // ── No pending intakes ──────────────────────────────────────────────────────

  it('returns count: 0 when no intakes need briefs', async () => {
    // All intakes already have ai_brief set
    mockSelectWhere.mockResolvedValue([
      { ...SAMPLE_INTAKES[0], ai_brief: { some: 'brief' } },
    ])

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
    expect(body.message).toMatch(/No intakes/)
  })

  // ── Batch processing ────────────────────────────────────────────────────────

  it('processes all pending intakes and returns a results array', async () => {
    let selectCallCount = 0
    mockSelectWhere.mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        // First select: intakes query
        return Promise.resolve(SAMPLE_INTAKES)
      }
      // Subsequent selects: wearable_metrics query → no data
      return Promise.resolve([])
    })

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(2)
    expect(body.results[0]).toMatchObject({ id: 'intake-uuid-001', success: true })
    expect(body.results[1]).toMatchObject({ id: 'intake-uuid-002', success: true })
  })

  it('fetches Oura wearable data for each patient before generating brief', async () => {
    let selectCallCount = 0
    mockSelectWhere.mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return Promise.resolve([SAMPLE_INTAKES[0]])
      }
      return Promise.resolve([])
    })

    const { POST } = await import('../route')
    await POST(makeRequest(VALID_SECRET))

    // Should have been called at least twice: once for intakes, once for wearable_metrics
    expect(mockSelect).toHaveBeenCalledTimes(2)
  })

  it('saves the generated brief back to the intake record', async () => {
    let selectCallCount = 0
    mockSelectWhere.mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return Promise.resolve([SAMPLE_INTAKES[0]])
      }
      return Promise.resolve([])
    })

    let capturedBrief: unknown = null
    mockUpdateSet.mockImplementation((args: unknown) => {
      capturedBrief = args
      return { where: mockUpdateWhere }
    })

    const { POST } = await import('../route')
    await POST(makeRequest(VALID_SECRET))

    expect(capturedBrief).toMatchObject({ ai_brief: MOCK_BRIEF })
  })

  // ── Per-intake error isolation ──────────────────────────────────────────────

  it('marks a single intake as failed without stopping the rest of the batch', async () => {
    // First intake: Bedrock fails; second: succeeds
    mockInvokeModel
      .mockRejectedValueOnce(new Error('Rate limited'))
      .mockResolvedValueOnce(JSON.stringify(MOCK_BRIEF))

    let selectCallCount = 0
    mockSelectWhere.mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return Promise.resolve(SAMPLE_INTAKES)
      }
      return Promise.resolve([])
    })

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.results).toHaveLength(2)
    expect(body.results[0]).toMatchObject({ id: 'intake-uuid-001', success: false })
    expect(body.results[1]).toMatchObject({ id: 'intake-uuid-002', success: true })
  })

  it('queries only intakes with status submitted or reviewed and no existing brief', async () => {
    // Return mix: one has ai_brief, one does not
    const mixedIntakes = [
      { ...SAMPLE_INTAKES[0], ai_brief: null },             // pending
      { ...SAMPLE_INTAKES[1], ai_brief: { existing: true } }, // already has brief
    ]

    let selectCallCount = 0
    mockSelectWhere.mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return Promise.resolve(mixedIntakes)
      }
      return Promise.resolve([])
    })

    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()

    // Only the one without ai_brief should be processed
    expect(body.results).toHaveLength(1)
    expect(body.results[0]).toMatchObject({ id: 'intake-uuid-001', success: true })
  })
})
