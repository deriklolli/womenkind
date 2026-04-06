'use client'

import { useState, useEffect } from 'react'

interface PatientSettingsProps {
  patientId: string
}

interface ConnectionStatus {
  connected: boolean
  provider: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
}

export default function PatientSettings({ patientId }: PatientSettingsProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [patientId])

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/wearables/status?patientId=${patientId}`)
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      console.error('Failed to fetch wearable status:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/auth/oura/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('Failed to initiate Oura connect:', err)
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/auth/oura/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      setStatus({ connected: false, provider: null, connectedAt: null, lastSyncedAt: null })
      setShowDisconnectConfirm(false)
    } catch (err) {
      console.error('Disconnect failed:', err)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="font-serif text-xl text-aubergine">Settings</h2>
        <p className="text-sm font-sans text-aubergine/40 mt-1">Manage your connected devices and preferences.</p>
      </div>

      {/* Connected Devices section */}
      <div className="bg-white rounded-card shadow-sm border border-aubergine/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-aubergine/5">
          <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider">Connected Devices</h3>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-5 bg-aubergine/5 rounded w-40 mb-2" />
              <div className="h-4 bg-aubergine/5 rounded w-64" />
            </div>
          ) : status?.connected ? (
            /* Connected state */
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-violet/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-sans font-semibold text-aubergine">Oura Ring</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 text-[10px] font-sans font-medium text-[#4ECDC4]">
                        <span className="w-1 h-1 rounded-full bg-[#4ECDC4]" />
                        Connected
                      </span>
                    </div>
                    <p className="text-xs font-sans text-aubergine/40 mt-0.5">
                      Syncing sleep, temperature, HRV, and heart rate data with your care team.
                    </p>
                    {status.lastSyncedAt && (
                      <p className="text-xs font-sans text-aubergine/30 mt-1">
                        Last synced {new Date(status.lastSyncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Disconnect option */}
              <div className="mt-5 pt-4 border-t border-aubergine/5">
                {!showDisconnectConfirm ? (
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="text-xs font-sans font-medium text-aubergine/30 hover:text-red-500 transition-colors"
                  >
                    Disconnect Oura Ring
                  </button>
                ) : (
                  <div className="p-4 bg-red-50/50 rounded-brand border border-red-200/50">
                    <p className="text-sm font-sans text-aubergine/70 mb-3">
                      Disconnect your Oura Ring? Your historical health data will be preserved.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="text-xs font-sans font-medium text-red-600 px-3 py-1.5 rounded-pill border border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
                      </button>
                      <button
                        onClick={() => setShowDisconnectConfirm(false)}
                        className="text-xs font-sans font-medium text-aubergine/50 px-3 py-1.5 rounded-pill border border-aubergine/10 hover:border-aubergine/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Not connected state */
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-aubergine/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-aubergine/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-sans font-semibold text-aubergine mb-1">Oura Ring</p>
                <p className="text-sm font-sans text-aubergine/50 mb-4">
                  Connect your Oura Ring to automatically share sleep, body temperature, heart rate variability, and resting heart rate data with your care team. This helps Dr. Urban track your progress between visits.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="bg-violet hover:bg-violet/90 text-white text-sm font-sans font-medium px-5 py-2.5 rounded-pill transition-colors disabled:opacity-50"
                >
                  {connecting ? 'Connecting...' : 'Connect Oura Ring'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for future settings sections */}
      {/*
      <div className="bg-white rounded-card shadow-sm border border-aubergine/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-aubergine/5">
          <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider">Notifications</h3>
        </div>
        <div className="px-6 py-5">
          ...
        </div>
      </div>
      */}
    </div>
  )
}
