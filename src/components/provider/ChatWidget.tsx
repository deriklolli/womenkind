'use client'

import { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatWidgetProps {
  /** Current page context passed from the provider page */
  context?: {
    page: string
    patientId?: string
    patientName?: string
    intakeId?: string
    intakeStatus?: string
  }
}

export default function ChatWidget({ context }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context,
        }),
      })

      const data = await res.json()

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response || 'Sorry, something went wrong.' },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't process that request." },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-violet text-white shadow-lg shadow-violet/25 hover:shadow-xl hover:shadow-violet/40 hover:scale-105 transition-all duration-200 flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-aubergine/10 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-aubergine/5 bg-aubergine">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-violet/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-sans font-medium text-white">Womenkind AI</p>
                {context?.patientName && (
                  <p className="text-[11px] font-sans text-white/50">
                    Viewing: {context.patientName}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white/70 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-full bg-violet/5 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <p className="text-sm font-sans font-medium text-aubergine mb-1">
                  How can I help?
                </p>
                <p className="text-xs font-sans text-aubergine/40 leading-relaxed">
                  Ask me questions about your patients, request changes to risk flags, notes, or treatment plans, or get clinical guidance.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-sans leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-violet text-white rounded-br-md'
                      : 'bg-aubergine/[0.03] text-aubergine border border-aubergine/5 rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-aubergine/[0.03] border border-aubergine/5 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-violet/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-aubergine/5 px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                className="flex-1 resize-none text-sm font-sans text-aubergine placeholder:text-aubergine/30 bg-aubergine/[0.02] border border-aubergine/8 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-violet/30 focus:ring-1 focus:ring-violet/10 transition-colors"
                style={{ maxHeight: '80px' }}
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 80) + 'px'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-violet text-white flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:bg-violet-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
