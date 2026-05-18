'use client'

import { useEffect, useState } from 'react'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
import { TaskCloseModal } from '@/components/staff/TaskCloseModal'
import ProviderNav from '@/components/provider/ProviderNav'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [closeTask, setCloseTask] = useState<Task | null>(null)
  const [staffRole, setStaffRole] = useState('md')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d?.staffRole) setStaffRole(d.staffRole) }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/provider/tasks?open=true')
      .then(r => r.json())
      .then(data => setTasks(data.tasks ?? []))
      .finally(() => setLoading(false))
  }, [])

  function acknowledge(taskId: string) {
    fetch(`/api/provider/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    })
    setTasks(q => q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t))
  }

  async function handleClose(closeout: any) {
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

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif font-normal text-3xl text-aubergine tracking-tight">Clinical Tasks</h1>
            <p className="text-sm font-sans text-aubergine/40 mt-1">{tasks.length} open</p>
          </div>
        </div>

        <div className="bg-white rounded-card shadow-sm border border-aubergine/5">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-sm font-sans text-aubergine/30">No open tasks — queue is clear.</p>
            </div>
          ) : (
            <TaskQueue
              tasks={tasks}
              onAcknowledge={acknowledge}
              onClose={setCloseTask}
            />
          )}
        </div>
      </div>

      {closeTask && (
        <TaskCloseModal
          task={closeTask}
          staffRole={staffRole}
          onClose={() => setCloseTask(null)}
          onSubmit={handleClose}
        />
      )}
    </div>
  )
}
