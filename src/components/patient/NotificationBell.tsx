'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { DashboardView } from './QuickActions'

interface Notification {
  id: string
  type: 'rx_refill_approved' | 'new_message' | 'new_blueprint' | 'lab_results_ready'
  title: string
  body: string | null
  link_view: string
  is_read: boolean
  dismissed: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, { icon: JSX.Element; color: string }> = {
  rx_refill_approved: {
    color: 'text-emerald-500 bg-emerald-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  new_message: {
    color: 'text-violet bg-violet/10',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  new_blueprint: {
    color: 'text-violet bg-violet/10',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  lab_results_ready: {
    color: 'text-amber-500 bg-amber-50',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationBell({
  patientId,
  onNavigate,
}: {
  patientId: string
  onNavigate: (view: DashboardView) => void
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?patientId=${patientId}`)
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }, [patientId])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_read: true }),
    })
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  const dismiss = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dismissed: true }),
    })
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, markAllRead: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const handleClick = (n: Notification) => {
    markRead(n.id)
    setOpen(false)
    onNavigate(n.link_view as DashboardView)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-aubergine/5 transition-colors"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg
          className="w-5 h-5 text-aubergine/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-card shadow-xl shadow-aubergine/10 border border-aubergine/10 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-aubergine/5 flex items-center justify-between">
            <span className="text-sm font-sans font-medium text-aubergine">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-sans text-violet hover:text-violet/80 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-sans text-aubergine/30">
                  No notifications
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const typeConfig = TYPE_ICONS[n.type] || TYPE_ICONS.new_message
                return (
                  <div
                    key={n.id}
                    className={`group flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-violet/5 transition-colors border-b border-aubergine/[0.03] last:border-b-0 ${
                      !n.is_read ? 'bg-violet/[0.02]' : ''
                    }`}
                    onClick={() => handleClick(n)}
                  >
                    {/* Type icon */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${typeConfig.color}`}
                    >
                      {typeConfig.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-sans leading-snug ${
                          !n.is_read
                            ? 'font-medium text-aubergine'
                            : 'text-aubergine/70'
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs font-sans text-aubergine/40 mt-0.5 truncate">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[11px] font-sans text-aubergine/30 mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>

                    {/* Unread dot + dismiss */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-violet" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dismiss(n.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-aubergine/5 transition-all"
                        aria-label="Dismiss"
                      >
                        <svg
                          className="w-3.5 h-3.5 text-aubergine/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
