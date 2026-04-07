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
  providerId: string
  patientName: string
}

export default function PatientMessagesPanel({ patientId, providerId, patientName }: Props) {
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
    fetchThreads()
  }, [patientId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages])

  const fetchThreads = async () => {
    try {
      // Fetch threads involving this patient — use patientId param
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

      // Mark as read for provider
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, readerId: providerId }),
      })

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
          senderId: providerId,
          senderType: 'provider',
          recipientId: patientId,
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
          senderId: providerId,
          senderType: 'provider',
          recipientId: patientId,
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
      <div className="text-center py-20">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin mx-auto" />
        <p className="text-sm font-sans text-aubergine/40 mt-4">Loading messages...</p>
      </div>
    )
  }

  // Compose new message
  if (composing) {
    return (
      <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-sans font-medium text-aubergine flex items-center gap-2">
            <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            New Message to {patientName}
          </h3>
          <button
            onClick={() => setComposing(false)}
            className="text-xs font-sans text-aubergine/40 hover:text-aubergine transition-colors"
          >
            Cancel
          </button>
        </div>

        <input
          type="text"
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-aubergine/10 bg-cream text-sm font-sans text-aubergine placeholder:text-aubergine/30 focus:outline-none focus:border-violet/30 focus:ring-2 focus:ring-violet/10 mb-3"
        />

        <textarea
          placeholder={`Type your message to ${patientName}...`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 rounded-xl border border-aubergine/10 bg-cream text-sm font-sans text-aubergine placeholder:text-aubergine/30 focus:outline-none focus:border-violet/30 focus:ring-2 focus:ring-violet/10 resize-none mb-4"
        />

        <div className="flex justify-end">
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

  // Thread detail
  if (selectedThread) {
    const thread = threads.find(t => t.thread_id === selectedThread)

    return (
      <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => { setSelectedThread(null); setReplyBody('') }}
            className="text-sm font-sans text-aubergine/40 hover:text-aubergine transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All Messages
          </button>
        </div>

        {thread?.subject && (
          <h3 className="font-sans font-semibold text-lg text-aubergine mb-4">{thread.subject}</h3>
        )}

        {threadLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 mb-4">
            {threadMessages.map((msg) => {
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
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Reply box */}
        <div className="flex gap-2 pt-4 border-t border-aubergine/5">
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
            className="px-5 py-2.5 rounded-full text-xs font-sans font-semibold bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Reply'}
          </button>
        </div>
      </div>
    )
  }

  // Thread list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-sans text-aubergine/40">
            {threads.length === 0
              ? 'No messages with this patient'
              : `${threads.length} conversation${threads.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setComposing(true)}
          className="px-4 py-2 rounded-full text-xs font-sans font-semibold bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-all"
        >
          New Message
        </button>
      </div>

      {threads.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-card shadow-sm">
          <svg className="w-10 h-10 text-aubergine/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <p className="text-lg font-sans font-semibold text-aubergine/30">No messages yet</p>
          <p className="text-sm font-sans text-aubergine/20 mt-2">Start a conversation with {patientName}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <button
              key={thread.thread_id}
              onClick={() => openThread(thread.thread_id)}
              className="w-full bg-white rounded-card p-5 shadow-sm hover:shadow-md
                         border border-transparent hover:border-violet/10
                         transition-all duration-200 text-left group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-sans font-medium text-aubergine group-hover:text-violet transition-colors truncate">
                      {thread.subject || (thread.sender_type === 'patient' ? `Message from ${patientName}` : `Message to ${patientName}`)}
                    </p>
                    {thread.unreadCount > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-sans font-semibold flex items-center justify-center">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-sans text-aubergine/40 truncate">
                    {thread.sender_type === 'patient' ? `${patientName}: ` : 'You: '}{thread.body}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-sans text-aubergine/30">{formatTime(thread.created_at)}</span>
                  <svg className="w-4 h-4 text-aubergine/20 group-hover:text-violet transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
