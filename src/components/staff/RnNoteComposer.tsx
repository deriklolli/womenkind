'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  taskId?: string
  onSubmit: (data: RnNoteData) => Promise<void>
}

interface RnNoteData {
  patient_id: string
  task_id?: string
  note: string
  disposition: string
  backup_owner_staff_id?: string
  protocol_name?: string
  closeout_what_was_done?: string
}

type Disposition = {
  key: string
  label: string
  description: string
  color: string
  needsBackup?: boolean
  needsProtocol?: boolean
}

const DISPOSITIONS: Disposition[] = [
  { key: 'fyi',                  label: 'FYI',                 description: 'Log for info — no action needed',   color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  { key: 'patient_contacted',    label: 'Patient Contacted',    description: 'Spoke with patient, follow-up set',  color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { key: 'needs_md_review',      label: 'Needs MD Review',      description: 'Non-urgent — MD to review',          color: 'bg-orange-100 text-orange-700 hover:bg-orange-200', needsBackup: true },
  { key: 'same_day_md_review',   label: 'Same-Day MD Review',   description: 'Urgent — MD must review today',      color: 'bg-red-100 text-red-700 hover:bg-red-200', needsBackup: true },
  { key: 'unable_to_reach',      label: 'Unable to Reach',      description: 'Could not reach patient',           color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
  { key: 'resolved_by_protocol', label: 'Resolved by Protocol', description: 'Handled per practice protocol',     color: 'bg-green-100 text-green-700 hover:bg-green-200', needsProtocol: true },
  { key: 'service_issue',        label: 'Service Issue',        description: 'Route to admin/concierge',          color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
]

export function RnNoteComposer({ patientId, taskId, onSubmit }: Props) {
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<Disposition | null>(null)
  const [backupOwner, setBackupOwner] = useState('')
  const [protocolName, setProtocolName] = useState('')
  const [whatWasDone, setWhatWasDone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (!note || !selected) { setError('Note and disposition are required.'); return }
    if (selected.needsBackup && !backupOwner) { setError('Backup owner required for this disposition.'); return }
    if (selected.needsProtocol && (!protocolName || !whatWasDone)) { setError('Protocol name and what was done are required.'); return }

    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        patient_id: patientId,
        task_id: taskId,
        note,
        disposition: selected.key,
        backup_owner_staff_id: backupOwner || undefined,
        protocol_name: protocolName || undefined,
        closeout_what_was_done: whatWasDone || undefined,
      })
      setNote('')
      setSelected(null)
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit note')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">RN Note</h3>

      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Enter note..."
        className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-24"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {DISPOSITIONS.map(d => (
          <button
            key={d.key}
            onClick={() => setSelected(d)}
            className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-all border-2 ${
              selected?.key === d.key ? 'border-gray-800' : 'border-transparent'
            } ${d.color}`}
          >
            <div className="font-semibold">{d.label}</div>
            <div className="text-xs opacity-75 mt-0.5">{d.description}</div>
          </button>
        ))}
      </div>

      {selected?.needsBackup && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Backup owner (MD) ID *</label>
          <input value={backupOwner} onChange={e => setBackupOwner(e.target.value)}
            placeholder="Provider UUID" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      )}

      {selected?.needsProtocol && (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Protocol name *</label>
            <input value={protocolName} onChange={e => setProtocolName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">What was done *</label>
            <textarea value={whatWasDone} onChange={e => setWhatWasDone(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-16" />
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {submitted && <p className="text-sm text-green-600">Note submitted.</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || !selected || !note}
        className="w-full py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
      >
        {submitting ? 'Submitting...' : `Submit — ${selected?.label ?? 'select disposition'}`}
      </button>
    </div>
  )
}
