'use client'

import { useEffect, useState } from 'react'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
import { TaskCloseModal, CloseoutData } from '@/components/staff/TaskCloseModal'
import { RnNoteComposer, RnNoteData } from '@/components/staff/RnNoteComposer'
import { SbarModal, SbarData } from '@/components/staff/SbarModal'

export default function RnQueuePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [closeTask, setCloseTask] = useState<Task | null>(null)
  const [sbarPatientId, setSbarPatientId] = useState<string | null>(null)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/staff/rn-queue')
      .then(r => r.json())
      .then(data => setTasks(data.tasks ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function acknowledge(taskId: string) {
    await fetch(`/api/provider/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    })
    setTasks(q => q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t))
  }

  async function handleClose(closeout: CloseoutData) {
    if (!closeTask) return
    const res = await fetch(`/api/provider/tasks/${closeTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed', ...closeout }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to close task')
    }
    setTasks(q => q.filter(t => t.id !== closeTask.id))
    setCloseTask(null)
  }

  async function handleRnNote(data: RnNoteData) {
    const res = await fetch('/api/staff/rn-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to submit note')
    }
  }

  async function handleSbar(data: SbarData) {
    const res = await fetch('/api/staff/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to escalate')
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  const uniquePatients = Array.from(new Set(tasks.map(t => t.patient_id)))

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">RN Queue</h1>
        <span className="text-sm text-gray-400">{tasks.length} open</span>
      </div>

      <TaskQueue tasks={tasks} onAcknowledge={acknowledge} onClose={setCloseTask} />

      {tasks.length > 0 && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Write note for patient</label>
            <select
              value={selectedPatientId ?? ''}
              onChange={e => setSelectedPatientId(e.target.value || null)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select patient...</option>
              {uniquePatients.map(pid => (
                <option key={pid} value={pid}>{pid.slice(0, 8)}</option>
              ))}
            </select>
          </div>

          {selectedPatientId && (
            <div className="space-y-3">
              <RnNoteComposer patientId={selectedPatientId} onSubmit={handleRnNote} />
              <button
                onClick={() => setSbarPatientId(selectedPatientId)}
                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
              >
                + Escalate via SBAR
              </button>
            </div>
          )}
        </div>
      )}

      {closeTask && (
        <TaskCloseModal
          task={closeTask}
          staffRole="rn"
          onClose={() => setCloseTask(null)}
          onSubmit={handleClose}
        />
      )}

      {sbarPatientId && (
        <SbarModal
          patientId={sbarPatientId}
          onClose={() => setSbarPatientId(null)}
          onSubmit={handleSbar}
        />
      )}
    </div>
  )
}
