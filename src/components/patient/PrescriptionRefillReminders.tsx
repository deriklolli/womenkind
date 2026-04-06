'use client'

import { useState, useEffect } from 'react'

interface Prescription {
  id: string
  medicationName: string
  dosage: string
  frequency: string
  daysRemaining: number
  refillsRemaining: number
  needsRefillSoon: boolean
  runsOutAt: string
}

interface Props {
  patientId: string
  onRequestRefill?: () => void
}

export default function PrescriptionRefillReminders({ patientId, onRequestRefill }: Props) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) { setLoading(false); return }
    const fetchPrescriptions = async () => {
      try {
        const res = await fetch(`/api/prescriptions?patientId=${patientId}`)
        const data = await res.json()
        // Only show ones that need refill soon
        setPrescriptions(
          (data.prescriptions || []).filter((rx: Prescription) => rx.needsRefillSoon)
        )
      } catch (err) {
        console.error('Failed to fetch prescriptions:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPrescriptions()
  }, [patientId])

  if (loading) {
    return (
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (prescriptions.length === 0) return null

  return (
    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
      <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-4">
        Prescription Refill Reminders
      </h3>

      <div className="space-y-3">
        {prescriptions.map((rx) => {
          const isUrgent = rx.daysRemaining <= 3
          // Bar fills up as it gets closer to expiration (100% = expired, 0% = full supply)
          const barPercent = Math.max(0, Math.min(100, 100 - (rx.daysRemaining / 30) * 100))

          return (
            <div key={rx.id} className="p-3.5 rounded-xl bg-cream border border-aubergine/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-aubergine truncate">
                    {rx.medicationName}
                  </p>
                  <p className="text-xs font-sans text-aubergine/45 mt-0.5">
                    {rx.dosage} &middot; {rx.frequency}
                  </p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-sans font-medium ${
                  isUrgent
                    ? 'bg-red-50 border border-red-200 text-red-600'
                    : 'bg-amber-50 border border-amber-200 text-amber-600'
                }`}>
                  {rx.daysRemaining === 0 ? 'Expired' : `${rx.daysRemaining} days left`}
                </span>
              </div>

              {/* Supply bar — fills left-to-right as expiration approaches, teal→purple gradient */}
              <div className="mt-2.5 mb-3">
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

              <div className="flex items-center justify-between">
                <p className="text-[10px] font-sans text-aubergine/30">
                  {rx.refillsRemaining > 0
                    ? `${rx.refillsRemaining} refill${rx.refillsRemaining > 1 ? 's' : ''} remaining`
                    : 'No refills remaining'}
                </p>
                <button
                  onClick={onRequestRefill}
                  className="px-3 py-1 text-xs font-sans font-medium text-violet bg-white border border-violet/25 rounded-full hover:bg-violet/5 transition-colors"
                >
                  Request Refill
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
