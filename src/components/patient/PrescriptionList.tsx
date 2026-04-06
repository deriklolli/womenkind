'use client'

import { useState, useEffect } from 'react'

interface Prescription {
  id: string
  medicationName: string
  dosage: string
  frequency: string
  quantityDispensed: number
  daysRemaining: number
  refillsAuthorized: number
  refillsUsed: number
  refillsRemaining: number
  needsRefillSoon: boolean
  prescribedAt: string
  lastFilledAt: string
  runsOutAt: string
  providerId?: string
}

interface Props {
  patientId: string
}

const PROVIDER_ID = 'b0000000-0000-0000-0000-000000000001'

export default function PrescriptionList({ patientId }: Props) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) { setLoading(false); return }
    const fetchPrescriptions = async () => {
      try {
        const res = await fetch(`/api/prescriptions?patientId=${patientId}`)
        const data = await res.json()
        setPrescriptions(data.prescriptions || [])
      } catch (err) {
        console.error('Failed to fetch prescriptions:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPrescriptions()

    // Also fetch existing pending refill requests to pre-fill requestedIds
    const fetchExistingRequests = async () => {
      try {
        const res = await fetch(`/api/refill-requests?patientId=${patientId}&status=pending`)
        const data = await res.json()
        const pendingIds: string[] = (data.refillRequests || []).map((r: any) => r.prescription_id)
        setRequestedIds(prev => {
          const next = new Set(prev)
          pendingIds.forEach(id => next.add(id))
          return next
        })
      } catch (err) {
        console.error('Failed to fetch existing refill requests:', err)
      }
    }
    fetchExistingRequests()
  }, [patientId])

  const handleRequestRefill = async (prescriptionId: string) => {
    setSubmittingId(prescriptionId)
    try {
      const res = await fetch('/api/refill-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId,
          patientId,
          providerId: PROVIDER_ID,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setRequestedIds(prev => new Set(prev).add(prescriptionId))
      } else if (res.status === 409) {
        // Already has a pending request
        setRequestedIds(prev => new Set(prev).add(prescriptionId))
      } else {
        console.error('Failed to submit refill request:', data.error)
      }
    } catch (err) {
      console.error('Failed to submit refill request:', err)
    } finally {
      setSubmittingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (prescriptions.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-10 h-10 text-aubergine/15 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-sans text-aubergine/40">No active prescriptions</p>
        <p className="text-xs font-sans text-aubergine/25 mt-1">Prescriptions will appear here once prescribed by Dr. Urban</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {prescriptions.map((rx) => {
        const isUrgent = rx.daysRemaining <= 3
        const isExpiringSoon = rx.needsRefillSoon
        // Bar fills up as it gets closer to expiration (100% = expired, 0% = full supply)
        const barPercent = Math.max(0, Math.min(100, 100 - (rx.daysRemaining / 90) * 100))
        const isRequested = requestedIds.has(rx.id)

        return (
          <div
            key={rx.id}
            className={`p-4 rounded-xl border transition-colors ${
              isExpiringSoon
                ? 'bg-cream border-amber-200/50'
                : 'bg-cream border-aubergine/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-sans font-medium text-aubergine truncate">
                    {rx.medicationName}
                  </p>
                  {isExpiringSoon && (
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-sans font-medium ${
                      isUrgent
                        ? 'bg-red-50 border border-red-200 text-red-600'
                        : 'bg-amber-50 border border-amber-200 text-amber-600'
                    }`}>
                      {rx.daysRemaining === 0 ? 'Expired' : `${rx.daysRemaining} days left`}
                    </span>
                  )}
                </div>
                <p className="text-xs font-sans text-aubergine/45 mt-0.5">
                  {rx.dosage} &middot; {rx.frequency}
                </p>
              </div>
            </div>

            {/* Supply progress bar — fills left-to-right as expiration approaches, teal→purple gradient */}
            <div className="mb-3">
              <div className="w-full h-1.5 rounded-full bg-aubergine/5">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${barPercent}%`,
                    background: isUrgent
                      ? 'linear-gradient(to right, #c9a5f7, #944fed, #ef4444)'
                      : 'linear-gradient(to right, #c9a5f7, #944fed)',
                  }}
                />
              </div>
            </div>

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-sans text-aubergine/35 mb-3">
              <span>
                Qty: {rx.quantityDispensed}
              </span>
              <span>
                Last filled: {new Date(rx.lastFilledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span>
                {rx.refillsRemaining > 0
                  ? `${rx.refillsRemaining} of ${rx.refillsAuthorized} refills remaining`
                  : 'No refills remaining'}
              </span>
              {!isExpiringSoon && (
                <span className="text-aubergine/50">
                  {rx.daysRemaining} days remaining
                </span>
              )}
            </div>

            {/* Refill button for expiring prescriptions */}
            {isExpiringSoon && rx.refillsRemaining > 0 && (
              <button
                onClick={() => handleRequestRefill(rx.id)}
                disabled={isRequested || submittingId === rx.id}
                className={`w-full py-2.5 rounded-full text-xs font-sans font-semibold transition-all ${
                  isRequested
                    ? 'bg-[#4ECDC4]/10 text-[#4ECDC4] border border-[#4ECDC4]/20'
                    : 'bg-white text-violet border border-violet/25 hover:bg-violet/5'
                }`}
              >
                {submittingId === rx.id ? 'Submitting...' : isRequested ? 'Refill Requested' : 'Request Refill'}
              </button>
            )}

            {isExpiringSoon && rx.refillsRemaining === 0 && (
              <div className="py-2 px-3 rounded-lg bg-amber-50/50 border border-amber-200/30">
                <p className="text-[11px] font-sans text-amber-600/70">
                  No refills remaining. Contact Dr. Urban to request a new prescription.
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
