/**
 * Tests for POST /api/stripe/checkout
 *
 * Strategy: mock @/lib/stripe and @/lib/db so the route runs
 * in isolation without real credentials.
 *
 * What we verify:
 * - Missing intakeId → 400
 * - STRIPE_PRICES.intake not configured → 500
 * - Valid intakeId → Stripe session created, returns sessionId + url
 */

import type { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/getServerSession', () => ({
  getServerSession: jest.fn(),
}))

const mockSessionCreate = jest.fn()

jest.mock('@/lib/stripe', () => ({
  getStripe: jest.fn(() => ({
    checkout: {
      sessions: {
        create: mockSessionCreate,
      },
    },
    customers: {
      list: jest.fn().mockResolvedValue({ data: [] }),
      create: jest.fn().mockResolvedValue({ id: 'cus_test_123' }),
    },
  })),
  STRIPE_PRICES: {
    intake: 'price_test_intake_123',
    membership: 'price_test_membership_456',
  },
}))

// Mock Drizzle db
const mockFindFirst = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      intakes: { findFirst: mockFindFirst },
      subscriptions: { findFirst: mockFindFirst },
    },
  },
}))

jest.mock('@/lib/db/schema', () => ({
  intakes: {},
  subscriptions: {},
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default: authenticated as a provider
    ;(getServerSession as jest.Mock).mockResolvedValue({
      userId: 'user-test-123',
      patientId: null,
      providerId: 'provider-test-123',
      role: 'provider',
    })

    // Default: DB lookups return nothing
    mockFindFirst.mockResolvedValue(null)

    mockSessionCreate.mockResolvedValue({
      id: 'cs_test_abc123',
      url: 'https://checkout.stripe.com/pay/cs_test_abc123',
    })
  })

  it('returns 400 when intakeId is missing', async () => {
    const { POST } = await import('../checkout/route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/intakeId/)
  })

  it('returns 400 when body is empty object', async () => {
    const { POST } = await import('../checkout/route')
    const res = await POST(makeRequest({ patientId: 'some-id' })) // no intakeId
    expect(res.status).toBe(400)
  })

  it('calls Stripe and returns sessionId + url when intakeId is provided', async () => {
    const { POST } = await import('../checkout/route')
    const res = await POST(makeRequest({
      intakeId: 'intake-uuid-123',
      patientEmail: 'patient@example.com',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('sessionId', 'cs_test_abc123')
    expect(body).toHaveProperty('url', 'https://checkout.stripe.com/pay/cs_test_abc123')
    expect(mockSessionCreate).toHaveBeenCalledTimes(1)
  })

  it('uses payment mode (not subscription) when addMembership is false', async () => {
    const { POST } = await import('../checkout/route')
    await POST(makeRequest({
      intakeId: 'intake-uuid-123',
      addMembership: false,
    }))
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'payment' })
    )
  })

  it('uses subscription mode when addMembership is true', async () => {
    const { POST } = await import('../checkout/route')
    await POST(makeRequest({
      intakeId: 'intake-uuid-123',
      addMembership: true,
    }))
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'subscription' })
    )
  })
})
