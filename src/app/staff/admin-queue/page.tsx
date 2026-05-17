'use client'

import { useEffect, useState } from 'react'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
import { TaskCloseModal, CloseoutData } from '@/components/staff/TaskCloseModal'

export default function AdminQueuePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [closeTask, setCloseTask] = useState<Task | null>(null)

  useEffect(() => {
    fetch('/api/staff/admin-queue')
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

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Queue</h1>
        <span className="text-sm text-gray-400">{tasks.length} open</span>
      </div>

      <TaskQueue tasks={tasks} onAcknowledge={acknowledge} onClose={setCloseTask} />

      {closeTask && (
        <TaskCloseModal
          task={closeTask}
          staffRole="admin"
          onClose={() => setCloseTask(null)}
          onSubmit={handleClose}
        />
      )}
    </div>
  )
}
