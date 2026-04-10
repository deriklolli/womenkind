/**
 * Tests for GET / POST / PATCH /api/messages
 *
 * The messages route handles the patient-provider secure messaging system.
 * Three handlers:
 *   GET  - fetch threads (by patientId or providerId) or a single thread (by threadId)
 *   POST - send a new message; creates notification when provider sends
 *   PATCH - mark messages in a thread as read
 *
 * What we verify:
 * POST:
 *   - Missing required fields → 400
 *   - Sends message and returns message + threadId
 *   - Uses provided threadId when given (reply); generates UUID when absent (new thread)
 *   - Creates a notification when a provider sends a message
 *   - Does NOT create a notification when a patient sends
 *   - PHI audit is called on every send
 *   - DB error → 500
 *
 * PATCH:
 *   - Missing threadId or readerId → 400
 *   - Marks unread messages as read and returns { success: true }
 *
 * GET:
 *   - Returns threads array when queried by patientId
 *   - Returns messages array when queried by threadId
 */

import type { NextRequest } from 'next/server'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  getServiceSupabase: jest.fn(() => ({ from: mockFrom })),
}))

// ── PHI audit mock ────────────────────────────────────────────────────────────

const mockLogPhiAccess = jest.fn()

jest.mock('@/lib/phi-audit', () => ({
  logPhiAccess: (...args: unknown[]) => mockLogPhiAccess(...args),
}))

// ── Chain factory ─────────────────────────────────────────────────────────────

function makeChain(resolveWith: unknown = { data: null, error: null }) {
  const resolved = Promise.resolve(resolveWith)
  const chain: any = {
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  }
  ;['select', 'eq', 'in', 'is', 'order', 'or', 'update', 'insert'].forEach(
    m => { chain[m] = jest.fn().mockReturnValue(chain) }
  )
  chain.single = jest.fn().mockResolvedValue(resolveWith)
  chain.maybeSingle = jest.fn().mockResolvedValue(resolveWith)
  return chain
}

