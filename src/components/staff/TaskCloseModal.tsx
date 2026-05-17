'use client'

import { useState } from 'react'
import type { Task } from './TaskQueue'

interface Props {
  task: Task
  staffRole: string
  onClose: () => void
  onSubmit: (closeout: CloseoutData) => Promise<void>
}

export interface CloseoutData {
  closeout_what_was_done: string
  closeout_plan: string
  closeout_followup_who: string
  closeout_followup_when: string
  closeout_followup_how: string
  closeout_safety_open: boolean
  patient_notified: boolean
  follow_up_task_id?: string
  closeout_no_followup_reason?: string
}

export function TaskCloseModal({ task, staffRole, onClose, onSubmit }: Props) {
  const [whatWasDone, setWhatWasDone] = useState('')
  const [plan, setPlan] = useState('')
  const [followupWho, setFollowupWho] = useState('')
  const [followupWhen, setFollowupWhen] = useState('')
  const [followupHow, setFollowupHow] = useState('portal_message')
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [notified, setNotified] = useState(false)
  const [noFollowup, setNoFollowup] = useState(false)
  const [noFollowupReason, setNoFollowupReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canClose = ['md', 'np'].includes(staffRole)
  const needsMdSignoff = task.requires_md_signoff && !canClose

  async function handleSubmit() {
    if (!whatWasDone || !plan) { setError('What was done and plan are required.'); return }
    if (safetyOpen) { setError('Cannot close — safety issue is still open.'); return }
    if (!noFollowup && !followupWho) { setError('Specify follow-up details or mark no follow-up needed.'); return }

    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        closeout_what_was_done: whatWasDone,
        closeout_plan: plan,
        closeout_followup_who: followupWho,
        closeout_followup_when: followupWhen,
        closeout_followup_how: followupHow,
        closeout_safety_open: safetyOpen,
        patient_notified: notified,
        closeout_no_followup_reason: noFollowup ? noFollowupReason : undefined,
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to close task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900">Close Task</h2>
        <p className="text-sm text-gray-500">{task.title}</p>

        {needsMdSignoff && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            This task requires MD or NP sign-off. Escalate to your supervisor to close.
          </div>
        )}

        {!needsMdSignoff && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">What was done *</label>
              <textarea value={whatWasDone} onChange={e => setWhatWasDone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-20" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Plan going forward *</label>
              <textarea value={plan} onChange={e => setPlan(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-20" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={noFollowup} onChange={e => setNoFollowup(e.target.checked)} />
                <span className="text-sm text-gray-700">No follow-up needed</span>
              </label>
            </div>

            {noFollowup ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reason</label>
                <input value={noFollowupReason} onChange={e => setNoFollowupReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-up: when</label>
                  <input type="datetime-local" value={followupWhen} onChange={e => setFollowupWhen(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">How</label>
                  <select value={followupHow} onChange={e => setFollowupHow(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="portal_message">Portal message</option>
                    <option value="call">Phone call</option>
                    <option value="email">Email</option>
                    <option value="text">Text</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={notified} onChange={e => setNotified(e.target.checked)} />
                <span className="text-sm text-gray-700">Patient notified</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={safetyOpen} onChange={e => setSafetyOpen(e.target.checked)} />
                <span className="text-sm text-red-600">Safety issue still open</span>
              </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || safetyOpen}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Closing...' : 'Close Task'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
