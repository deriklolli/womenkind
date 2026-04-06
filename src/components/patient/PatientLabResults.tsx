'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface LabResultItem {
  testCode: string
  testName: string
  value: string
  unit: string
  referenceRange: string
  flag: 'normal' | 'high' | 'low' | 'critical' | null
}

interface LabOrder {
  id: string
  lab_partner: string
  tests: { code: string; name: string }[]
  clinical_indication: string
  status: string
  results: LabResultItem[] | null
  ordered_at: string | null
  created_at: string
}

interface PatientLabResultsProps {
  patientId: string
}

const LAB_PARTNERS: Record<string, string> = {
  quest: 'Quest Diagnostics',
  labcorp: 'Labcorp',
}

const FLAG_STYLES: Record<string, { text: string; bg: string; label: string }> = {
  normal: { text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Normal' },
  high: { text: 'text-orange-600', bg: 'bg-orange-50', label: 'High' },
  low: { text: 'text-amber-600', bg: 'bg-amber-50', label: 'Low' },
  critical: { text: 'text-red-600', bg: 'bg-red-50', label: 'Critical' },
}

const STATUS_LABELS: Record<string, { label: string; style: string }> = {
  sent: { label: 'Ordered', style: 'text-violet bg-violet/5 border-violet/15' },
  collected: { label: 'Sample Collected', style: 'text-violet bg-violet/10 border-violet/20' },
  results_available: { label: 'Results Ready', style: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
}

export default function PatientLabResults({ patientId }: PatientLabResultsProps) {
  const [labOrders, setLabOrders] = useState<LabOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLabs() {
      const { data, error } = await supabase
        .from('lab_orders')
        .select('id, lab_partner, tests, clinical_indication, status, results, ordered_at, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setLabOrders(data as LabOrder[])
        // Auto-expand the first order with results
        const firstWithResults = data.find((o: any) => o.status === 'results_available' && o.results)
        if (firstWithResults) setExpandedId(firstWithResults.id)
      }
      setLoading(false)
    }
    fetchLabs()
  }, [patientId])

  if (loading) {
    return (
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-8">
        <div className="flex items-center justify-center gap-3 py-12">
          <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
          <span className="text-sm font-sans text-aubergine/40">Loading lab results...</span>
        </div>
      </div>
    )
  }

  if (labOrders.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-8 text-center">
        <svg className="w-10 h-10 text-aubergine/12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6v5.586a1 1 0 00.293.707l3.414 3.414a3 3 0 01.879 2.121V17a4 4 0 01-4 4H8.414a4 4 0 01-4-4v-2.172a3 3 0 01.879-2.121l3.414-3.414A1 1 0 009 8.586V3z" />
        </svg>
        <h3 className="font-serif text-lg text-aubergine mb-2">No lab results yet</h3>
        <p className="text-sm font-sans text-aubergine/40 max-w-sm mx-auto">
          When your provider orders lab work, your results will appear here once they&apos;re ready.
        </p>
      </div>
    )
  }

  const ordersWithResults = labOrders.filter((o) => o.status === 'results_available' && o.results)
  const pendingOrders = labOrders.filter((o) => o.status !== 'results_available')

  return (
    <div className="space-y-6">
      {/* Results available */}
      {ordersWithResults.length > 0 && (
        <div className="space-y-3">
          {ordersWithResults.map((order) => {
            const isExpanded = expandedId === order.id
            const partner = LAB_PARTNERS[order.lab_partner] || order.lab_partner
            const orderedDate = order.ordered_at
              ? new Date(order.ordered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : null
            const results = order.results || []
            const hasFlags = results.some((r) => r.flag && r.flag !== 'normal')

            return (
              <div key={order.id} className="bg-white rounded-card shadow-sm shadow-aubergine/5 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full text-left p-5 md:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="text-sm font-sans font-medium text-aubergine">{partner}</span>
                        <span className="text-xs font-sans px-2 py-0.5 rounded-pill border text-emerald-600 bg-emerald-50 border-emerald-200">
                          Results Ready
                        </span>
                        {hasFlags && (
                          <span className="text-xs font-sans px-2 py-0.5 rounded-pill border text-orange-600 bg-orange-50 border-orange-200">
                            Flagged
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {order.tests.map((t) => (
                          <span key={t.code} className="text-xs font-sans text-aubergine/40 bg-aubergine/[0.04] px-2 py-0.5 rounded-pill">
                            {t.name}
                          </span>
                        ))}
                      </div>
                      {orderedDate && (
                        <p className="text-xs font-sans text-aubergine/30">Ordered {orderedDate}</p>
                      )}
                    </div>
                    <svg
                      className={`w-4 h-4 text-aubergine/25 transition-transform flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
                    <div className="border-t border-aubergine/5 pt-4">
                      {/* Results table */}
                      <div className="space-y-0">
                        {/* Header row */}
                        <div className="hidden md:grid grid-cols-12 gap-3 pb-2 mb-1 border-b border-aubergine/5">
                          <span className="col-span-4 text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wider">Test</span>
                          <span className="col-span-2 text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wider text-right">Result</span>
                          <span className="col-span-3 text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wider text-right">Reference Range</span>
                          <span className="col-span-3 text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wider text-right">Status</span>
                        </div>

                        {results.map((r, i) => {
                          const flag = r.flag || 'normal'
                          const style = FLAG_STYLES[flag] || FLAG_STYLES.normal

                          return (
                            <div
                              key={i}
                              className={`grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-3 py-3 border-b border-aubergine/5 last:border-0 ${
                                flag !== 'normal' ? 'bg-orange-50/30 -mx-2 px-2 rounded-lg' : ''
                              }`}
                            >
                              {/* Test name */}
                              <div className="col-span-4">
                                <span className="text-xs font-sans font-medium text-aubergine/50 md:hidden">Test: </span>
                                <span className="text-sm font-sans text-aubergine">{r.testName}</span>
                                <span className="text-xs font-sans text-aubergine/30 ml-1.5">({r.testCode})</span>
                              </div>

                              {/* Value */}
                              <div className="col-span-2 md:text-right">
                                <span className="text-xs font-sans font-medium text-aubergine/50 md:hidden">Result: </span>
                                <span className={`text-sm font-sans font-semibold ${flag !== 'normal' ? style.text : 'text-aubergine'}`}>
                                  {r.value}
                                </span>
                                <span className="text-xs font-sans text-aubergine/30 ml-1">{r.unit}</span>
                              </div>

                              {/* Reference range */}
                              <div className="col-span-3 md:text-right">
                                <span className="text-xs font-sans font-medium text-aubergine/50 md:hidden">Range: </span>
                                <span className="text-xs font-sans text-aubergine/40">{r.referenceRange}</span>
                              </div>

                              {/* Flag */}
                              <div className="col-span-3 md:text-right">
                                <span className={`inline-block text-xs font-sans font-medium px-2 py-0.5 rounded-pill ${style.text} ${style.bg}`}>
                                  {style.label}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Footer note */}
                      <div className="mt-5 p-4 rounded-brand bg-violet/5 border border-violet/10">
                        <p className="text-xs font-sans text-violet/70 leading-relaxed">
                          These results have been reviewed by Dr. Urban. Flagged values are highlighted
                          for your awareness — they don&apos;t necessarily indicate a problem. Your provider
                          will discuss any findings during your next visit.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pending orders */}
      {pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wider px-1">
            Pending Orders
          </h4>
          {pendingOrders.map((order) => {
            const partner = LAB_PARTNERS[order.lab_partner] || order.lab_partner
            const st = STATUS_LABELS[order.status] || STATUS_LABELS.sent
            const orderedDate = order.ordered_at
              ? new Date(order.ordered_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : null

            return (
              <div key={order.id} className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="text-sm font-sans font-medium text-aubergine">{partner}</span>
                      <span className={`text-xs font-sans px-2 py-0.5 rounded-pill border ${st.style}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {order.tests.map((t) => (
                        <span key={t.code} className="text-xs font-sans text-aubergine/40 bg-aubergine/[0.04] px-2 py-0.5 rounded-pill">
                          {t.name}
                        </span>
                      ))}
                    </div>
                    {orderedDate && (
                      <p className="text-xs font-sans text-aubergine/30">Ordered {orderedDate}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-violet/5 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-violet/40 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