// ── Request helpers ───────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new Request('http://localhost:3000/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function makePatchRequest(body: unknown) {
  return new Request('http://localhost:3000/api/messages', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function makeGetRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/messages')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const req = new Request(url.toString(), { method: 'GET' }) as unknown as NextRequest
  // NextRequest.nextUrl is needed by the route for searchParams — patch it onto the plain Request
  Object.defineProperty(req, 'nextUrl', { value: url, writable: false })
  return req
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const SAVED_MESSAGE = {
  id: 'msg-uuid-001',
  thread_id: 'thread-uuid-abc',
  sender_type: 'patient',
  sender_id: 'patient-uuid-123',
  recipient_id: 'provider-uuid-456',
  subject: 'Question about my prescription',
  body: 'When should I start taking the medication?',
  read_at: null,
  created_at: new Date().toISOString(),
}

const PROVIDER_MESSAGE = {
  ...SAVED_MESSAGE,
  id: 'msg-uuid-002',
  sender_type: 'provider',
  sender_id: 'provider-uuid-456',
  recipient_id: 'patient-uuid-123',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('/api/messages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom.mockReturnValue(makeChain({ data: SAVED_MESSAGE, error: null }))
  })

  // ── POST: validation ────────────────────────────────────────────────────────

  describe('POST - validation', () => {
    it('returns 400 when senderId is missing', async () => {
      const { POST } = await import('../route')
      const res = await POST(makePostRequest({
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'Hello',
      }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when senderType is missing', async () => {
      const { POST } = await import('../route')
      const res = await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        recipientId: 'provider-uuid-456',
        body: 'Hello',
      }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when recipientId is missing', async () => {
      const { POST } = await import('../route')
      const res = await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        body: 'Hello',
      }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when body is missing', async () => {
      const { POST } = await import('../route')
      const res = await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
      }))
      expect(res.status).toBe(400)
    })

    it('returns 400 with a helpful error message', async () => {
      const { POST } = await import('../route')
      const res = await POST(makePostRequest({}))
      expect(res.status).toBe(400)
      const resBody = await res.json()
      expect(resBody.error).toMatch(/required/)
    })
  })

  // ── POST: send message ──────────────────────────────────────────────────────

  describe('POST - send message', () => {
    it('returns the saved message and threadId', async () => {
      mockFrom.mockReturnValue(makeChain({ data: SAVED_MESSAGE, error: null }))
      const { POST } = await import('../route')
      const res = await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'When should I start taking the medication?',
        threadId: 'thread-uuid-abc',
      }))
      expect(res.status).toBe(200)
      const resBody = await res.json()
      expect(resBody.message).toBeDefined()
      expect(resBody.threadId).toBe('thread-uuid-abc')
    })

    it('uses the provided threadId when replying to an existing thread', async () => {
      let insertArgs: unknown = null
      const chain = makeChain({ data: SAVED_MESSAGE, error: null })
      chain.insert = jest.fn().mockImplementation((args: unknown) => {
        insertArgs = args
        return chain
      })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'Follow-up question',
        threadId: 'existing-thread-xyz',
      }))

      expect(insertArgs).toMatchObject({ thread_id: 'existing-thread-xyz' })
    })

    it('generates a new UUID threadId when no threadId is provided', async () => {
      let insertArgs: any = null
      const chain = makeChain({ data: SAVED_MESSAGE, error: null })
      chain.insert = jest.fn().mockImplementation((args: unknown) => {
        insertArgs = args
        return chain
      })
      mockFrom.mockReturnValue(chain)

      const { POST } = await import('../route')
      await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'New question',
      }))

      expect(insertArgs.thread_id).toBeDefined()
      expect(insertArgs.thread_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('returns 500 when the DB insert fails', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'unique constraint' } }))
      const { POST } = await import('../route')
      const res = await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'Hello',
      }))
      expect(res.status).toBe(500)
    })
  })

  // ── POST: notifications ─────────────────────────────────────────────────────

  describe('POST - provider notifications', () => {
    it('creates a notification in the DB when a provider sends a message', async () => {
      let notificationInserted = false
      let insertCallCount = 0

      mockFrom.mockImplementation((table: string) => {
        if (table === 'messages') {
          const chain = makeChain({ data: PROVIDER_MESSAGE, error: null })
          return chain
        }
        if (table === 'providers') {
          return makeChain({
            data: { profiles: { first_name: 'Jennifer', last_name: 'Urban' } },
            error: null,
          })
        }
        if (table === 'notifications') {
          const chain = makeChain({ data: null, error: null })
          chain.insert = jest.fn().mockImplementation(() => {
            notificationInserted = true
            return chain
          })
          return chain
        }
        return makeChain({ data: null, error: null })
      })

      const { POST } = await import('../route')
      await POST(makePostRequest({
        senderId: 'provider-uuid-456',
        senderType: 'provider',
        recipientId: 'patient-uuid-123',
        body: 'Your labs look great!',
      }))

      expect(notificationInserted).toBe(true)
    })

    it('does NOT create a notification when a patient sends a message', async () => {
      let notificationsQueried = false
      mockFrom.mockImplementation((table: string) => {
        if (table === 'notifications') notificationsQueried = true
        return makeChain({ data: SAVED_MESSAGE, error: null })
      })

      const { POST } = await import('../route')
      await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'Question about dosage',
      }))

      expect(notificationsQueried).toBe(false)
    })
  })

  // ── POST: PHI audit ─────────────────────────────────────────────────────────

  describe('POST - PHI audit', () => {
    it('calls logPhiAccess on every send', async () => {
      mockFrom.mockReturnValue(makeChain({ data: SAVED_MESSAGE, error: null }))
      const { POST } = await import('../route')
      await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'Hello',
      }))
      expect(mockLogPhiAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          recordType: 'message',
          action: 'create',
          route: '/api/messages',
        })
      )
    })
  })

  // ── PATCH: mark as read ─────────────────────────────────────────────────────

  describe('PATCH - mark as read', () => {
    it('returns 400 when threadId is missing', async () => {
      const { PATCH } = await import('../route')
      const res = await PATCH(makePatchRequest({ readerId: 'patient-uuid-123' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when readerId is missing', async () => {
      const { PATCH } = await import('../route')
      const res = await PATCH(makePatchRequest({ threadId: 'thread-uuid-abc' }))
      expect(res.status).toBe(400)
    })

    it('returns { success: true } when messages are marked read', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: null }))
      const { PATCH } = await import('../route')
      const res = await PATCH(makePatchRequest({
        threadId: 'thread-uuid-abc',
        readerId: 'patient-uuid-123',
      }))
      expect(res.status).toBe(200)
      const resBody = await res.json()
      expect(resBody).toEqual({ success: true })
    })

    it('only marks messages where read_at is null', async () => {
      const chain = makeChain({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const { PATCH } = await import('../route')
      await PATCH(makePatchRequest({
        threadId: 'thread-uuid-abc',
        readerId: 'patient-uuid-123',
      }))

      expect(chain.is).toHaveBeenCalledWith('read_at', null)
    })
  })

  // ── GET: threads and messages ───────────────────────────────────────────────

  describe('GET - threads by patientId', () => {
    it('returns a threads array', async () => {
      mockFrom.mockReturnValue(makeChain({ data: [SAVED_MESSAGE], error: null }))
      const { GET } = await import('../route')
      const res = await GET(makeGetRequest({ patientId: 'patient-uuid-123' }))
      expect(res.status).toBe(200)
      const resBody = await res.json()
      expect(resBody).toHaveProperty('threads')
      expect(Array.isArray(resBody.threads)).toBe(true)
    })
  })

  describe('GET - messages in a thread', () => {
    it('returns a messages array when threadId is provided', async () => {
      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        if (callCount === 1) return makeChain({ data: [SAVED_MESSAGE], error: null })
        return makeChain({ data: [], error: null }) // patient name lookup
      })

      const { GET } = await import('../route')
      const res = await GET(makeGetRequest({ threadId: 'thread-uuid-abc' }))
      expect(res.status).toBe(200)
      const resBody = await res.json()
      expect(resBody).toHaveProperty('messages')
      expect(Array.isArray(resBody.messages)).toBe(true)
    })
  })
})
