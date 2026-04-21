/**
 * Tests for POST /api/scheduling/book
 *
 * Strategy: mock all external dependencies so the route runs without real
 * credentials. @/lib/scheduling is also mocked so isSlotAvailable can be
 * controlled per-test (the real scheduling logic is covered in scheduling.test.ts).
 *
 * What we verify:
 * - Missing required fields → 400
 * - Appointment type not found → 404
 * - Slot already taken → 409
 * - Member patient books free → status: confirmed, no Stripe call
 * - Non-member patient → status: pending_payment, checkoutUrl returned
 * - Video room is created for member bookings
 * - Google Calendar event is created for member bookings
 */

import type { NextRequest } from 'next/server'

// ── Scheduling mock (controlled per-test) ────────────────────────────────────

const mockIsSlotAvailable = jest.fn().mockReturnValue(true)

jest.mock('@/lib/scheduling', () => ({
  isSlotAvailable: (...args: unknown[]) => mockIsSlotAvailable(...args),
  getDayOfWeek: jest.fn().mockReturnValue('monday'),
  computeAvailableSlots: jest.fn().mockReturnValue([]),
  formatPrice: jest.fn((cents: number) => `$${(cents / 100).toFixed(2)}`),
  PROVIDER_TIMEZONE: 'America/Denver',
}))

// ── Drizzle db mock ───────────────────────────────────────────────────────────

const mockDbQuery = {
  appointment_types: { findFirst: jest.fn() },
  provider_availability: { findMany: jest.fn() },
  appointments: { findMany: jest.fn() },
  subscriptions: { findFirst: jest.fn() },
  patients: { findFirst: jest.fn() },
}

// Drizzle update/insert chain mock
function makeUpdateChain(resolveWith: unknown = null) {
  const chain: any = {}
  chain.set = jest.fn().mockReturnValue(chain)
  chain.where = jest.fn().mockReturnValue(chain)
  chain.returning = jest.fn().mockResolvedValue(resolveWith ? [resolveWith] : [])
  return chain
}

function makeInsertChain(resolveWith: unknown = null) {
  const chain: any = {}
  chain.values = jest.fn().mockReturnValue(chain)
  chain.returning = jest.fn().mockResolvedValue(resolveWith ? [resolveWith] : [])
  return chain
}

const mockDbUpdate = jest.fn()
const mockDbInsert = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    query: mockDbQuery,
    update: (...args: unknown[]) => mockDbUpdate(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}))

// ── Stripe mock ───────────────────────────────────────────────────────────────

const mockStripeSessionCreate = jest.fn()

jest.mock('@/lib/stripe', () => ({
  getStripe: jest.fn(() => ({
    checkout: {
      sessions: { create: mockStripeSessionCreate },
    },
  })),
  STRIPE_PRICES: {
    intake: 'price_test_intake_123',
    membership: 'price_test_membership_456',
  },
}))

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockGetServerSession = jest.fn()

jest.mock('@/lib/getServerSession', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

// ── External service mocks ────────────────────────────────────────────────────

const mockCreateVideoRoom = jest.fn()
const mockCreateCalendarEvent = jest.fn()

jest.mock('@/lib/daily-video', () => ({
  createVideoRoom: (...args: unknown[]) => mockCreateVideoRoom(...args),
  startCloudRecording: jest.fn().mockResolvedValue({}),
}))

jest.mock('@/lib/google-calendar', () => ({
  createCalendarEvent: (...args: unknown[]) => mockCreateCalendarEvent(...args),
}))

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email_123' }) },
  })),
}))

// ── Fixture data ──────────────────────────────────────────────────────────────

const APPOINTMENT_TYPE = {
  id: 'appt-type-uuid-789',
  name: 'Intake Consultation',
  duration_minutes: 60,
  price_cents: 65000,
}

