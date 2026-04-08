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
  senderName?: string
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
  senderName?: string
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
    if (selectedThread === threadId) return
    setSelectedThread(threadId)
    setThreadLoading(true)
    setThreadMessages([])
    setReplyBody('')
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

  const activeThread = threads.find(t => t.thread_id === selectedThread)

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-sans font-semibold text-3xl text-aubergine tracking-tight">Messages</h1>
          <p className="text-sm font-sans text-aubergine/50 mt-1">
            {loading ? '' : threads.length === 0
              ? 'No messages yet'
              : `${threads.length} conversation${threads.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-card shadow-sm">
          <p className="text-lg font-sans font-semibold text-aubergine/30">No messages</p>
          <p className="text-sm font-sans text-aubergine/20 mt-2">Patient messages will appear here</p>
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[500px]">

          {/* Left — thread list */}
          <div className="w-72 flex-shrink-0 flex flex-col bg-white rounded-card shadow-sm overflow-hidden">
            <div className="flex-1 overflow-y-auto divide-y divide-aubergine/5">
              {threads.map((thread) => {
                const isSelected = thread.thread_id === selectedThread
                const senderLabel = thread.sender_type === 'patient'
                  ? (thread.senderName || 'Patient')
                  : 'You'

                return (
                  <button
                    key={thread.thread_id}
                    onClick={() => openThread(thread.thread_id)}
                    className={`w-full text-left px-4 py-4 transition-colors ${
                      isSelected
                        ? 'bg-violet/5 border-l-2 border-violet'
                        : 'hover:bg-aubergine/3 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`text-sm font-sans font-semibold truncate leading-tight ${
                        isSelected ? 'text-violet' : 'text-aubergine'
                      }`}>
                        {thread.sender_type === 'patient'
                          ? (thread.senderName || 'Patient')
                          : 'Dr. Urban'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {thread.unreadCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-sans font-bold flex items-center justify-center">
                            {thread.unreadCount}
                          </span>
                        )}
                        <span className="text-[10px] font-sans text-aubergine/30">
                          {formatTime(thread.created_at)}
                        </span>
                      </div>
                    </div>
                    {thread.subject && (
                      <p className="text-xs font-sans font-medium text-aubergine/60 truncate mb-0.5">
                        {thread.subject}
                      </p>
                    )}
                    <p className="text-xs font-sans text-aubergine/35 truncate">
                      {senderLabel}: {thread.body}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right — thread detail */}
          <div className="flex-1 flex flex-col bg-white rounded-card shadow-sm overflow-hidden">
            {!selectedThread ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-10 h-10 text-aubergine/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <p className="text-sm font-sans text-aubergine/30">Select a conversation</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-6 py-4 border-b border-aubergine/8 flex-shrink-0">
                  <p className="text-sm font-sans font-semibold text-aubergine">
                    {activeThread?.sender_type === 'patient'
                      ? (activeThread?.senderName || 'Patient')
                      : 'Dr. Urban'}
                  </p>
                  {activeThread?.subject && (
                    <p className="text-xs font-sans text-aubergine/40 mt-0.5">{activeThread.subject}</p>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {threadLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
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
                                {isProvider ? 'You' : (msg.senderName || 'Patient')}
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
                    </>
                  )}
                </div>

                {/* Reply box */}
                <div className="px-6 py-4 border-t border-aubergine/8 flex-shrink-0 flex gap-2">
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
              </>
            )}
          </div>

        </div>
      )}
    </>
  )
}
