import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/messages?patientId=xxx  — patient's threads
 * GET /api/messages?providerId=xxx — provider's inbox
 * GET /api/messages?threadId=xxx   — single thread
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const patientId = req.nextUrl.searchParams.get('patientId')
    const providerId = req.nextUrl.searchParams.get('providerId')
    const threadId = req.nextUrl.searchParams.get('threadId')

    if (threadId) {
      // Get all messages in a thread
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Look up names for all patient senders in this thread
      const patientSenderIds = [...new Set(
        (data || []).filter(m => m.sender_type === 'patient').map(m => m.sender_id)
      )]
      const nameMap = new Map<string, string>()
      if (patientSenderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', patientSenderIds)
        for (const p of profiles || []) {
          nameMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim())
        }
      }

      const messages = (data || []).map(msg => ({
        ...msg,
        senderName: msg.sender_type === 'patient' ? (nameMap.get(msg.sender_id) || 'Patient') : null,
      }))

      return NextResponse.json({ messages })
    }

    // Get thread summaries (latest message per thread)
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (patientId) {
      query = query.or(`sender_id.eq.${patientId},recipient_id.eq.${patientId}`)
    }
    if (providerId) {
      query = query.or(`sender_id.eq.${providerId},recipient_id.eq.${providerId}`)
    }

    const { data, error } = await query
    if (error) throw error

    // Group by thread_id and take the latest message per thread
    const threadMap = new Map<string, any>()
    const unreadCounts = new Map<string, number>()

    for (const msg of data || []) {
      if (!threadMap.has(msg.thread_id)) {
        threadMap.set(msg.thread_id, msg)
        unreadCounts.set(msg.thread_id, 0)
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
    }))

    // For provider inbox: look up patient names for all patient-originated threads
    if (providerId) {
      const patientSenderIds = [...new Set(
        threads.filter(t => t.sender_type === 'patient').map(t => t.sender_id)
      )]
      if (patientSenderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', patientSenderIds)
        const nameMap = new Map<string, string>()
        for (const p of profiles || []) {
          nameMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim())
        }
        threads.forEach(t => {
          if (t.sender_type === 'patient') {
            t.senderName = nameMap.get(t.sender_id) || 'Patient'
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
    const supabase = getServiceSupabase()
    const { senderId, senderType, recipientId, subject, body, threadId } = await req.json()

    if (!senderId || !senderType || !recipientId || !body) {
      return NextResponse.json(
        { error: 'senderId, senderType, recipientId, and body are required' },
        { status: 400 }
      )
    }

    const actualThreadId = threadId || crypto.randomUUID()

    const { data, error } = await supabase
      .from('messages')
      .insert({
        thread_id: actualThreadId,
        sender_type: senderType,
        sender_id: senderId,
        recipient_id: recipientId,
        subject: subject || null,
        body,
      })
      .select()
      .single()

    if (error) throw error

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
    const supabase = getServiceSupabase()
    const { threadId, readerId } = await req.json()

    if (!threadId || !readerId) {
      return NextResponse.json({ error: 'threadId and readerId are required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('thread_id', threadId)
      .eq('recipient_id', readerId)
      .is('read_at', null)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Failed to mark messages read:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
