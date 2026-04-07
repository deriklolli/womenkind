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
  providerId: string
  onCountChange?: (count: number) => void
}

export default function ProviderMessagesInbox({ providerId, onCountChange }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchThreads()
  }, [providerId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages])

  const fetchThreads = async () => {
    try {
      const res = await fetch(`/api/messages?providerId=${providerId}`)
      const data = await res.json()
      const threadList = data.threads || []
      setThreads(threadList)
      const unread = threadList.reduce((sum: number, t: Thread) => sum + (t.unreadCount || 0), 0)
      onCountChange?.(unread)
    } catch (err) {
      console.error('Failed to fetch threads:', err)
    } finally {
      setLoading(false)
    }
  }

  const openThread = async (threadId: string) => {
    setSelectedThread(threadId)
    setThreadLoading(true)
    try {
      const res = await fetch(`/api/messages?threadId=${threadId}`)
      const data = await res.json()
      setThreadMessages(data.messages || [])

      // Mark as read
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, readerId: providerId }),
      })

      setThreads(prev => prev.map(t =>
        t.thread_id === threadId ? { ...t, unreadCount: 0 } : t
      ))
      // Update parent count
      const newUnread = threads.reduce((sum, t) =>
        sum + (t.thread_id === threadId ? 0 : (t.unreadCount || 0)), 0
      )
      onCountChange?.(newUnread)
    } catch (err) {
      console.error('Failed to load thread:', err)
    } finally {
      setThreadLoading(false)
    }
  }

  const handleReply = async () => {
    if (!replyBody.trim() || !selectedThread) return
    // Find the original sender to reply to
    const thread = threads.find(t => t.thread_id === selectedThread)
    const recipientId = thread?.sender_type === 'patient' ? thread.sender_id : thread?.recipient_id
    if (!recipientId) return

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: providerId,
          senderType: 'provider',
          recipientId,
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
      <div className="text-center py-20">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin mx-auto" />
        <p className="text-sm font-sans text-aubergine/40 mt-4">Loading messages...</p>
      </div>
    )
  }

  // Thread detail view
  if (selectedThread) {
    const thread = threads.find(t => t.thread_id === selectedThread)

    return (
      <>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setSelectedThread(null); setReplyBody('') }}
            className="text-sm font-sans text-aubergine/40 hover:text-aubergine transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Messages
          </button>
        </div>

        <div className="bg-white rounded-card shadow-sm p-6">
          {thread?.subject && (
            <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">{thread.subject}</h2>
          )}

          {threadLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 mb-4">
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
                        {isProvider ? 'You' : 'Patient'}
                      </p>
                      <p className="text-sm font-sans leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                      <p className="text-[10px] font-sans opacity-30 mt-1.5 text-right">
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
      </>
    )
  }

  // Thread list view
  return (
    <>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-sans font-semibold text-2xl text-aubergine tracking-tight">Messages</h1>
          <p className="text-sm font-sans text-aubergine/50 mt-1">
            {threads.length === 0
              ? 'No messages yet'
              : `${threads.length} conversation${threads.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-card shadow-sm">
          <p className="text-lg font-sans font-semibold text-aubergine/30">No messages</p>
          <p className="text-sm font-sans text-aubergine/20 mt-2">
            Patient messages will appear here
          </p>
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
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-violet/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-sans font-medium text-aubergine group-hover:text-violet transition-colors truncate">
                        {thread.subject || 'Message from Patient'}
                      </p>
                      {thread.unreadCount > 0 && (
                        <span className="shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-sans font-semibold flex items-center justify-center">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-sans text-aubergine/40 truncate">
                      {thread.sender_type === 'patient' ? 'Patient: ' : 'You: '}{thread.body}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-sans text-aubergine/30">
                    {formatTime(thread.created_at)}
                  </span>
                  <svg className="w-5 h-5 text-aubergine/20 group-hover:text-violet transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
