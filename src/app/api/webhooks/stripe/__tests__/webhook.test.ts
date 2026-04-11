/**
 * Tests for POST /api/webhooks/stripe
 *
 * This webhook is the most critical path in the app — it's what actually
 * marks intakes as paid, activates memberships, and confirms appointments
 * after Stripe processes a payment.
 *
 * Strategy: no STRIPE_WEBHOOK_SECRET in tests, so the route parses the body
 * directly (its built-in dev/test fallback). We mock @/lib/supabase-server,
 * @/lib/stripe, @/lib/daily-video, @/lib/google-calendar, and resend.
 *
 * Event types covered:
 * - checkout.session.completed → intake, appointment, membership, intake_and_membership
 * - invoice.payment_succeeded
 * - customer.subscription.deleted
 * - customer.subscription.updated
 * - Unknown event type (graceful no-op)
 * - Invalid signature (when webhook secret is set)
 */

import type { NextRequest } from 'next/server'

// ── Per-table Supabase mock ───────────────────────────────────────────────────

const mockInsert = jest.fn()
const mockUpdate = jest.fn()
const mockSelectSingle = jest.fn()

/**
 * Returns a chainable Supabase query builder mock.
 * `resolveWith` is what .single() / .maybeSingle() returns.
 */
function makeChain(resolveWith: unknown = { data: null, error: null }) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'eq', 'neq', 'not', 'gte', 'lte', 'limit']
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
  chain.single = jest.fn().mockResolvedValue(resolveWith)
  chain.maybeSingle = jest.fn().mockResolvedValue(resolveWith)
  chain.insert = mockInsert.mockReturnValue(chain)
  chain.update = mockUpdate.mockReturnValue(chain)
  return chain
}

const mockFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  getServiceSupabase: jest.fn(() => ({ from: mockFrom })),
}))

// ── Stripe mock ───────────────────────────────────────────────────────────────

const mockConstructEvent = jest.fn()

jest.mock('@/lib/stripe', () => ({
  getStripe: jest.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    checkout: { sessions: { create: jest.fn() } },
  })),
  STRIPE_PRICES: { intake: 'price_test_intake', membership: 'price_test_membership' },
}))

// ── External service mocks ────────────────────────────────────────────────────

jest.mock('@/lib/daily-video', () => ({
  createVideoRoom: jest.fn().mockResolvedValue({
    url: 'https://womenkind.daily.co/test-room',
    roomName: 'test-room',
  }),
  startCloudRecording: jest.fn().mockResolvedValue({}),
}))

jest.mock('@/lib/google-calendar', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue('gcal_event_123'),
}))

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email_123' }) },
  })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a fake Stripe event and POST it with a test signature header */
function makeWebhookRequest(event: object) {
  const body = JSON.stringify(event)
  return new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'test_sig',
    },
    body,
  }) as unknown as NextRequest
}

