'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  prescriptionId: string
  medicationName: string
  currentDosage: string
  onClose: () => void
  onSuccess: () => void
}

const CHANGE_TYPES = [
  { value: 'started',             label: 'Started' },
  { value: 'dose_increased',      label: 'Dose increased' },
  { value: 'dose_decreased',      label: 'Dose decreased' },
  { value: 'stopped',             label: 'Stopped' },
  { value: 'formulation_changed', label: 'Formulation changed' },
  { value: 'refill_authorized',   label: 'Refill authorized' },
]

const CADENCE_TYPES = new Set(['started', 'dose_increased', 'dose_decreased', 'formulation_changed'])

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function MedChangeModal({
  patientId, prescriptionId, medicationName, currentDosage, onClose, onSuccess,
}: Props) {
  const [changeType, setChangeType] = useState('')
  const [newDosage, setNewDosage] = useState(currentDosage)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ scheduledTasks: Array<{ title: string; dueAt: string }> } | null>(null)

  const showsCadence = CADENCE_TYPES.has(changeType)

  async function handleSubmit() {
    if (!changeType) { setError('Select a change type.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(
        `/api/provider/patients/${patientId}/prescriptions/${prescriptionId}/change`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            change_type: changeType,
            new_dosage: newDosage || undefined,
            reason: reason || undefined,
          }),
        },
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to record change')
      }
      const data = await res.json()
      setResult(data)
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record change')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-aubergine">Change recorded</h2>
          {result.scheduledTasks.length > 0 && (
            <>
              <p className="text-sm text-aubergine/60">{result.scheduledTasks.length} follow-up tasks scheduled:</p>
              <ul className="space-y-1">
                {result.scheduledTasks.map((t, i) => (
                  <li key={i} className="text-xs text-aubergine/70 flex gap-2">
                    <span className="text-aubergine/30">·</span>
                    <span className="flex-1">{t.title}</span>
                    <span className="text-aubergine/40 flex-shrink-0">
                      {new Date(t.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            onClick={onClose}
            className="w-full py-2 text-sm bg-aubergine text-white rounded-lg hover:bg-aubergine/90"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-aubergine">Record medication change</h2>
        <p className="text-sm text-aubergine/50">{medicationName}</p>

        <div>
          <label className="block text-xs font-semibold text-aubergine/50 mb-1">Change type *</label>
          <select
            value={changeType}
            onChange={e => setChangeType(e.target.value)}
            className="w-full border border-aubergine/10 rounded-lg px-3 py-2 text-sm text-aubergine focus:outline-none focus:ring-2 focus:ring-violet/30"
          >
            <option value="">Select...</option>
            {CHANGE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {changeType !== 'stopped' && (
          <div>
            <label className="block text-xs font-semibold text-aubergine/50 mb-1">New dosage</label>
            <input
              value={newDosage}
              onChange={e => setNewDosage(e.target.value)}
              className="w-full border border-aubergine/10 rounded-lg px-3 py-2 text-sm text-aubergine focus:outline-none focus:ring-2 focus:ring-violet/30"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-aubergine/50 mb-1">Reason (optional)</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. inadequate response, side effect..."
            className="w-full border border-aubergine/10 rounded-lg px-3 py-2 text-sm text-aubergine focus:outline-none focus:ring-2 focus:ring-violet/30"
          />
        </div>

        {showsCadence && changeType && (
          <div className="bg-violet/5 rounded-lg px-3 py-2 text-xs text-aubergine/60 space-y-0.5">
            <p className="font-semibold text-aubergine/50 mb-1">5 follow-up tasks will be scheduled:</p>
            <p>· Confirm patient obtained med — {addDays(4)}</p>
            <p>· 4-week check-in — {addDays(28)}</p>
            <p>· 8-week trend review — {addDays(56)}</p>
            <p>· 12-week response review — {addDays(84)}</p>
            <p>· Annual benefit/risk — {addDays(365)}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-aubergine/60 hover:text-aubergine">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !changeType}
            className="px-4 py-2 text-sm bg-aubergine text-white rounded-lg hover:bg-aubergine/90 disabled:opacity-50"
          >
            {submitting ? 'Recording...' : 'Record change'}
          </button>
        </div>
      </div>
    </div>
  )
}
