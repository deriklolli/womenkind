'use client'

import { useState } from 'react'
import type { NearbyClinic } from '@/app/api/clinics/nearby/route'

interface Props {
  patientId: string
  clinic: NearbyClinic
  onSuccess: () => void
  onBack: () => void
}

type TimePreference = 'morning' | 'afternoon' | 'either'

export default function InPersonRequestForm({ patientId, clinic, onSuccess, onBack }: Props) {
  const [preferredDates, setPreferredDates] = useState('')
  const [preferredTime, setPreferredTime] = useState<TimePreference>('either')
  const [notes, setNotes] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timeOptions: { value: TimePreference; label: string; sub: string }[] = [
    { value: 'morning', label: 'Morning', sub: 'Before noon' },
    { value: 'afternoon', label: 'Afternoon', sub: 'Noon – 5 pm' },
    { value: 'either', label: 'Either', sub: 'Flexible' },
  ]

  const handleSubmit = async () => {
    if (!preferredDates.trim()) {
      setError('Please enter your preferred dates or timeframe.')
      return
    }
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/clinics/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          clinicId: clinic.id,
          preferredDates: preferredDates.trim(),
          preferredTime,
          notes: notes.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2 text-center">
        Request an In-Person Visit
      </h1>
      <p className="text-sm font-sans text-aubergine/40 mb-8 text-center">
        Tell us when you're available and we'll reach out within 24 hours to confirm your appointment.
      </p>

      {/* Clinic card */}
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-5 mb-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-violet/8 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-sans font-semibold text-aubergine">{clinic.name}</p>
          <p className="text-xs font-sans text-aubergine/50 mt-0.5">
            {clinic.address}, {clinic.city}, {clinic.state} {clinic.zip}
          </p>
          <p className="text-xs font-sans text-aubergine/35 mt-1">
            {clinic.distance_miles < 1
              ? 'Less than 1 mile away'
              : `${Math.round(clinic.distance_miles)} miles away`}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Preferred dates */}
        <div>
          <label className="block text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-2">
            Preferred dates or timeframe
          </label>
          <input
            type="text"
            value={preferredDates}
            onChange={e => setPreferredDates(e.target.value)}
            placeholder="e.g. Any weekday after April 20, or March 10–15"
            className="w-full px-4 py-3 text-sm font-sans text-aubergine bg-white border border-aubergine/15 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10 placeholder:text-aubergine/25 transition"
          />
        </div>

        {/* Preferred time of day */}
        <div>
          <label className="block text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-2">
            Preferred time of day
          </label>
          <div className="grid grid-cols-3 gap-2">
            {timeOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPreferredTime(opt.value)}
                className={`px-4 py-3 rounded-brand border text-left transition-all ${
                  preferredTime === opt.value
                    ? 'border-violet bg-violet/5'
                    : 'border-aubergine/10 bg-white hover:border-aubergine/20'
                }`}
              >
                <p className={`text-sm font-sans font-semibold ${preferredTime === opt.value ? 'text-violet' : 'text-aubergine'}`}>
                  {opt.label}
                </p>
                <p className="text-xs font-sans text-aubergine/40 mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Contact phone */}
        <div>
          <label className="block text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-2">
            Best phone number to reach you
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={e => setContactPhone(e.target.value)}
            placeholder="(555) 555-5555"
            className="w-full px-4 py-3 text-sm font-sans text-aubergine bg-white border border-aubergine/15 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10 placeholder:text-aubergine/25 transition"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-2">
            Anything else we should know? <span className="normal-case font-normal text-aubergine/35">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. I prefer a specific provider, need parking information, etc."
            className="w-full px-4 py-3 text-sm font-sans text-aubergine bg-white border border-aubergine/15 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10 placeholder:text-aubergine/25 transition resize-none"
          />
        </div>

        {error && (
          <p className="text-sm font-sans text-red-500">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3 text-sm font-sans font-medium text-aubergine/50 border border-aubergine/10 rounded-pill hover:bg-aubergine/5 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !preferredDates.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-violet text-white text-sm font-sans font-semibold rounded-pill hover:bg-violet/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending request...
              </>
            ) : (
              'Request Appointment'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
