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
  thread_id: string
  sender_type: 'patient' | 'provider'
  sender_id: string
  recipient_id: string
  body: string
  read_at: string | null
  created_at: string
  unreadCount: number
}

interface Props {
  patientId: string
  providerId: string
}

export default function PatientMessages({ patientId, providerId }: Props) {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!patientId) return
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

      // Use the most recent thread as the single conversation
      const latest = threads[0]
      setThreadId(latest.thread_id)
      await loadMessages(latest.thread_id)

      // Mark as read
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: latest.thread_id, readerId: patientId }),
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
          senderId: patientId,
          senderType: 'patient',
          recipientId: providerId,
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

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1" style={{ maxHeight: '420px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-violet/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-violet/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm font-sans text-aubergine/50">No messages yet</p>
            <p className="text-xs font-sans text-aubergine/30 mt-1">Send a message to Dr. Urban to get started</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_type === 'patient'
            return (
              <div key={msg.id} className={`flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                {isMe ? (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-violet/15 flex items-center justify-center">
                    <span className="text-[11px] font-sans font-semibold text-violet">DL</span>
                  </div>
                ) : (
                  <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-aubergine/10">
                    <img
                      src="/dr-urban.jpg"
                      alt="Dr. Urban"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = 'none'
                        target.parentElement!.innerHTML = '<span class="text-[11px] font-sans font-semibold text-aubergine/60 flex items-center justify-center w-full h-full">JU</span>'
                      }}
                    />
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[75%] px-4 py-3 ${
                  isMe
                    ? 'bg-violet/10 text-aubergine rounded-2xl rounded-br-md'
                    : 'bg-cream border border-aubergine/5 text-aubergine rounded-2xl rounded-bl-md'
                }`}>
                  <p className="text-sm font-sans leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-[10px] font-sans opacity-30 mt-1.5 ${isMe ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      <div className="flex gap-2 pt-3 border-t border-aubergine/5">
        <input
          ref={inputRef}
          type="text"
          placeholder="Message Dr. Urban..."
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          className="flex-1 px-4 py-2.5 rounded-full border border-aubergine/10 bg-cream text-sm font-sans text-aubergine placeholder:text-aubergine/30 focus:outline-none focus:border-violet/30 focus:ring-2 focus:ring-violet/10"
        />
        <button
          onClick={handleSend}
          disabled={!replyBody.trim() || sending}
          className="px-4 py-2.5 rounded-full bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
