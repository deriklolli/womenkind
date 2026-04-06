'use client'

import { useState, useEffect } from 'react'

interface PatientSettingsProps {
  patientId: string
  membershipStatus: 'active' | 'canceled' | 'past_due' | 'none'
  membershipRenewal: string | null
  onEnrollMembership?: () => void
  membershipLoading?: boolean
}

interface ConnectionStatus {
  connected: boolean
  provider: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
}

type SettingsTab = 'devices' | 'billing' | 'notifications'

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'devices', label: 'Connected Devices' },
  { key: 'billing', label: 'Billing & Membership' },
  { key: 'notifications', label: 'Notifications' },
]

export default function PatientSettings({
  patientId,
  membershipStatus,
  membershipRenewal,
  onEnrollMembership,
  membershipLoading,
}: PatientSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('devices')
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [canceling, setCanceling] = useState(false)

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

  async function handleOpenBillingPortal() {
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      }
    } catch (err) {
      console.error('Failed to open billing portal:', err)
    }
  }

  async function handleCancelMembership() {
    setCanceling(true)
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json()
        console.error('Cancel failed:', data.error)
      }
    } catch (err) {
      console.error('Failed to cancel membership:', err)
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-aubergine/5 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-sans font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-aubergine'
                : 'text-aubergine/35 hover:text-aubergine/60'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-violet rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Connected Devices */}
      {activeTab === 'devices' && (
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5 overflow-hidden">
          <div className="px-6 py-5">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-5 bg-aubergine/5 rounded w-40 mb-2" />
                <div className="h-4 bg-aubergine/5 rounded w-64" />
              </div>
            ) : status?.connected ? (
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
      )}

      {/* Billing & Membership */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5 overflow-hidden">
          <div className="px-6 py-5">
            {membershipStatus === 'active' ? (
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-[#4ECDC4]/5 border-[#4ECDC4]/20 text-sm font-sans text-[#4ECDC4] mb-5">
                  Active Member
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-sans py-2.5 border-b border-aubergine/5">
                    <span className="text-aubergine/40">Plan</span>
                    <span className="text-aubergine/70">Womenkind Membership</span>
                  </div>
                  <div className="flex justify-between text-sm font-sans py-2.5 border-b border-aubergine/5">
                    <span className="text-aubergine/40">Monthly cost</span>
                    <span className="text-aubergine/70">$200/month</span>
                  </div>
                  {membershipRenewal && (
                    <div className="flex justify-between text-sm font-sans py-2.5 border-b border-aubergine/5">
                      <span className="text-aubergine/40">Next renewal</span>
                      <span className="text-aubergine/70">
                        {new Date(membershipRenewal).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 rounded-brand bg-violet/5 border border-violet/10">
                  <p className="text-xs font-sans text-violet/70 leading-relaxed">
                    Your membership includes follow-up visits, prescription management, progress tracking, and personalized care presentations.
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-aubergine/5">
                  <p className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider mb-3">Payment Method</p>
                  <button
                    onClick={handleOpenBillingPortal}
                    className="px-5 py-2.5 rounded-full text-xs font-sans font-semibold bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-all"
                  >
                    Manage Payment Method
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-aubergine/5">
                  <p className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider mb-3">Cancel Membership</p>
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="text-xs font-sans font-medium text-aubergine/30 hover:text-red-500 transition-colors"
                    >
                      Cancel Membership
                    </button>
                  ) : (
                    <div className="p-4 bg-red-50/50 rounded-brand border border-red-200/50">
                      <p className="text-sm font-sans text-aubergine/70 mb-3">
                        Cancel your membership? You will retain access until the end of your current billing period. You can re-enroll at any time.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelMembership}
                          disabled={canceling}
                          className="text-xs font-sans font-medium text-red-600 px-3 py-1.5 rounded-pill border border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {canceling ? 'Canceling...' : 'Yes, Cancel Membership'}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className="text-xs font-sans font-medium text-aubergine/50 px-3 py-1.5 rounded-pill border border-aubergine/10 hover:border-aubergine/20 transition-colors"
                        >
                          Keep Membership
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-sans text-aubergine/60 mb-4 leading-relaxed">
                  Get ongoing care for $200/month — follow-up visits, progress tracking, prescription management, and personalized care presentations.
                </p>
                <button
                  onClick={onEnrollMembership}
                  disabled={membershipLoading}
                  className="px-6 py-3 rounded-full font-sans text-sm font-semibold bg-violet text-white hover:bg-violet/90 disabled:opacity-50 transition-all duration-300"
                >
                  {membershipLoading ? 'Loading...' : 'Enroll — $200/month'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5 overflow-hidden">
          <div className="px-6 py-5 space-y-5">
            <p className="text-sm font-sans text-aubergine/50 leading-relaxed">
              Choose how you&apos;d like to be notified about updates to your care.
            </p>

            {/* Email notifications */}
            <div className="space-y-3">
              <p className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider">Email Notifications</p>
              <NotificationToggle
                label="Appointment reminders"
                description="Receive an email 24 hours before your scheduled visit"
                defaultOn
              />
              <NotificationToggle
                label="Lab results ready"
                description="Get notified when new lab results are available"
                defaultOn
              />
              <NotificationToggle
                label="Prescription updates"
                description="Refill approvals, new prescriptions, and pharmacy notifications"
                defaultOn
              />
              <NotificationToggle
                label="Health Blueprint updates"
                description="When your provider publishes a new or updated care plan"
                defaultOn
              />
              <NotificationToggle
                label="Provider messages"
                description="New messages from your care team"
                defaultOn
              />
            </div>

            {/* In-app notifications */}
            <div className="space-y-3 pt-4 border-t border-aubergine/5">
              <p className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider">In-App Notifications</p>
              <NotificationToggle
                label="Dashboard alerts"
                description="Show alert cards on your dashboard for items that need attention"
                defaultOn
              />
              <NotificationToggle
                label="Notification bell"
                description="Show the unread count badge on the bell icon"
                defaultOn
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Toggle row ──────────────────────────────────────────────────────── */

function NotificationToggle({
  label,
  description,
  defaultOn = false,
}: {
  label: string
  description: string
  defaultOn?: boolean
}) {
  const [on, setOn] = useState(defaultOn)

  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans font-medium text-aubergine">{label}</p>
        <p className="text-xs font-sans text-aubergine/40 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative flex-shrink-0 w-10 h-[22px] rounded-full transition-colors duration-200 ${
          on ? 'bg-violet' : 'bg-aubergine/10'
        }`}
      >
        <span
          className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            on ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