function checkoutEvent(metadata: Record<string, string>, extra: object = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_abc123',
        customer: 'cus_test_123',
        amount_total: 65000,
        subscription: null,
        metadata,
        ...extra,
      },
    },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Signature verification is now mandatory — set the secret and have
    // constructEvent return the parsed event so all tests pass through.
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
    mockConstructEvent.mockImplementation((body: string) => JSON.parse(body))
    // Default: all DB calls return empty data
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }))
  })

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET
  })

  // ── Signature verification ────────────────────────────────────────────────

  it('returns 400 when webhook secret is set but signature is invalid', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })

    const { POST } = await import('../route')
    const req = new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'bad_sig',
      },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    }) as unknown as NextRequest

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/signature/i)

    delete process.env.STRIPE_WEBHOOK_SECRET
  })

  // ── Unknown / unhandled event type ────────────────────────────────────────

  it('returns { received: true } for an unhandled event type', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeWebhookRequest({
      type: 'payment_intent.created',
      data: { object: {} },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ received: true })
  })

  // ── checkout.session.completed → intake ──────────────────────────────────

  describe('checkout.session.completed (type: intake)', () => {
    it('updates intake status to submitted and marks paid', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      const res = await POST(makeWebhookRequest(checkoutEvent({
        type: 'intake',
        intakeId: 'intake-uuid-123',
        patientId: 'patient-uuid-456',
      })))

      expect(res.status).toBe(200)
      expect(mockFrom).toHaveBeenCalledWith('intakes')
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'submitted', paid: true })
      )
    })

    it('inserts a subscription record with plan_type: intake', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      await POST(makeWebhookRequest(checkoutEvent({
        type: 'intake',
        intakeId: 'intake-uuid-123',
        patientId: 'patient-uuid-456',
      })))

      expect(mockFrom).toHaveBeenCalledWith('subscriptions')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ plan_type: 'intake', status: 'active' })
      )
    })
  })

  // ── checkout.session.completed → appointment ──────────────────────────────

  describe('checkout.session.completed (type: appointment)', () => {
    const appointmentData = {
      id: 'appt-uuid-789',
      starts_at: '2026-04-21T15:00:00.000Z',
      ends_at: '2026-04-21T16:00:00.000Z',
      patient_notes: 'First visit',
      appointment_types: { name: 'Intake Consultation', duration_minutes: 60 },
      patients: { profiles: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' } },
    }

    it('confirms appointment and marks is_paid: true', async () => {
      const chain = makeChain({ data: appointmentData, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      const res = await POST(makeWebhookRequest(checkoutEvent({
        type: 'appointment',
        appointmentId: 'appt-uuid-789',
        patientId: 'patient-uuid-456',
        providerId: 'provider-uuid-123',
      })))

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed', is_paid: true })
      )
    })

    it('creates a video room for the appointment', async () => {
      const { createVideoRoom } = await import('@/lib/daily-video')
      const chain = makeChain({ data: appointmentData, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      await POST(makeWebhookRequest(checkoutEvent({
        type: 'appointment',
        appointmentId: 'appt-uuid-789',
        patientId: 'patient-uuid-456',
        providerId: 'provider-uuid-123',
      })))

      expect(createVideoRoom).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: 'appt-uuid-789' })
      )
    })

    it('creates a Google Calendar event', async () => {
      const { createCalendarEvent } = await import('@/lib/google-calendar')
      const chain = makeChain({ data: appointmentData, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      await POST(makeWebhookRequest(checkoutEvent({
        type: 'appointment',
        appointmentId: 'appt-uuid-789',
        patientId: 'patient-uuid-456',
        providerId: 'provider-uuid-123',
      })))

      expect(createCalendarEvent).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'provider-uuid-123' })
      )
    })
  })

  // ── checkout.session.completed → membership ───────────────────────────────

  describe('checkout.session.completed (type: membership)', () => {
    it('inserts a membership subscription record with status: active', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      const res = await POST(makeWebhookRequest(checkoutEvent(
        {
          type: 'membership',
          patientId: 'patient-uuid-456',
        },
        { subscription: 'sub_test_123' }
      )))

      expect(res.status).toBe(200)
      expect(mockFrom).toHaveBeenCalledWith('subscriptions')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_type: 'membership',
          status: 'active',
          stripe_subscription_id: 'sub_test_123',
        })
      )
    })
  })

  // ── checkout.session.completed → intake_and_membership ───────────────────

  describe('checkout.session.completed (type: intake_and_membership)', () => {
    it('handles both intake payment and membership start', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      const res = await POST(makeWebhookRequest(checkoutEvent(
        {
          type: 'intake_and_membership',
          intakeId: 'intake-uuid-123',
          patientId: 'patient-uuid-456',
        },
        { subscription: 'sub_test_456' }
      )))

      expect(res.status).toBe(200)
      // Both an update (intake) and inserts (intake record + membership record) should fire
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'submitted', paid: true })
      )
      expect(mockInsert).toHaveBeenCalledTimes(2)
    })
  })

  // ── invoice.payment_succeeded ─────────────────────────────────────────────

  describe('invoice.payment_succeeded', () => {
    it('updates subscription status to active', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      const res = await POST(makeWebhookRequest({
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: 'sub_test_789',
            lines: {
              data: [{ period: { end: 1777000000 } }],
            },
          },
        },
      }))

      expect(res.status).toBe(200)
      expect(mockFrom).toHaveBeenCalledWith('subscriptions')
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      )
    })
  })

  // ── customer.subscription.deleted ────────────────────────────────────────

  describe('customer.subscription.deleted', () => {
    it('marks the subscription as canceled', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      const res = await POST(makeWebhookRequest({
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_test_canceled' },
        },
      }))

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'canceled' })
    })
  })

  // ── customer.subscription.updated ────────────────────────────────────────

  describe('customer.subscription.updated', () => {
    it('updates subscription status to past_due', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      const res = await POST(makeWebhookRequest({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_789',
            status: 'past_due',
            current_period_end: 1777000000,
          },
        },
      }))

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'past_due' })
      )
    })

    it('updates subscription status to active', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      const res = await POST(makeWebhookRequest({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_789',
            status: 'active',
            current_period_end: 1777000000,
          },
        },
      }))

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      )
    })
  })
})
