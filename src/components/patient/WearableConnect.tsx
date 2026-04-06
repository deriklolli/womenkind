'use client'

import { useState, useEffect } from 'react'

interface WearableConnectProps {
  patientId: string
  onConnected?: () => void
}

interface ConnectionStatus {
  connected: boolean
  provider: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
}

export default function WearableConnect({ patientId, onConnected }: WearableConnectProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
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

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/wearables/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, days: 7 }),
      })
      await fetchStatus()
      onConnected?.()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncing(false)
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

  if (loading) {
    return (
      <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5 animate-pulse">
        <div className="h-5 bg-aubergine/5 rounded w-48 mb-3" />
        <div className="h-4 bg-aubergine/5 rounded w-64" />
      </div>
    )
  }

  // Connected state
  if (status?.connected) {
    return (
      <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-sans font-semibold text-aubergine">Oura Ring Connected</h3>
              <p className="text-xs font-sans text-aubergine/40">
                {status.lastSyncedAt
                  ? `Last synced ${new Date(status.lastSyncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : 'Syncing...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs font-sans font-medium text-violet hover:text-violet/80 disabled:opacity-50 px-3 py-1.5 rounded-pill border border-violet/20 hover:border-violet/40 transition-colors"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={() => setShowDisconnectConfirm(true)}
              className="text-xs font-sans font-medium text-aubergine/30 hover:text-red-500 px-3 py-1.5 rounded-pill border border-aubergine/10 hover:border-red-200 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>

        {showDisconnectConfirm && (
          <div className="mt-4 p-4 bg-red-50/50 rounded-brand border border-red-200/50">
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
    )
  }

  // Not connected state
  return (
    <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-sans font-semibold text-aubergine mb-1">Connect Your Oura Ring</h3>
          <p className="text-sm font-sans text-aubergine/50 mb-4">
            Automatically track your sleep quality, body temperature, heart rate variability, and resting heart rate. Your provider can see trends between visits to fine-tune your care plan.
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
    </div>
  )
}
