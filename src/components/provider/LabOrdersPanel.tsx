'use client'

import { useState } from 'react'
import { LAB_PANEL_TEMPLATES } from '@/lib/canvas-client'

interface LabOrder {
  id: string
  lab_partner: string
  tests: { code: string; name: string }[]
  clinical_indication: string
  status: string
  results: any | null
  ordered_at: string | null
  created_at: string
}

interface LabOrdersPanelProps {
  patientId: string
  providerId: string
  labOrders: LabOrder[]
  onLabOrderSent: () => void
}

const STATUS_STYLES: Record<string, { label: string; style: string }> = {
  draft: { label: 'Draft', style: 'text-aubergine/40 bg-gray-50 border-gray-200' },
  signed: { label: 'Signed', style: 'text-amber-600 bg-amber-50 border-amber-200' },
  sent: { label: 'Sent', style: 'text-violet bg-violet/5 border-violet/20' },
  collected: { label: 'Collected', style: 'text-violet bg-violet/10 border-violet/25' },
  results_available: { label: 'Results Available', style: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
}

const LAB_PARTNERS = [
  { value: 'quest', label: 'Quest Diagnostics' },
  { value: 'labcorp', label: 'Labcorp' },
]

export default function LabOrdersPanel({
  patientId,
  providerId,
  labOrders,
  onLabOrderSent,
}: LabOrdersPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [expandedResults, setExpandedResults] = useState<string | null>(null)

  // Form state
  const [labPartner, setLabPartner] = useState('quest')
  const [selectedTests, setSelectedTests] = useState<{ code: string; name: string }[]>([])
  const [clinicalIndication, setClinicalIndication] = useState('')

  const resetForm = () => {
    setLabPartner('quest')
    setSelectedTests([])
    setClinicalIndication('')
    setSent(false)
  }

  const applyTemplate = (template: typeof LAB_PANEL_TEMPLATES[0]) => {
    // Merge tests — avoid duplicates
    const existing = new Set(selectedTests.map((t) => t.code))
    const newTests = [...selectedTests, ...template.tests.filter((t) => !existing.has(t.code))]
    setSelectedTests(newTests)
    if (!clinicalIndication) setClinicalIndication(template.indication)
    setShowForm(true)
  }

  const removeTest = (code: string) => {
    setSelectedTests(selectedTests.filter((t) => t.code !== code))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedTests.length === 0) return

    setSending(true)
    try {
      const res = await fetch('/api/canvas/labs/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          providerId,
          labPartner,
          tests: selectedTests,
          clinicalIndication,
        }),
      })

      if (!res.ok) throw new Error('Failed to send lab order')

      setSent(true)
      setTimeout(() => {
        setShowForm(false)
        resetForm()
        onLabOrderSent()
      }, 1500)
    } catch (err) {
      console.error('Failed to order labs:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + New button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-sans font-medium text-aubergine flex items-center gap-2">
            <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Lab Orders
          </h3>
          <p className="text-xs font-sans text-aubergine/40 mt-0.5">{labOrders.length} on file</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="text-sm font-sans font-medium text-white bg-violet hover:bg-violet-dark px-4 py-2 rounded-brand shadow-sm transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Order Labs
          </button>
        )}
      </div>

      {/* New Lab Order Form */}
      {showForm && (
        <div className="bg-white rounded-card p-6 shadow-sm border border-violet/15">
          <h4 className="font-sans font-medium text-sm text-aubergine mb-4">New Lab Order</h4>

          {/* Panel templates */}
          <div className="mb-5">
            <p className="text-xs font-sans font-medium text-aubergine/40 mb-2">Common panels</p>
            <div className="flex flex-wrap gap-1.5">
              {LAB_PANEL_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t)}
                  className="text-xs font-sans text-violet bg-violet/5 hover:bg-violet/10 px-2.5 py-1 rounded-pill border border-violet/15 transition-colors"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Lab partner */}
            <div>
              <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Lab Partner</label>
              <div className="flex gap-2">
                {LAB_PARTNERS.map((lp) => (
                  <button
                    key={lp.value}
                    type="button"
                    onClick={() => setLabPartner(lp.value)}
                    className={`px-4 py-2 rounded-brand text-sm font-sans font-medium border transition-all ${
                      labPartner === lp.value
                        ? 'border-violet bg-violet/5 text-violet'
                        : 'border-aubergine/10 text-aubergine/40 hover:border-aubergine/20'
                    }`}
                  >
                    {lp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected tests */}
            <div>
              <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">
                Selected Tests ({selectedTests.length})
              </label>
              {selectedTests.length === 0 ? (
                <p className="text-xs font-sans text-aubergine/25 py-3">
                  Select a panel above or add individual tests
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTests.map((t) => (
                    <span
                      key={t.code}
                      className="text-xs font-sans text-aubergine bg-aubergine/5 px-2.5 py-1 rounded-pill border border-aubergine/10 flex items-center gap-1.5"
                    >
                      <span className="font-medium">{t.code}</span>
                      <span className="text-aubergine/40">{t.name}</span>
                      <button
                        type="button"
                        onClick={() => removeTest(t.code)}
                        className="text-aubergine/30 hover:text-red-500 transition-colors ml-0.5"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Clinical indication */}
            <div>
              <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Clinical Indication</label>
              <input
                type="text"
                value={clinicalIndication}
                onChange={(e) => setClinicalIndication(e.target.value)}
                placeholder="e.g., Menopausal status evaluation"
                className="w-full px-3 py-2 rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine placeholder:text-aubergine/25 focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={sending || sent || selectedTests.length === 0}
                className={`px-5 py-2.5 rounded-brand text-sm font-sans font-semibold transition-all shadow-sm flex items-center gap-2 ${
                  sent
                    ? 'bg-emerald-500 text-white'
                    : 'bg-violet text-white hover:bg-violet-dark disabled:opacity-50'
                }`}
              >
                {sent ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Sent to {LAB_PARTNERS.find((l) => l.value === labPartner)?.label}
                  </>
                ) : sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Sign &amp; Send Order
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2.5 rounded-brand text-sm font-sans font-medium text-aubergine/50 hover:text-aubergine hover:bg-aubergine/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lab Order History */}
      {labOrders.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-white rounded-card shadow-sm border border-aubergine/5">
          <svg className="w-8 h-8 text-aubergine/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <p className="text-sm font-sans text-aubergine/30">No lab orders yet</p>
          <p className="text-xs font-sans text-aubergine/20 mt-1">Click &ldquo;Order Labs&rdquo; to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {labOrders.map((order) => {
            const st = STATUS_STYLES[order.status] || STATUS_STYLES.draft
            const partner = LAB_PARTNERS.find((l) => l.value === order.lab_partner)?.label || order.lab_partner
            const hasResults = order.status === 'results_available' && order.results
            const isExpanded = expandedResults === order.id

            return (
              <div
                key={order.id}
                className="bg-white rounded-card shadow-sm border border-aubergine/5"
              >
                <button
                  onClick={() => hasResults && setExpandedResults(isExpanded ? null : order.id)}
                  className={`w-full text-left p-4 ${hasResults ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-sans font-medium text-aubergine">{partner}</h4>
                        <span className={`text-xs font-sans px-2 py-0.5 rounded-pill border flex-shrink-0 ${st.style}`}>
                          {st.label}
                        </span>
                        {hasResults && (
                          <svg
                            className={`w-3.5 h-3.5 text-aubergine/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {order.tests.map((t: any) => (
                          <span key={t.code} className="text-xs font-sans text-aubergine/40 bg-aubergine/5 px-2 py-0.5 rounded-pill">
                            {t.code}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-sans text-aubergine/30">
                        {order.clinical_indication && <span>{order.clinical_indication}</span>}
                        {order.ordered_at && (
                          <span>
                            Ordered {new Date(order.ordered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded results */}
                {isExpanded && hasResults && (
                  <div className="px-4 pb-4 pt-1 border-t border-aubergine/5">
                    <p className="text-xs font-sans font-medium text-aubergine/50 mb-2">Results</p>
                    <div className="space-y-1">
                      {(Array.isArray(order.results) ? order.results : []).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-1.5 border-b border-aubergine/5 last:border-0">
                          <span className="text-xs font-sans font-medium text-aubergine w-12">{r.testCode}</span>
                          <span className="text-xs font-sans text-aubergine/60 flex-1">{r.testName}</span>
                          <span className={`text-xs font-sans font-semibold ${
                            r.flag === 'critical' ? 'text-red-600' :
                            r.flag === 'high' ? 'text-orange-600' :
                            r.flag === 'low' ? 'text-amber-600' : 'text-aubergine'
                          }`}>
                            {r.value} {r.unit}
                          </span>
                          <span className="text-xs font-sans text-aubergine/30 w-28 text-right">{r.referenceRange}</span>
                          {r.flag && r.flag !== 'normal' && (
                            <span className={`text-xs font-sans px-1.5 py-0.5 rounded-pill ${
                              r.flag === 'critical' ? 'text-red-600 bg-red-50' :
                              r.flag === 'high' ? 'text-orange-600 bg-orange-50' :
                              'text-amber-600 bg-amber-50'
                            }`}>
                              {r.flag.toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
