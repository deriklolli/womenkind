'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface CanceledAppointment {
  id: string
  starts_at: string
  canceled_at: string
  appointment_types: { name: string } | null
  patients: {
    profiles: { first_name: string | null; last_name: string | null } | null
  } | null
}

export default function ProviderCancellationAlerts({ providerId }: { providerId: string }) {
  const [items, setItems] = useState<CanceledAppointment[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    if (!providerId) return
    const load = async () => {
      try {
        const res = await fetch(`/api/provider/recent-cancellations?providerId=${providerId}`)
        const data = await res.json()
        setItems(data.appointments || [])
      } catch (err) {
        console.error('Failed to load cancellations:', err)
      }
    }
    load()
    const loadKey = `provider_cancellation_dismissed_${providerId}`
    const stored = typeof window !== 'undefined' ? localStorage.getItem(loadKey) : null
    if (stored) setDismissed(new Set(JSON.parse(stored)))
  }, [providerId])

  const dismiss = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`provider_cancellation_dismissed_${providerId}`, JSON.stringify(Array.from(next)))
    }
  }

  const visible = items.filter(i => !dismissed.has(i.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-6">
      {visible.map(apt => {
        const patientName = `${apt.patients?.profiles?.first_name || ''} ${apt.patients?.profiles?.last_name || ''}`.trim() || 'A patient'
        const apptName = apt.appointment_types?.name || 'Appointment'
        const apptDate = new Date(apt.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        const apptTime = new Date(apt.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        return (
          <div
            key={apt.id}
            className="bg-white rounded-card shadow-sm shadow-aubergine/5 border border-rose-200 p-4 flex items-center gap-4"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-50 text-rose-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-sans font-medium text-aubergine">
                {patientName} canceled their {apptName}
              </p>
              <p className="text-xs font-sans text-aubergine/50 mt-0.5">
                Was scheduled for {apptDate} at {apptTime}
              </p>
            </div>
            <button
              onClick={() => router.push('/provider/dashboard?tab=schedule')}
              className="text-xs font-sans font-medium text-violet hover:text-violet/80 px-3 py-1.5 rounded-full border border-violet/30 hover:bg-violet/5 transition-colors"
            >
              View schedule
            </button>
            <button
              onClick={() => dismiss(apt.id)}
              className="text-aubergine/30 hover:text-aubergine/60 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
