'use client'

import { useState } from 'react'
import { PRESCRIPTION_TEMPLATES } from '@/lib/canvas-client'

interface Prescription {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  quantity: number
  refills: number
  pharmacy: string
  status: string
  prescribed_at: string | null
  created_at: string
}

interface PrescriptionsPanelProps {
  patientId: string
  providerId: string
  prescriptions: Prescription[]
  onPrescriptionSent: () => void
}

const STATUS_STYLES: Record<string, { label: string; style: string }> = {
  draft: { label: 'Draft', style: 'text-aubergine/40 bg-gray-50 border-gray-200' },
  signed: { label: 'Signed', style: 'text-amber-600 bg-amber-50 border-amber-200' },
  sent: { label: 'Sent', style: 'text-violet bg-violet/5 border-violet/20' },
  filled: { label: 'Filled', style: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
}

const CATEGORY_ORDER = ['MHT', 'GSM', 'Non-hormonal']

export default function PrescriptionsPanel({
  patientId,
  providerId,
  prescriptions,
  onPrescriptionSent,
}: PrescriptionsPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // Form state
  const [medicationName, setMedicationName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('')
  const [quantity, setQuantity] = useState(30)
  const [refills, setRefills] = useState(3)
  const [pharmacy, setPharmacy] = useState('')

  const resetForm = () => {
    setMedicationName('')
    setDosage('')
    setFrequency('')
    setQuantity(30)
    setRefills(3)
    setPharmacy('')
    setSent(false)
  }

  const applyTemplate = (template: typeof PRESCRIPTION_TEMPLATES[0]) => {
    setMedicationName(template.medicationName)
    setDosage(template.dosage)
    setFrequency(template.frequency)
    setQuantity(template.quantity)
    setRefills(template.refills)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!medicationName || !dosage || !frequency) return

    setSending(true)
    try {
      const res = await fetch('/api/canvas/prescribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          providerId,
          medicationName,
          dosage,
          frequency,
          quantity,
          refills,
          pharmacy,
        }),
      })

      if (!res.ok) throw new Error('Failed to send prescription')

      setSent(true)
      setTimeout(() => {
        setShowForm(false)
        resetForm()
        onPrescriptionSent()
      }, 1500)
    } catch (err) {
      console.error('Failed to prescribe:', err)
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Prescriptions
          </h3>
          <p className="text-xs font-sans text-aubergine/40 mt-0.5">{prescriptions.length} on file</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="text-sm font-sans font-medium text-white bg-violet hover:bg-violet-dark px-4 py-2 rounded-brand shadow-sm transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Prescription
          </button>
        )}
      </div>

      {/* New Prescription Form */}
      {showForm && (
        <div className="bg-white rounded-card p-6 shadow-sm border border-violet/15">
          <h4 className="font-sans font-medium text-sm text-aubergine mb-4">New Prescription</h4>

          {/* Quick-pick templates */}
          <div className="mb-5">
            <p className="text-xs font-sans font-medium text-aubergine/40 mb-2">Quick-pick templates</p>
            <div className="space-y-2">
              {CATEGORY_ORDER.map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-sans text-aubergine/30 mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESCRIPTION_TEMPLATES.filter((t) => t.category === cat).map((t) => (
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
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Medication</label>
                <input
                  type="text"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  placeholder="e.g., Estradiol transdermal patch"
                  required
                  className="w-full px-3 py-2 rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine placeholder:text-aubergine/25 focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10"
                />
              </div>
              <div>
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Dosage</label>
                <input
                  type="text"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g., 0.05 mg/day"
                  required
                  className="w-full px-3 py-2 rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine placeholder:text-aubergine/25 focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10"
                />
              </div>
              <div>
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Frequency</label>
                <input
                  type="text"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  placeholder="e.g., Apply twice weekly"
                  required
                  className="w-full px-3 py-2 rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine placeholder:text-aubergine/25 focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10"
                />
              </div>
              <div>
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  min={1}
                  className="w-full px-3 py-2 rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10"
                />
              </div>
              <div>
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Refills</label>
                <input
                  type="number"
                  value={refills}
                  onChange={(e) => setRefills(parseInt(e.target.value) || 0)}
                  min={0}
                  max={12}
                  className="w-full px-3 py-2 rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Pharmacy</label>
                <input
                  type="text"
                  value={pharmacy}
                  onChange={(e) => setPharmacy(e.target.value)}
                  placeholder="e.g., CVS Pharmacy — 123 Main St"
                  className="w-full px-3 py-2 rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine placeholder:text-aubergine/25 focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={sending || sent || !medicationName || !dosage || !frequency}
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
                    Sent to Pharmacy
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
                    Sign &amp; Send
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

      {/* Prescription History */}
      {prescriptions.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-white rounded-card shadow-sm border border-aubergine/5">
          <svg className="w-8 h-8 text-aubergine/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <p className="text-sm font-sans text-aubergine/30">No prescriptions yet</p>
          <p className="text-xs font-sans text-aubergine/20 mt-1">Click &ldquo;New Prescription&rdquo; to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prescriptions.map((rx) => {
            const st = STATUS_STYLES[rx.status] || STATUS_STYLES.draft
            return (
              <div
                key={rx.id}
                className="bg-white rounded-card p-4 shadow-sm border border-aubergine/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-sans font-medium text-aubergine truncate">{rx.medication_name}</h4>
                      <span className={`text-xs font-sans px-2 py-0.5 rounded-pill border flex-shrink-0 ${st.style}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs font-sans text-aubergine/50">
                      {rx.dosage} — {rx.frequency}
                    </p>
                    <div className="flex items-center gap-4 mt-1.5 text-xs font-sans text-aubergine/30">
                      <span>Qty: {rx.quantity}</span>
                      <span>Refills: {rx.refills}</span>
                      {rx.pharmacy && <span>{rx.pharmacy}</span>}
                      {rx.prescribed_at && (
                        <span>
                          {new Date(rx.prescribed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
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
