'use client'

import { useState, useEffect } from 'react'

interface RefillRequest {
  id: string
  prescription_id: string
  patient_id: string
  provider_id: string
  status: 'pending' | 'approved' | 'denied'
  patient_note: string | null
  provider_note: string | null
  created_at: string
  reviewed_at: string | null
  prescriptions: {
    medication_name: string
    dosage: string
    frequency: string
  } | null
  patients: {
    id: string
    profiles: {
      first_name: string | null
      last_name: string | null
      email: string | null
    } | null
  } | null
}

interface Props {
  providerId: string
  onCountChange?: (count: number) => void
}

export default function ProviderRefillQueue({ providerId, onCountChange }: Props) {
  const [requests, setRequests] = useState<RefillRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'denied' | 'all'>('pending')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchRequests()
  }, [providerId])

  const fetchRequests = async () => {
    try {
      const res = await fetch(`/api/refill-requests?providerId=${providerId}`)
      const data = await res.json()
      setRequests(data.refillRequests || [])
      const pendingCount = (data.refillRequests || []).filter((r: RefillRequest) => r.status === 'pending').length
      onCountChange?.(pendingCount)
    } catch (err) {
      console.error('Failed to fetch refill requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (requestId: string, status: 'approved' | 'denied') => {
    setActionInProgress(requestId)
    try {
      const res = await fetch('/api/refill-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          status,
          providerNote: noteInput[requestId] || null,
        }),
      })
      if (res.ok) {
        await fetchRequests()
        setNoteInput(prev => { const next = { ...prev }; delete next[requestId]; return next })
      }
    } catch (err) {
      console.error('Failed to update refill request:', err)
    } finally {
      setActionInProgress(null)
    }
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    denied: requests.filter(r => r.status === 'denied').length,
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getPatientName = (req: RefillRequest) => {
    const p = req.patients?.profiles
    if (!p) return 'Unknown Patient'
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Patient'
  }

  return (
    <>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-sans font-semibold text-3xl text-aubergine tracking-tight">Refill Requests</h1>
          <p className="text-sm font-sans text-aubergine/50 mt-1">
            {counts.pending} pending {counts.pending === 1 ? 'request' : 'requests'}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-brand p-1 w-fit shadow-sm">
        {[
          { key: 'pending' as const, label: 'Pending' },
          { key: 'approved' as const, label: 'Approved' },
          { key: 'denied' as const, label: 'Denied' },
          { key: 'all' as const, label: 'All' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-brand text-sm font-sans font-medium transition-all
              ${filter === tab.key
                ? 'bg-aubergine text-white shadow-sm'
                : 'text-aubergine/50 hover:text-aubergine hover:bg-aubergine/5'
              }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${filter === tab.key ? 'text-white/60' : 'text-aubergine/30'}`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin mx-auto" />
          <p className="text-sm font-sans text-aubergine/40 mt-4">Loading requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-card shadow-sm">
          <p className="text-lg font-sans font-semibold text-aubergine/30">No refill requests</p>
          <p className="text-sm font-sans text-aubergine/20 mt-2">
            {filter !== 'all' ? 'Try a different filter' : 'Patient refill requests will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const isPending = req.status === 'pending'
            const statusColors = {
              pending: 'text-amber-600 bg-amber-50 border-amber-200',
              approved: 'text-emerald-600 bg-emerald-50 border-emerald-200',
              denied: 'text-red-600 bg-red-50 border-red-200',
            }

            return (
              <div
                key={req.id}
                className="bg-white rounded-card p-5 shadow-sm border border-transparent"
              >
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <h3 className="font-sans font-semibold text-lg text-aubergine truncate">
                      {req.prescriptions?.medication_name || 'Unknown Medication'}
                    </h3>
                    <span className={`text-xs font-sans px-2.5 py-0.5 rounded-pill border flex-shrink-0 ${statusColors[req.status]}`}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(req.id, 'approved')}
                        disabled={actionInProgress === req.id}
                        className="px-4 py-2 rounded-full text-xs font-sans font-semibold bg-violet text-white hover:bg-violet/90 transition-colors disabled:opacity-50"
                      >
                        {actionInProgress === req.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'denied')}
                        disabled={actionInProgress === req.id}
                        className="px-4 py-2 rounded-full text-xs font-sans font-semibold bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-colors disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm font-sans text-aubergine/50 mb-1">
                  {getPatientName(req)}
                </p>
                <div className="flex items-center gap-4 text-xs font-sans text-aubergine/40">
                  {req.prescriptions && (
                    <span>{req.prescriptions.dosage} &middot; {req.prescriptions.frequency}</span>
                  )}
                  <span>Requested {formatDate(req.created_at)}</span>
                </div>

                {req.patient_note && (
                  <div className="mt-3 p-3 rounded-xl bg-cream border border-aubergine/5">
                    <p className="text-[11px] font-sans font-medium text-aubergine/40 mb-1">Patient note</p>
                    <p className="text-sm font-sans text-aubergine/65">{req.patient_note}</p>
                  </div>
                )}
                {req.provider_note && (
                  <div className="mt-2 p-3 rounded-xl bg-violet/5 border border-violet/10">
                    <p className="text-[11px] font-sans font-medium text-violet/50 mb-1">Your note</p>
                    <p className="text-sm font-sans text-aubergine/65">{req.provider_note}</p>
                  </div>
                )}
                {req.reviewed_at && (
                  <p className="text-[11px] font-sans text-aubergine/30 mt-2">
                    Reviewed {formatDate(req.reviewed_at)}
                  </p>
                )}

                {/* Optional note input for pending requests */}
                {isPending && (
                  <div className="mt-3">
                    <p className="text-[11px] font-sans font-medium text-aubergine/40 mb-1.5">Add Note</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add a note (optional)..."
                        value={noteInput[req.id] || ''}
                        onChange={(e) => setNoteInput(prev => ({ ...prev, [req.id]: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-lg border border-aubergine/10 bg-cream text-xs font-sans text-aubergine placeholder:text-aubergine/25 focus:outline-none focus:border-violet/30 focus:ring-1 focus:ring-violet/10"
                      />
                      <button
                        onClick={() => {/* note is attached when approving/denying */}}
                        disabled={!noteInput[req.id]?.trim()}
                        className="px-4 py-2 rounded-lg text-xs font-sans font-semibold bg-white text-violet border border-violet/25 hover:bg-violet/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        Add Note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
