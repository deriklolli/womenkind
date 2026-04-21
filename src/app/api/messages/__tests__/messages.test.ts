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

// ── Drizzle db mock ───────────────────────────────────────────────────────────

const mockDbInsert = jest.fn()
const mockDbSelect = jest.fn()
const mockDbUpdate = jest.fn()

// Chainable select builder
function makeSelectChain(result: unknown[]) {
  const chain: any = {}
  const resolved = Promise.resolve(result)
  chain.from = jest.fn().mockReturnValue(chain)
  chain.where = jest.fn().mockReturnValue(chain)
  chain.orderBy = jest.fn().mockReturnValue(chain)
  chain.limit = jest.fn().mockReturnValue(chain)
  chain.innerJoin = jest.fn().mockReturnValue(chain)
  chain.then = resolved.then.bind(resolved)
  chain.catch = resolved.catch.bind(resolved)
  return chain
}

// Chainable insert builder
function makeInsertChain(result: unknown[]) {
  const chain: any = {}
  const resolved = Promise.resolve(result)
  chain.values = jest.fn().mockReturnValue(chain)
  chain.returning = jest.fn().mockResolvedValue(result)
  chain.then = resolved.then.bind(resolved)
  chain.catch = resolved.catch.bind(resolved)
  return chain
}

// Chainable update builder
function makeUpdateChain() {
  const chain: any = {}
  const resolved = Promise.resolve(undefined)
  chain.set = jest.fn().mockReturnValue(chain)
  chain.where = jest.fn().mockReturnValue(chain)
  chain.then = resolved.then.bind(resolved)
  chain.catch = resolved.catch.bind(resolved)
  return chain
}

jest.mock('@/lib/db', () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}))

jest.mock('@/lib/db/schema', () => ({
  messages: 'messages',
  notifications: 'notifications',
  patients: 'patients',
  providers: 'providers',
  profiles: 'profiles',
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  and: jest.fn((..._args: unknown[]) => ({ type: 'and' })),
  or: jest.fn((..._args: unknown[]) => ({ type: 'or' })),
  desc: jest.fn((_col: unknown) => ({ type: 'desc' })),
  asc: jest.fn((_col: unknown) => ({ type: 'asc' })),
  isNull: jest.fn((_col: unknown) => ({ type: 'isNull' })),
  inArray: jest.fn((_col: unknown, _vals: unknown) => ({ type: 'inArray' })),
}))

// ── PHI audit mock ────────────────────────────────────────────────────────────

const mockLogPhiAccess = jest.fn()

jest.mock('@/lib/phi-audit', () => ({
  logPhiAccess: (...args: unknown[]) => mockLogPhiAccess(...args),
}))

// ── Session mock ──────────────────────────────────────────────────────────────

// Default: authenticated patient session. Override per-test for provider flows.
let mockSessionData: object | null = {
  userId: 'user-uuid-001',
  patientId: 'patient-uuid-123',
  providerId: null,
  role: 'patient',
}

