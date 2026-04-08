'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  id: string
  thread_id: string
  sender_type: 'patient' | 'provider'
  sender_id: string
  recipient_id: string
  subject: string | null
  body: string
  read_at: string | null
  created_at: string
}

interface Thread {
  id: string
  thread_id: string
  sender_type: 'patient' | 'provider'
  body: string
  created_at: string
  unreadCount: number
}

interface Props {
  patientId: string
  providerId: string
  patientName: string
}

export default function PatientMessagesPanel({ patientId, providerId, patientName }: Props) {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversation()
  }, [patientId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversation = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/messages?patientId=${patientId}`)
      const data = await res.json()
      const threads: Thread[] = data.threads || []

      if (threads.length === 0) {
        setLoading(false)
        return
      }

      const latest = threads[0]
      setThreadId(latest.thread_id)
      await loadMessages(latest.thread_id)

      // Mark as read for provider
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: latest.thread_id, readerId: providerId }),
      })
    } catch (err) {
      console.error('Failed to load conversation:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (tid: string) => {
    const res = await fetch(`/api/messages?threadId=${tid}`)
    const data = await res.json()
    setMessages(data.messages || [])
  }

  const handleSend = async () => {
    if (!replyBody.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: providerId,
          senderType: 'provider',
          recipientId: patientId,
          body: replyBody.trim(),
          threadId: threadId ?? undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const newThreadId = data.threadId
        if (!threadId) setThreadId(newThreadId)
        setReplyBody('')
        await loadMessages(newThreadId)
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5">
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-card shadow-sm border border-aubergine/5">
      <div className="px-6 py-4 border-b border-aubergine/5">
        <h3 className="text-sm font-sans font-medium text-aubergine flex items-center gap-2">
          <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Messages with {patientName}
        </h3>
      </div>

      {/* Thread */}
      <div className="p-6">
        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 mb-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-10 h-10 text-aubergine/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p className="text-sm font-sans text-aubergine/30">No messages yet</p>
              <p className="text-xs font-sans text-aubergine/20 mt-1">Send a message to start the conversation</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isProvider = msg.sender_type === 'provider'
              return (
                <div key={msg.id} className={`flex ${isProvider ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                    isProvider
                      ? 'bg-violet/10 text-aubergine'
                      : 'bg-cream border border-aubergine/5 text-aubergine'
                  }`}>
                    <p className="text-[11px] font-sans font-medium mb-1 opacity-50">
                      {isProvider ? 'You' : patientName}
                    </p>
                    <p className="text-sm font-sans leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <p className="text-[10px] font-sans opacity-30 mt-1.5 text-right">
                      {formatFullDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply box */}
        <div className="flex gap-2 pt-4 border-t border-aubergine/5">
          <input
            type="text"
            placeholder={`Message ${patientName}...`}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            className="flex-1 px-4 py-2.5 rounded-full border border-aubergine/10 bg-cream text-sm font-sans text-aubergine placeholder:text-aubergine/30 focus:outline-none focus:border-violet/30 focus:ring-2 focus:ring-violet/10"
          />
          <button
            onClick={handleSend}
            disabled={!replyBody.trim() || sending}
            className="px-5 py-2.5 rounded-full text-xs font-sans font-semibold bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
