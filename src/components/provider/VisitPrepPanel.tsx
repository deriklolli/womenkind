'use client'

import { useState, useEffect, useCallback } from 'react'

interface VisitPrepPanelProps {
  appointmentId: string
  onClose: () => void
}

export default function VisitPrepPanel({ appointmentId, onClose }: VisitPrepPanelProps) {
  const [narrative, setNarrative] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ appointmentType: string; appointmentDate: string; isFirstVisit: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrep = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/visit-prep?appointmentId=${appointmentId}`)
      if (!res.ok) throw new Error('Failed to generate brief')
      const data = await res.json()
      setNarrative(data.narrative)
      setMeta({
        appointmentType: data.appointmentType,
        appointmentDate: data.appointmentDate,
        isFirstVisit: data.isFirstVisit,
      })
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [appointmentId])

  useEffect(() => {
    fetchPrep()
  }, [fetchPrep])

  return (
    <div className="mt-3 border-t border-aubergine/8 pt-3">
      {loading ? (
        <div className="flex items-center gap-3 py-4 px-2">
          <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="text-xs font-sans font-medium text-aubergine/50">Preparing visit brief...</p>
            <p className="text-[10px] font-sans text-aubergine/30 mt-0.5">Reviewing labs, biometrics, messages, and history</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 py-3 px-2">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs font-sans text-aubergine/40">{error}</p>
          <button
            onClick={fetchPrep}
            className="text-xs font-sans font-semibold text-violet hover:text-violet/80 transition-colors ml-auto"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="px-2 pb-1">
          {/* Header row with badges and close */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-violet/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <span className="text-[10px] font-sans font-semibold text-violet/50 uppercase tracking-wider">AI Visit Brief</span>
              {meta?.isFirstVisit && (
                <span className="px-2 py-0.5 text-[10px] font-sans font-medium rounded-pill border text-amber-600 bg-amber-50 border-amber-200">
                  First Visit
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchPrep}
                className="p-1 text-aubergine/20 hover:text-violet/60 transition-colors rounded"
                title="Regenerate"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-1 text-aubergine/20 hover:text-aubergine/50 transition-colors rounded"
                title="Close"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Narrative */}
          {narrative?.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-sm font-sans text-aubergine/70 leading-relaxed mb-2.5 last:mb-0">
              {paragraph}
            </p>
          ))}

          {/* Disclaimer */}
          <p className="text-[10px] font-sans text-aubergine/25 mt-3 italic">
            AI-generated from available patient data. Verify clinical details before making treatment decisions.
          </p>
        </div>
      )}
    </div>
  )
}
