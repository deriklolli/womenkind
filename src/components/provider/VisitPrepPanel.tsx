'use client'

import { useState, useEffect, useCallback } from 'react'

interface VisitPrepPanelProps {
  appointmentId: string
  patientName: string
  onClose: () => void
}

export default function VisitPrepPanel({ appointmentId, patientName, onClose }: VisitPrepPanelProps) {
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

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-aubergine/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-aubergine/8">
          <div>
            <h2 className="text-base font-serif font-semibold text-aubergine">Visit Prep</h2>
            <p className="text-xs font-sans text-aubergine/40 mt-0.5">{patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-aubergine/30 hover:text-aubergine/60 hover:bg-aubergine/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-sans font-medium text-aubergine/60">Preparing visit brief</p>
                <p className="text-xs font-sans text-aubergine/30 mt-1">Reviewing labs, biometrics, messages, and history...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-sans text-aubergine/50">{error}</p>
              <button
                onClick={fetchPrep}
                className="text-xs font-sans font-semibold text-violet hover:text-violet/80 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : (
            <div>
              {/* Visit context */}
              {meta && (
                <div className="flex items-center gap-2 mb-5">
                  <span className="px-2.5 py-1 text-[11px] font-sans font-medium rounded-pill border text-violet bg-violet/5 border-violet/15">
                    {meta.appointmentType}
                  </span>
                  <span className="text-xs font-sans text-aubergine/30">{meta.appointmentDate}</span>
                  {meta.isFirstVisit && (
                    <span className="px-2.5 py-1 text-[11px] font-sans font-medium rounded-pill border text-amber-600 bg-amber-50 border-amber-200">
                      First Visit
                    </span>
                  )}
                </div>
              )}

              {/* AI Badge */}
              <div className="flex items-center gap-1.5 mb-4">
                <svg className="w-3.5 h-3.5 text-violet/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                <span className="text-[10px] font-sans font-semibold text-violet/50 uppercase tracking-wider">AI-Generated Brief</span>
              </div>

              {/* Narrative */}
              <div className="prose-sm">
                {narrative?.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="text-sm font-sans text-aubergine/80 leading-relaxed mb-3 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Footer disclaimer */}
              <div className="mt-6 p-3 rounded-brand bg-aubergine/[0.02] border border-aubergine/5">
                <p className="text-[11px] font-sans text-aubergine/30 leading-relaxed">
                  This brief was generated from available patient data including intake, labs, biometrics, messages, and prescription history. Verify any clinical details before making treatment decisions.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!loading && narrative && (
          <div className="px-6 py-3 border-t border-aubergine/8 flex items-center justify-end gap-2">
            <button
              onClick={fetchPrep}
              className="px-3 py-1.5 text-xs font-sans font-medium text-aubergine/40 hover:text-aubergine/60 hover:bg-aubergine/5 rounded-lg transition-colors"
            >
              Regenerate
            </button>
          </div>
        )}
      </div>
    </>
  )
}
