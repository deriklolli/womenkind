'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  onClose: () => void
  onSubmit: (data: SbarData) => Promise<void>
}

export interface SbarData {
  patient_id: string
  situation: string
  background: string
  assessment: string
  recommendation: string
  priority: 'orange' | 'red'
  backup_owner_staff_id: string
}

export function SbarModal({ patientId, onClose, onSubmit }: Props) {
  const [situation, setSituation] = useState('')
  const [background, setBackground] = useState('')
  const [assessment, setAssessment] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [priority, setPriority] = useState<'orange' | 'red'>('orange')
  const [backupOwner, setBackupOwner] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!situation || !backupOwner) {
      setError('Situation and backup owner are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ patient_id: patientId, situation, background, assessment, recommendation, priority, backup_owner_staff_id: backupOwner })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit SBAR')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900">SBAR Escalation</h2>

        {[
          { label: 'S — Situation *', value: situation, set: setSituation },
          { label: 'B — Background', value: background, set: setBackground },
          { label: 'A — Assessment', value: assessment, set: setAssessment },
          { label: 'R — Recommendation', value: recommendation, set: setRecommendation },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
            <textarea value={value} onChange={e => set(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-20" />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Priority *</label>
            <select value={priority} onChange={e => setPriority(e.target.value as 'orange' | 'red')}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="orange">Urgent (orange)</option>
              <option value="red">Emergency (red)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Backup owner ID *</label>
            <input value={backupOwner} onChange={e => setBackupOwner(e.target.value)}
              placeholder="Provider UUID" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit SBAR'}
          </button>
        </div>
      </div>
    </div>
  )
}
