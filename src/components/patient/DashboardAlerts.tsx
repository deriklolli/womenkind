'use client'

import { useState, useEffect } from 'react'
import type { DashboardView } from './QuickActions'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link_view: string
  is_read: boolean
  created_at: string
}

const ALERT_TYPES = ['new_blueprint', 'lab_results_ready'] as const

export default function DashboardAlerts({
  patientId,
  onNavigate,
}: {
  patientId: string
  onNavigate: (view: DashboardView) => void
}) {
  const [alerts, setAlerts] = useState<Notification[]>([])

  useEffect(() => {
    async function fetch_alerts() {
      try {
        const res = await fetch(`/api/notifications?patientId=${patientId}`)
        const data = await res.json()
        const relevant = (data.notifications || []).filter(
          (n: Notification) => ALERT_TYPES.includes(n.type as any) && !n.is_read
        )
        setAlerts(relevant)
      } catch (err) {
        console.error('Failed to fetch dashboard alerts:', err)
      }
    }
    fetch_alerts()
  }, [patientId])

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_read: true }),
    })
    setAlerts((prev) => prev.filter((n) => n.id !== id))
  }

  if (alerts.length === 0) return null

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const isBlueprint = alert.type === 'new_blueprint'

        if (isBlueprint) {
          return (
            <div
              key={alert.id}
              className="relative rounded-card overflow-hidden cursor-pointer group"
              style={{ minHeight: '160px' }}
              onClick={() => {
                markRead(alert.id)
                onNavigate(alert.link_view as DashboardView)
              }}
            >
              {/* Background image */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: 'url(/care-presentation-bg.png)' }}
              />
              {/* Gradient overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to right, rgba(26, 9, 48, 0.88) 0%, rgba(26, 9, 48, 0.65) 50%, rgba(26, 9, 48, 0.25) 100%)',
                }}
              />
              {/* Content */}
              <div className="relative z-10 flex flex-col justify-end h-full p-6 md:p-8" style={{ minHeight: '160px' }}>
                <p className="font-serif text-xl md:text-2xl text-white leading-tight mb-2">
                  {alert.title}
                </p>
                {alert.body && (
                  <p className="text-sm font-sans text-white/60 leading-relaxed mb-4 max-w-md">
                    {alert.body}
                  </p>
                )}
                <div>
                  <span className="inline-flex items-center gap-2 text-sm font-sans font-medium text-white bg-violet hover:bg-violet/90 rounded-full px-5 py-2 transition-colors shadow-sm">
                    View Blueprint
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          )
        }

        // Lab results card — clean white card style
        return (
          <div
            key={alert.id}
            className="bg-white rounded-card shadow-sm shadow-aubergine/5 border border-violet/15 p-5 flex items-start gap-4 cursor-pointer hover:border-violet/30 transition-colors"
            onClick={() => {
              markRead(alert.id)
              onNavigate(alert.link_view as DashboardView)
            }}
          >
            {/* Icon */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-sans font-medium text-aubergine">
                {alert.title}
              </p>
              {alert.body && (
                <p className="text-xs font-sans text-aubergine/50 mt-1 line-clamp-1">
                  {alert.body}
                </p>
              )}
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 mt-1">
              <svg className="w-4 h-4 text-violet/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        )
      })}
    </div>
  )
}
