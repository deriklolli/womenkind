import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { messages, notifications, patients, providers, profiles } from '@/lib/db/schema'
import { eq, and, or, isNull, asc, desc, inArray } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'
import { logPhiAccess } from '@/lib/phi-audit'

/**
 * GET /api/messages?patientId=xxx  — patient's threads
 * GET /api/messages?providerId=xxx — provider's inbox
 * GET /api/messages?threadId=xxx   — single thread
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = req.nextUrl.searchParams.get('patientId')
    const providerId = req.nextUrl.searchParams.get('providerId')
    const threadId = req.nextUrl.searchParams.get('threadId')

    if (session.role === 'patient' && patientId && patientId !== session.patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (threadId) {
      // Get all messages in a thread
      const data = await db
        .select()
        .from(messages)
        .where(eq(messages.thread_id, threadId))
        .orderBy(asc(messages.created_at))

      const isParticipant =
        session.role === 'provider' ||
        data.some(m =>
          session.role === 'patient' &&
          (m.sender_id === session.patientId || m.recipient_id === session.patientId)
        )
      if (!isParticipant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      // Look up names for all patient senders in this thread
      // sender_id on messages is patients.id (not the auth user id), so join through patients table
      const patientSenderIds = Array.from(new Set(
        data.filter(m => m.sender_type === 'patient').map(m => m.sender_id)
      ))
      const nameMap = new Map<string, string>()
      if (patientSenderIds.length > 0) {
        const patientRows = await db
          .select({ id: patients.id, first_name: profiles.first_name, last_name: profiles.last_name })
          .from(patients)
          .innerJoin(profiles, eq(patients.profile_id, profiles.id))
          .where(inArray(patients.id, patientSenderIds))
        for (const p of patientRows) {
          nameMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Patient')
        }
      }

      const msgList = data.map(msg => ({
        ...msg,
        senderName: msg.sender_type === 'patient' ? (nameMap.get(msg.sender_id) || 'Patient') : null,
      }))

      return NextResponse.json({ messages: msgList })
    }

    // Get thread summaries (latest message per thread)
    let conditions: ReturnType<typeof or>[] = []
    if (patientId) {
      conditions.push(or(eq(messages.sender_id, patientId), eq(messages.recipient_id, patientId))!)
    }
    if (providerId) {
      conditions.push(or(eq(messages.sender_id, providerId), eq(messages.recipient_id, providerId))!)
    }

    const data = await db
      .select()
      .from(messages)
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(messages.created_at))

    // Group by thread_id and take the latest message per thread
    // Also track the original patient sender per thread (independent of who sent last)
    const threadMap = new Map<string, typeof data[0]>()
    const unreadCounts = new Map<string, number>()
    const threadPatientSenderId = new Map<string, string>()

    for (const msg of data) {
      if (!threadMap.has(msg.thread_id)) {
        threadMap.set(msg.thread_id, msg)
        unreadCounts.set(msg.thread_id, 0)
      }
      // Track the patient who started (or participates in) this thread
      if (msg.sender_type === 'patient' && !threadPatientSenderId.has(msg.thread_id)) {
        threadPatientSenderId.set(msg.thread_id, msg.sender_id)
      }
      // Count unread messages for the requesting user
      const isRecipient = (patientId && msg.recipient_id === patientId) ||
                          (providerId && msg.recipient_id === providerId)
      if (isRecipient && !msg.read_at) {
        unreadCounts.set(msg.thread_id, (unreadCounts.get(msg.thread_id) || 0) + 1)
      }
    }

    const threads = Array.from(threadMap.values()).map(msg => ({
      ...msg,
      unreadCount: unreadCounts.get(msg.thread_id) || 0,
      patientSenderId: threadPatientSenderId.get(msg.thread_id) || null,
    }))

    // For provider inbox: look up patient names using the original patient sender
    // (not the latest message sender — doctor replies would otherwise lose the name)
    if (providerId) {
      const allPatientIds = Array.from(new Set(
        threads.map(t => t.patientSenderId).filter(Boolean) as string[]
      ))
      if (allPatientIds.length > 0) {
        // sender_id on messages is patients.id (not the auth user id), so join through patients table
        const patientRows = await db
          .select({ id: patients.id, first_name: profiles.first_name, last_name: profiles.last_name })
          .from(patients)
          .innerJoin(profiles, eq(patients.profile_id, profiles.id))
          .where(inArray(patients.id, allPatientIds))
        const nameMap = new Map<string, string>()
        for (const p of patientRows) {
          nameMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Patient')
        }
        threads.forEach(t => {
          if (t.patientSenderId) {
            (t as any).senderName = nameMap.get(t.patientSenderId) || 'Patient'
          }
        })
      }
    }

    return NextResponse.json({ threads })
  } catch (err: any) {
    console.error('Failed to fetch messages:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/messages
 * Send a new message (creates a thread if threadId not provided).
 * Body: { senderId, senderType, recipientId, subject?, body, threadId? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'patient' && session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { recipientId, subject, body, threadId } = await req.json()

    const senderId = session.role === 'provider' ? session.providerId! : session.patientId!
    const senderType = session.role === 'provider' ? 'provider' : 'patient'

    if (!recipientId || !body) {
      return NextResponse.json(
        { error: 'recipientId and body are required' },
        { status: 400 }
      )
    }

    const actualThreadId = threadId || crypto.randomUUID()

    const [data] = await db
      .insert(messages)
      .values({
        thread_id: actualThreadId,
        sender_type: senderType,
        sender_id: senderId,
        recipient_id: recipientId,
        subject: subject || null,
        body,
      })
      .returning()

    if (!data) throw new Error('Failed to insert message')

    // Create a notification for the recipient when a provider sends a message
    if (senderType === 'provider') {
      // Look up the provider's name for a personalised notification title
      let senderName = 'Your provider'
      const providerRow = await db
        .select({ first_name: profiles.first_name, last_name: profiles.last_name })
        .from(providers)
        .innerJoin(profiles, eq(providers.profile_id, profiles.id))
        .where(eq(providers.id, senderId))
        .limit(1)
      if (providerRow[0]) {
        const { first_name, last_name } = providerRow[0]
        const fullName = `${first_name || ''} ${last_name || ''}`.trim()
        if (fullName) senderName = `Dr. ${last_name || fullName}`
      }

      await db.insert(notifications).values({
        patient_id: recipientId,
        type: 'new_message',
        title: `New message from ${senderName}`,
        body: body.length > 80 ? body.slice(0, 80) + '…' : body,
        link_view: 'message',
        is_read: false,
        dismissed: false,
      })
    }

    const senderId_ = senderType === 'provider' ? senderId : null
    const patientId_ = senderType === 'patient' ? senderId : recipientId
    logPhiAccess({ providerId: senderId_, patientId: patientId_, recordType: 'message', recordId: data.id, action: 'create', route: '/api/messages', req })

    return NextResponse.json({ message: data, threadId: actualThreadId })
  } catch (err: any) {
    console.error('Failed to send message:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/messages
 * Mark messages as read.
 * Body: { threadId, readerId }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { threadId } = await req.json()
    const readerId = session.role === 'provider' ? session.providerId! : session.patientId!

    if (!threadId || !readerId) {
      return NextResponse.json({ error: 'threadId and readerId are required' }, { status: 400 })
    }

    await db
      .update(messages)
      .set({ read_at: new Date() })
      .where(and(
        eq(messages.thread_id, threadId),
        eq(messages.recipient_id, readerId),
        isNull(messages.read_at),
      ))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Failed to mark messages read:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
