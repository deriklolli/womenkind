'use client'

import { useState } from 'react'

interface Prescription {
  id: string
  medication_name: string
  dosage: string
  status: string
}

interface ScheduledTask {
  title: string
  dueAt: string
}

interface Props {
  patientId: string
  prescriptions: Prescription[]
  onClose: () => void
  onSuccess: () => void
}

type ChangeType = 'started' | 'dose_increased' | 'dose_decreased' | 'stopped' | 'formulation_changed'

const CHANGE_TYPES: { key: ChangeType; label: string }[] = [
  { key: 'started',             label: 'Started' },
  { key: 'dose_increased',      label: 'Dose increased' },
  { key: 'dose_decreased',      label: 'Dose decreased' },
  { key: 'stopped',             label: 'Stopped' },
  { key: 'formulation_changed', label: 'Formulation changed' },
]

const CREATES_TASKS: ChangeType[] = ['started', 'dose_increased', 'dose_decreased', 'formulation_changed']

export default function MedChangeModal({ patientId, prescriptions, onClose, onSuccess }: Props) {
  const active = prescriptions.filter(rx => rx.status === 'active')
  const [rxId, setRxId]             = useState(active[0]?.id ?? '')
  const [changeType, setChangeType] = useState<ChangeType>('dose_increased')
  const [newDosage, setNewDosage]   = useState('')
  const [reason, setReason]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [scheduled, setScheduled]   = useState<ScheduledTask[] | null>(null)

  const willCreateTasks = CREATES_TASKS.includes(changeType)

  async function handleSubmit() {
    if (!rxId) { setError('Select a medication.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/provider/patients/${patientId}/prescriptions/${rxId}/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_type: changeType, new_dosage: newDosage || undefined, reason: reason || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to record change')
      }
      const data = await res.json()
      setScheduled(data.scheduledTasks ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Confirmation screen
  if (scheduled !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-card shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
          <h2 className="text-lg font-sans font-semibold text-aubergine">Change recorded</h2>
          {scheduled.length > 0 && (
            <>
              <p className="text-sm font-sans text-aubergine/60">{scheduled.length} follow-up tasks scheduled:</p>
              <ul className="space-y-2">
                {scheduled.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs font-sans text-aubergine/70">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet/40 flex-shrink-0" />
                    <span>
                      {t.title}
                      <span className="ml-1 text-aubergine/40">
                        — {new Date(t.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            onClick={() => { onSuccess(); onClose() }}
            className="w-full py-2.5 text-sm font-sans font-semibold bg-aubergine text-white rounded-pill hover:bg-aubergine/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-card shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-sans font-semibold text-aubergine">Record Medication Change</h2>

        {active.length === 0 ? (
          <p className="text-sm font-sans text-aubergine/50">No active prescriptions for this patient.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">Medication</label>
              <select
                value={rxId}
                onChange={e => setRxId(e.target.value)}
                className="w-full border border-aubergine/15 rounded-lg px-3 py-2 text-sm font-sans text-aubergine"
              >
                {active.map(rx => (
                  <option key={rx.id} value={rx.id}>{rx.medication_name} — {rx.dosage}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-2">Change Type</label>
              <div className="flex flex-wrap gap-2">
                {CHANGE_TYPES.map(ct => (
                  <button
                    key={ct.key}
                    onClick={() => setChangeType(ct.key)}
                    className={`px-3 py-1.5 rounded-pill text-xs font-sans font-medium transition-colors ${
                      changeType === ct.key
                        ? 'bg-aubergine text-white'
                        : 'bg-aubergine/5 text-aubergine/60 hover:bg-aubergine/10'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {changeType !== 'stopped' && (
              <div>
                <label className="block text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">New Dosage</label>
                <input
                  value={newDosage}
                  onChange={e => setNewDosage(e.target.value)}
                  placeholder="e.g. 0.075mg patch"
                  className="w-full border border-aubergine/15 rounded-lg px-3 py-2 text-sm font-sans text-aubergine placeholder:text-aubergine/20"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">Reason</label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Optional"
                className="w-full border border-aubergine/15 rounded-lg px-3 py-2 text-sm font-sans text-aubergine placeholder:text-aubergine/20"
              />
            </div>

            {willCreateTasks && (
              <div className="bg-violet/5 border border-violet/15 rounded-lg px-4 py-3 text-xs font-sans text-violet">
                ✓ Will schedule: Day 4 · Week 4 · Week 8 · 12-week MD review · Annual review
              </div>
            )}

            {error && <p className="text-sm font-sans text-red-500">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 text-sm font-sans text-aubergine/50 hover:text-aubergine transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 text-sm font-sans font-semibold bg-aubergine text-white rounded-pill hover:bg-aubergine/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Confirm Change'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
