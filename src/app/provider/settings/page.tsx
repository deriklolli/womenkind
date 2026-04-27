'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getProviderSession } from '@/lib/getProviderSession'

interface CalendarStatus {
  connected: boolean
  email?: string
  timezone?: string
  lastSynced?: string
  connectedAt?: string
}

export default function ProviderSettingsPage() {
  const searchParams = useSearchParams()
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [providerId, setProviderId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Resolve provider ID — demo mode or real Supabase auth
  useEffect(() => {
    getProviderSession().then(session => {
      if (session?.providerId) setProviderId(session.providerId)
    })
  }, [])

  // Check for OAuth callback params
  useEffect(() => {
    const calendarParam = searchParams.get('calendar')
    if (calendarParam === 'connected') {
      const email = searchParams.get('email')
      setToast(`Google Calendar connected${email ? ` as ${email}` : ''}`)
      // Clear the URL params
      window.history.replaceState({}, '', '/provider/settings')
    } else if (calendarParam === 'denied') {
      setToast('Google Calendar connection was canceled')
      window.history.replaceState({}, '', '/provider/settings')
    } else if (calendarParam === 'error') {
      const reason = searchParams.get('reason')
      setToast(`Connection failed: ${reason || 'unknown error'}`)
      window.history.replaceState({}, '', '/provider/settings')
    }
  }, [searchParams])

  // Fetch calendar connection status
  useEffect(() => {
    if (!providerId) return
    fetchStatus()
  }, [providerId])

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/auth/google/status?providerId=${providerId}`)
      const data = await res.json()
      setCalendarStatus(data)
    } catch {
      setCalendarStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    if (!providerId) return
    setConnecting(true)
    try {
      const res = await fetch('/api/auth/google/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setToast('Failed to start connection')
        setConnecting(false)
      }
    } catch {
      setToast('Failed to start connection')
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    if (!providerId) return
    setDisconnecting(true)
    try {
      await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      })
      setCalendarStatus({ connected: false })
      setToast('Google Calendar disconnected')
    } catch {
      setToast('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-serif font-normal text-aubergine mb-1">Settings</h1>
        <p className="text-sm font-sans text-aubergine/50 mb-8">
          Manage your calendar integration and preferences
        </p>

        {/* Toast notification */}
        {toast && (
          <div className="mb-6 px-4 py-3 rounded-brand bg-violet/10 border border-violet/20 text-sm font-sans text-aubergine">
            {toast}
          </div>
        )}

        {/* Google Calendar Card */}
        <div className="bg-white rounded-card border border-aubergine/8 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Google Calendar icon */}
              <div className="w-10 h-10 rounded-brand bg-violet/8 flex items-center justify-center">
                <svg className="w-5 h-5 text-violet" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-sans font-semibold text-aubergine">Google Calendar</h2>
                <p className="text-xs font-sans text-aubergine/40 mt-0.5">
                  Sync your schedule so patients only see available times
                </p>
              </div>
            </div>

            {/* Status badge */}
            {!loading && (
              <span className={`text-xs font-sans px-2.5 py-1 rounded-pill ${
                calendarStatus?.connected
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-aubergine/5 text-aubergine/40 border border-aubergine/10'
              }`}>
                {calendarStatus?.connected ? 'Connected' : 'Not connected'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-4 text-sm font-sans text-aubergine/30">Loading...</div>
          ) : calendarStatus?.connected ? (
            /* Connected state */
            <div className="space-y-4">
              <div className="bg-cream/50 rounded-brand p-4 space-y-2">
                <div className="flex justify-between text-sm font-sans">
                  <span className="text-aubergine/50">Account</span>
                  <span className="text-aubergine">{calendarStatus.email}</span>
                </div>
                <div className="flex justify-between text-sm font-sans">
                  <span className="text-aubergine/50">Timezone</span>
                  <span className="text-aubergine">{calendarStatus.timezone?.replace(/_/g, ' ')}</span>
                </div>
                {calendarStatus.lastSynced && (
                  <div className="flex justify-between text-sm font-sans">
                    <span className="text-aubergine/50">Last synced</span>
                    <span className="text-aubergine">
                      {new Date(calendarStatus.lastSynced).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs font-sans text-aubergine/40">
                Events marked as &quot;busy&quot; on your Google Calendar will automatically block those time slots from patient booking.
              </p>

              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-sm font-sans text-red-500/70 hover:text-red-600 underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect Google Calendar'}
              </button>
            </div>
          ) : (
            /* Disconnected state */
            <div className="space-y-4">
              <p className="text-sm font-sans text-aubergine/50 leading-relaxed">
                Connect your Google Calendar to automatically sync your availability.
                When you have events on your calendar, those time slots will be blocked
                from patient booking.
              </p>

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-violet text-white text-sm font-sans hover:bg-violet/90 transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  'Connecting...'
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.686-5.781a4.5 4.5 0 00-6.364-6.364L4.5 8.488a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    Connect Google Calendar
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
