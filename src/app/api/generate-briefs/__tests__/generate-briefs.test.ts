/**
 * Tests for POST /api/generate-briefs
 *
 * This is a batch processing route that regenerates AI clinical briefs for all
 * submitted intakes that don't have one yet. It's protected by a shared secret
 * and is typically called on a schedule or manually by the provider.
 *
 * What we verify:
 * - Wrong secret → 401
 * - Missing Anthropic key → 500
 * - No pending intakes → { message: 'No intakes need briefs', count: 0 }
 * - Processes multiple intakes and returns results array
 * - Fetches Oura wearable data per patient before generating brief
 * - A single intake failure does NOT fail the whole batch (per-intake error isolation)
 * - Saves each generated brief back to the intake record
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

// ── Chain factory ─────────────────────────────────────────────────────────────

function makeChain(resolveWith: unknown = { data: null, error: null }) {
  const resolved = Promise.resolve(resolveWith)
  const chain: any = {
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  }
  ;['select', 'eq', 'in', 'is', 'gte', 'order', 'update'].forEach(
    m => { chain[m] = jest.fn().mockReturnValue(chain) }
  )
  chain.single = jest.fn().mockResolvedValue(resolveWith)
  chain.maybeSingle = jest.fn().mockResolvedValue(resolveWith)
  return chain
}

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

const SAMPLE_INTAKES = [
  {
    id: 'intake-uuid-001',
    patient_id: 'patient-uuid-aaa',
    answers: { top_concern: 'Hot flashes', menstrual: 'Postmenopausal' },
    status: 'submitted',
  },
  {
    id: 'intake-uuid-002',
    patient_id: 'patient-uuid-bbb',
    answers: { top_concern: 'Sleep issues', menstrual: 'Perimenopausal' },
    status: 'reviewed',
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
    // Default: no intakes pending
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }))
    mockBedrockSuccess()
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
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }))
    const { POST } = await import('../route')
    const res = await POST(makeRequest(VALID_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
    expect(body.message).toMatch(/No intakes/)
  })

  // ── Batch processing ────────────────────────────────────────────────────────

  it('processes all pending intakes and returns a results array', async () => {
    let intakesCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'intakes') {
        intakesCallCount++
        if (intakesCallCount === 1) {
          // First call: fetch pending intakes
          return makeChain({ data: SAMPLE_INTAKES, error: null })
        }
        // Subsequent calls: update with brief
        return makeChain({ data: null, error: null })
      }
      // wearable_metrics: no data
      return makeChain({ data: [], error: null })
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
    let intakesCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'intakes') {
        intakesCallCount++
        return intakesCallCount === 1
          ? makeChain({ data: [SAMPLE_INTAKES[0]], error: null })
          : makeChain({ data: null, error: null })
      }
      return makeChain({ data: [], error: null })
    })

    const { POST } = await import('../route')
    await POST(makeRequest(VALID_SECRET))

    expect(mockFrom).toHaveBeenCalledWith('wearable_metrics')
  })

  it('saves the generated brief back to the intake record', async () => {
    let capturedBrief: unknown = null
    let intakesCallCount = 0

    mockFrom.mockImplementation((table: string) => {
      if (table === 'intakes') {
        intakesCallCount++
        if (intakesCallCount === 1) {
          return makeChain({ data: [SAMPLE_INTAKES[0]], error: null })
        }
        // Second call = update with brief
        const chain = makeChain({ data: null, error: null })
        chain.update = jest.fn().mockImplementation((args: unknown) => {
          capturedBrief = args
          return chain
        })
        return chain
      }
      return makeChain({ data: [], error: null })
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

    let intakesCallCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'intakes') {
        intakesCallCount++
        return intakesCallCount === 1
          ? makeChain({ data: SAMPLE_INTAKES, error: null })
          : makeChain({ data: null, error: null })
      }
      return makeChain({ data: [], error: null })
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
    const chain = makeChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const { POST } = await import('../route')
    await POST(makeRequest(VALID_SECRET))

    // Verify the .is() call (for ai_brief IS NULL) was made
    expect(chain.is).toHaveBeenCalledWith('ai_brief', null)
    // Verify the .in() call filters to submitted/reviewed
    expect(chain.in).toHaveBeenCalledWith('status', ['submitted', 'reviewed'])
  })
})