jest.mock('@/lib/getServerSession', () => ({
  getServerSession: jest.fn().mockImplementation(() => Promise.resolve(mockSessionData)),
}))

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
    // Reset to default patient session before each test
    mockSessionData = {
      userId: 'user-uuid-001',
      patientId: 'patient-uuid-123',
      providerId: null,
      role: 'patient',
    }
    // Default: insert returns the saved message
    mockDbInsert.mockReturnValue(makeInsertChain([SAVED_MESSAGE]))
    // Default: select returns empty array
    mockDbSelect.mockReturnValue(makeSelectChain([]))
    // Default: update chain
    mockDbUpdate.mockReturnValue(makeUpdateChain())
  })

  // ── POST: validation ────────────────────────────────────────────────────────

  describe('POST - validation', () => {
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
      mockDbInsert.mockReturnValue(makeInsertChain([SAVED_MESSAGE]))
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
      let insertedValues: unknown = null
      const insertChain = makeInsertChain([SAVED_MESSAGE])
      const origValues = insertChain.values
      insertChain.values = jest.fn().mockImplementation((args: unknown) => {
        insertedValues = args
        return origValues.call(insertChain, args)
      })
      mockDbInsert.mockReturnValue(insertChain)

      const { POST } = await import('../route')
      await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'Follow-up question',
        threadId: 'existing-thread-xyz',
      }))

      expect(insertedValues).toMatchObject({ thread_id: 'existing-thread-xyz' })
    })

    it('generates a new UUID threadId when no threadId is provided', async () => {
      let insertedValues: any = null
      const insertChain = makeInsertChain([SAVED_MESSAGE])
      const origValues = insertChain.values
      insertChain.values = jest.fn().mockImplementation((args: unknown) => {
        insertedValues = args
        return origValues.call(insertChain, args)
      })
      mockDbInsert.mockReturnValue(insertChain)

      const { POST } = await import('../route')
      await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'New question',
      }))

      expect(insertedValues.thread_id).toBeDefined()
      expect(insertedValues.thread_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('returns 500 when the DB insert fails', async () => {
      const failChain = makeInsertChain([])
      failChain.returning = jest.fn().mockRejectedValue(new Error('unique constraint'))
      mockDbInsert.mockReturnValue(failChain)

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
      // Switch to provider session for this test
      mockSessionData = {
        userId: 'user-uuid-002',
        patientId: null,
        providerId: 'provider-uuid-456',
        role: 'provider',
      }

      let notificationInserted = false

      // First insert call = messages, second = notifications
      let insertCallCount = 0
      mockDbInsert.mockImplementation(() => {
        insertCallCount++
        if (insertCallCount === 1) {
          return makeInsertChain([PROVIDER_MESSAGE])
        }
        // notifications insert
        const chain = makeInsertChain([])
        const origValues = chain.values
        chain.values = jest.fn().mockImplementation((args: unknown) => {
          notificationInserted = true
          return origValues.call(chain, args)
        })
        return chain
      })

      // Provider name lookup select
      mockDbSelect.mockReturnValue(makeSelectChain([
        { first_name: 'Jennifer', last_name: 'Urban' },
      ]))

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
      let insertCallCount = 0
      mockDbInsert.mockImplementation(() => {
        insertCallCount++
        return makeInsertChain([SAVED_MESSAGE])
      })

      const { POST } = await import('../route')
      await POST(makePostRequest({
        senderId: 'patient-uuid-123',
        senderType: 'patient',
        recipientId: 'provider-uuid-456',
        body: 'Question about dosage',
      }))

      // Only one insert (messages), not two (messages + notifications)
      expect(insertCallCount).toBe(1)
    })
  })

  // ── POST: PHI audit ─────────────────────────────────────────────────────────

  describe('POST - PHI audit', () => {
    it('calls logPhiAccess on every send', async () => {
      mockDbInsert.mockReturnValue(makeInsertChain([SAVED_MESSAGE]))
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
      mockDbUpdate.mockReturnValue(makeUpdateChain())
      const { PATCH } = await import('../route')
      const res = await PATCH(makePatchRequest({
        threadId: 'thread-uuid-abc',
        readerId: 'patient-uuid-123',
      }))
      expect(res.status).toBe(200)
      const resBody = await res.json()
      expect(resBody).toEqual({ success: true })
    })

    it('calls db.update to mark messages read', async () => {
      mockDbUpdate.mockReturnValue(makeUpdateChain())

      const { PATCH } = await import('../route')
      await PATCH(makePatchRequest({
        threadId: 'thread-uuid-abc',
        readerId: 'patient-uuid-123',
      }))

      expect(mockDbUpdate).toHaveBeenCalled()
    })
  })

  // ── GET: threads and messages ───────────────────────────────────────────────

  describe('GET - threads by patientId', () => {
    it('returns a threads array', async () => {
      mockDbSelect.mockReturnValue(makeSelectChain([SAVED_MESSAGE]))
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
      let selectCallCount = 0
      mockDbSelect.mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) return makeSelectChain([SAVED_MESSAGE])
        return makeSelectChain([]) // patient name lookup
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
