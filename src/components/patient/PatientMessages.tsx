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
  sender_id: string
  recipient_id: string
  subject: string | null
  body: string
  read_at: string | null
  created_at: string
  unreadCount: number
}

interface Props {
  patientId: string
}

const PROVIDER_ID = 'b0000000-0000-0000-0000-000000000001'

export default function PatientMessages({ patientId }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [composing, setComposing] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!patientId) return
    fetchThreads()
  }, [patientId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages])

  const fetchThreads = async () => {
    try {
      const res = await fetch(`/api/messages?patientId=${patientId}`)
      const data = await res.json()
      setThreads(data.threads || [])
    } catch (err) {
      console.error('Failed to fetch threads:', err)
    } finally {
      setLoading(false)
    }
  }

  const openThread = async (threadId: string) => {
    setSelectedThread(threadId)
    setComposing(false)
    setThreadLoading(true)
    try {
      const res = await fetch(`/api/messages?threadId=${threadId}`)
      const data = await res.json()
      setThreadMessages(data.messages || [])

      // Mark as read
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, readerId: patientId }),
      })

      // Update unread count in thread list
      setThreads(prev => prev.map(t =>
        t.thread_id === threadId ? { ...t, unreadCount: 0 } : t
      ))
    } catch (err) {
      console.error('Failed to load thread:', err)
    } finally {
      setThreadLoading(false)
    }
  }

  const handleSendNew = async () => {
    if (!body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: patientId,
          senderType: 'patient',
          recipientId: PROVIDER_ID,
          subject: subject.trim() || null,
          body: body.trim(),
        }),
      })
      if (res.ok) {
        setSubject('')
        setBody('')
        setComposing(false)
        await fetchThreads()
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleReply = async () => {
    if (!replyBody.trim() || !selectedThread) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: patientId,
          senderType: 'patient',
          recipientId: PROVIDER_ID,
          body: replyBody.trim(),
          threadId: selectedThread,
        }),
      })
      if (res.ok) {
        setReplyBody('')
        await openThread(selectedThread)
        await fetchThreads()
      }
    } catch (err) {
      console.error('Failed to send reply:', err)
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

  // Compose new message view
  if (composing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setComposing(false)}
            className="text-xs font-sans text-aubergine/40 hover:text-aubergine transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to messages
          </button>
        </div>

        <input
          type="text"
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-aubergine/10 bg-cream text-sm font-sans text-aubergine placeholder:text-aubergine/30 focus:outline-none focus:border-violet/30 focus:ring-2 focus:ring-violet/10"
        />

        <textarea
          placeholder="Type your message to Dr. Urban..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full px-4 py-3 rounded-xl border border-aubergine/10 bg-cream text-sm font-sans text-aubergine placeholder:text-aubergine/30 focus:outline-none focus:border-violet/30 focus:ring-2 focus:ring-violet/10 resize-none"
        />

        <div className="flex items-center justify-between">
          <p className="text-[11px] font-sans text-aubergine/30">
            You will receive a response within 1-2 business days.
          </p>
          <button
            onClick={handleSendNew}
            disabled={!body.trim() || sending}
            className="px-5 py-2.5 rounded-full text-xs font-sans font-semibold bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    )
  }

  // Thread detail view
  if (selectedThread) {
    const thread = threads.find(t => t.thread_id === selectedThread)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => { setSelectedThread(null); setReplyBody('') }}
            className="text-xs font-sans text-aubergine/40 hover:text-aubergine transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to messages
          </button>
        </div>

        {thread?.subject && (
          <p className="text-sm font-sans font-medium text-aubergine">{thread.subject}</p>
        )}

        {threadLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {threadMessages.map((msg) => {
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

                  {/* Message bubble */}
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
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Reply box */}
        <div className="flex gap-2 pt-2 border-t border-aubergine/5">
          <input
            type="text"
            placeholder="Type a reply..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
            className="flex-1 px-4 py-2.5 rounded-full border border-aubergine/10 bg-cream text-sm font-sans text-aubergine placeholder:text-aubergine/30 focus:outline-none focus:border-violet/30 focus:ring-2 focus:ring-violet/10"
          />
          <button
            onClick={handleReply}
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

  // Thread list view (inbox)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-sans text-aubergine/35">
          {threads.length === 0 ? 'No messages yet' : `${threads.length} conversation${threads.length > 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => setComposing(true)}
          className="px-4 py-2 rounded-full text-xs font-sans font-semibold bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-all"
        >
          New Message
        </button>
      </div>

      {threads.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-10 h-10 text-aubergine/15 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <p className="text-sm font-sans text-aubergine/40">No messages yet</p>
          <p className="text-xs font-sans text-aubergine/25 mt-1">Send a message to Dr. Urban to get started</p>
        </div>
      ) : (
        threads.map((thread) => (
          <button
            key={thread.thread_id}
            onClick={() => openThread(thread.thread_id)}
            className="w-full text-left p-4 rounded-xl bg-cream border border-aubergine/5 hover:border-violet/15 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-sans font-medium text-aubergine truncate">
                    {thread.subject || (thread.sender_type === 'patient' ? 'Message to Dr. Urban' : 'Message from Dr. Urban')}
                  </p>
                  {thread.unreadCount > 0 && (
                    <span className="shrink-0 w-5 h-5 rounded-full bg-violet text-white text-[10px] font-sans font-semibold flex items-center justify-center">
                      {thread.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs font-sans text-aubergine/40 mt-0.5 truncate">
                  {thread.sender_type === 'patient' ? 'You: ' : 'Dr. Urban: '}{thread.body}
                </p>
              </div>
              <span className="text-[10px] font-sans text-aubergine/30 shrink-0 mt-0.5">
                {formatTime(thread.created_at)}
              </span>
            </div>
          </button>
        ))
      )}
    </div>
  )
}