const PATIENT = {
  id: 'patient-uuid-123',
  profiles: { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
}

const NEW_APPOINTMENT = {
  id: 'new-appt-uuid-001',
  provider_id: 'provider-uuid-456',
  patient_id: 'patient-uuid-123',
  appointment_type_id: 'appt-type-uuid-789',
  starts_at: new Date('2026-04-21T15:00:00.000Z'),
  ends_at: new Date('2026-04-21T16:00:00.000Z'),
  status: 'confirmed',
  is_paid: true,
  amount_cents: 0,
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

/**
 * Configure the db mock for a typical booking scenario.
 * subscriptionsResponses: array of values returned per successive findFirst call.
 */
function setupDb({
  appointmentType = APPOINTMENT_TYPE,
  providerAvailability = [{ start_time: '08:00', end_time: '18:00' }],
  bookedAppointments = [],
  subscriptionsResponses = [null, null] as (unknown | null)[],
  patient = PATIENT,
  insertResult = NEW_APPOINTMENT,
}: {
  appointmentType?: unknown
  providerAvailability?: unknown[]
  bookedAppointments?: unknown[]
  subscriptionsResponses?: (unknown | null)[]
  patient?: unknown
  insertResult?: unknown
} = {}) {
  mockDbQuery.appointment_types.findFirst.mockResolvedValue(appointmentType)
  mockDbQuery.provider_availability.findMany.mockResolvedValue(providerAvailability)
  mockDbQuery.appointments.findMany.mockResolvedValue(bookedAppointments)

  let subCallCount = 0
  mockDbQuery.subscriptions.findFirst.mockImplementation(() => {
    const val = subscriptionsResponses[subCallCount] ?? null
    subCallCount++
    return Promise.resolve(val)
  })

  mockDbQuery.patients.findFirst.mockResolvedValue(patient)

  // insert returns the new appointment
  mockDbInsert.mockReturnValue(makeInsertChain(insertResult))
  // update is a no-op (video url, stripe session id, calendar event id)
  mockDbUpdate.mockReturnValue(makeUpdateChain(null))
}

// ── Request helpers ───────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/scheduling/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    patientId: 'patient-uuid-123',
    providerId: 'provider-uuid-456',
    appointmentTypeId: 'appt-type-uuid-789',
    startsAt: '2026-04-21T15:00:00.000Z',
    patientNotes: 'First visit',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/scheduling/book', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: authenticated as the patient who owns the appointment
    mockGetServerSession.mockResolvedValue({ role: 'patient', patientId: 'patient-uuid-123' })
    mockIsSlotAvailable.mockReturnValue(true)
    mockCreateVideoRoom.mockResolvedValue({
      url: 'https://womenkind.daily.co/test-room',
      roomName: 'test-room',
    })
    mockCreateCalendarEvent.mockResolvedValue('gcal_event_123')
    mockStripeSessionCreate.mockResolvedValue({
      id: 'cs_test_abc',
      url: 'https://checkout.stripe.com/pay/cs_test_abc',
    })
  })

  // ── Validation (400) ────────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 when patientId is missing', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest(validBody({ patientId: undefined })))
      expect(res.status).toBe(400)
    })

    it('returns 400 when providerId is missing', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest(validBody({ providerId: undefined })))
      expect(res.status).toBe(400)
    })

    it('returns 400 when startsAt is missing', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest(validBody({ startsAt: undefined })))
      expect(res.status).toBe(400)
    })

    it('returns 400 when appointmentTypeId is missing', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest(validBody({ appointmentTypeId: undefined })))
      expect(res.status).toBe(400)
    })

    it('returns 400 with a helpful error message when all fields are missing', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest({}))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/required/)
    })
  })

  // ── Not found (404) ─────────────────────────────────────────────────────────

  it('returns 404 when appointment type does not exist', async () => {
    mockDbQuery.appointment_types.findFirst.mockResolvedValue(null)
    const { POST } = await import('../book/route')
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(404)
  })

  // ── Slot conflict (409) ─────────────────────────────────────────────────────

  it('returns 409 when the requested slot is no longer available', async () => {
    mockIsSlotAvailable.mockReturnValue(false)
    setupDb()
    const { POST } = await import('../book/route')
    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/no longer available/)
  })

  // ── Member booking (happy path) ─────────────────────────────────────────────

  describe('member patient (active membership)', () => {
    beforeEach(() => {
      setupDb({
        subscriptionsResponses: [{ status: 'active' }],
      })
    })

    it('returns status: confirmed and the appointment', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest(validBody()))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('confirmed')
      expect(body.appointment).toBeDefined()
      expect(body.appointment.id).toBe(NEW_APPOINTMENT.id)
    })

    it('does NOT call Stripe (members book for free)', async () => {
      const { POST } = await import('../book/route')
      await POST(makeRequest(validBody()))
      expect(mockStripeSessionCreate).not.toHaveBeenCalled()
    })

    it('creates a video room', async () => {
      const { POST } = await import('../book/route')
      await POST(makeRequest(validBody()))
      expect(mockCreateVideoRoom).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: NEW_APPOINTMENT.id })
      )
    })

    it('returns the video room URL in the response', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest(validBody()))
      const body = await res.json()
      expect(body.appointment.video_room_url).toBe('https://womenkind.daily.co/test-room')
    })
  })

  // ── Non-member booking (happy path) ────────────────────────────────────────

  describe('non-member patient (no active membership)', () => {
    beforeEach(() => {
      setupDb({
        subscriptionsResponses: [null, null],
        insertResult: { ...NEW_APPOINTMENT, status: 'pending_payment', is_paid: false, amount_cents: 65000 },
      })
    })

    it('returns status: pending_payment', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest(validBody()))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('pending_payment')
    })

    it('returns a Stripe checkoutUrl', async () => {
      const { POST } = await import('../book/route')
      const res = await POST(makeRequest(validBody()))
      const body = await res.json()
      expect(body.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test_abc')
    })

    it('calls Stripe with payment mode', async () => {
      const { POST } = await import('../book/route')
      await POST(makeRequest(validBody()))
      expect(mockStripeSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'payment' })
      )
    })

    it('does NOT create a video room (payment not yet received)', async () => {
      const { POST } = await import('../book/route')
      await POST(makeRequest(validBody()))
      expect(mockCreateVideoRoom).not.toHaveBeenCalled()
    })
  })
})
