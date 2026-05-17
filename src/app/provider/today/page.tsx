'use client'

import { useEffect, useState } from 'react'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
import { TaskCloseModal, CloseoutData } from '@/components/staff/TaskCloseModal'
import { OutcomesWatchQueue } from '@/components/staff/OutcomesWatchQueue'

interface CommandBar {
  red: number
  mdDecisions: number
  rnEscalations: number
  labsPending: number
  medFollowups: number
  overdue: number
  messagesOverSla: number
  outcomesWatch: number
}

const TILES = [
  { key: 'red',           label: 'Red MD Today',    color: 'bg-red-50 border-red-200 text-red-700',         large: true },
  { key: 'mdDecisions',   label: 'MD Decisions',    color: 'bg-orange-50 border-orange-200 text-orange-700', large: true },
  { key: 'rnEscalations', label: 'RN Escalations',  color: 'bg-purple-50 border-purple-200 text-purple-700', large: true },
  { key: 'labsPending',   label: 'Labs Pending',    color: 'bg-orange-50 border-orange-100 text-orange-600', large: false },
  { key: 'medFollowups',  label: 'Med Follow-Ups',  color: 'bg-blue-50 border-blue-200 text-blue-700',       large: false },
  { key: 'overdue',       label: 'Overdue',         color: 'bg-yellow-50 border-yellow-200 text-yellow-700', large: false },
  { key: 'messagesOverSla', label: 'Messages > SLA', color: 'bg-orange-50 border-orange-100 text-orange-600', large: false },
  { key: 'outcomesWatch', label: 'Outcomes Watch',  color: 'bg-green-50 border-green-200 text-green-700',    large: false },
]

export default function MDTodayPage() {
  const [bar, setBar] = useState<CommandBar | null>(null)
  const [queue, setQueue] = useState<Task[]>([])
  const [closeTask, setCloseTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/provider/today')
      .then(r => r.json())
      .then(data => {
        setBar(data.commandBar)
        setQueue(data.priorityQueue ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  async function acknowledge(taskId: string) {
    await fetch(`/api/provider/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    })
    setQueue(q => q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t))
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
    setQueue(q => q.filter(t => t.id !== closeTask.id))
    setCloseTask(null)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  const largeTiles = TILES.filter(t => t.large)
  const smallTiles = TILES.filter(t => !t.large)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">MD Today</h1>

      {/* Large tiles — row 1 */}
      <div className="grid grid-cols-3 gap-4">
        {largeTiles.map(tile => (
          <div key={tile.key} className={`rounded-xl border p-5 text-center ${tile.color}`}>
            <div className="text-3xl font-bold">{bar?.[tile.key as keyof CommandBar] ?? 0}</div>
            <div className="text-xs mt-1">{tile.label}</div>
          </div>
        ))}
      </div>

      {/* Small tiles — row 2 (6 + 1 placeholder) */}
      <div className="grid grid-cols-6 gap-3">
        {smallTiles.map(tile => (
          <div key={tile.key} className={`rounded-xl border p-3 text-center ${tile.color}`}>
            <div className="text-xl font-bold">{bar?.[tile.key as keyof CommandBar] ?? 0}</div>
            <div className="text-xs mt-0.5 leading-tight">{tile.label}</div>
          </div>
        ))}
        <div className="rounded-xl border p-3 text-center bg-gray-50 border-gray-200 text-gray-400">
          <div className="text-xl font-bold">—</div>
          <div className="text-xs mt-0.5 leading-tight">Service Recovery</div>
        </div>
      </div>

      {/* Priority queue */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Patient Priority Queue
        </h2>
        <TaskQueue
          tasks={queue}
          onAcknowledge={acknowledge}
          onClose={setCloseTask}
        />
      </div>

      <OutcomesWatchQueue />

      {closeTask && (
        <TaskCloseModal
          task={closeTask}
          staffRole="md"
          onClose={() => setCloseTask(null)}
          onSubmit={handleClose}
        />
      )}
    </div>
  )
}
