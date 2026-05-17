'use client'

import { useEffect, useState } from 'react'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
import { TaskCloseModal } from '@/components/staff/TaskCloseModal'
import ProviderNav from '@/components/provider/ProviderNav'

interface Section {
  key: string
  label: string
  dotColor: string
  tasks: Task[]
  expanded: boolean
}

function buildSections(tasks: Task[]): Section[] {
  const urgent   = tasks.filter(t => t.priority === 'red')
  const mdReview = tasks.filter(t => t.priority === 'orange')
  const lower    = tasks.filter(t => t.priority === 'yellow' || t.priority === 'blue' || t.priority === 'gray')
  return [
    { key: 'urgent',   label: 'Urgent',        dotColor: '#dc2626', tasks: urgent,   expanded: true },
    { key: 'md',       label: 'MD Decisions',  dotColor: '#f97316', tasks: mdReview, expanded: true },
    { key: 'lower',    label: 'Lower Priority', dotColor: '#eab308', tasks: lower,   expanded: true },
  ]
}

export default function TasksPage() {
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [closeTask, setCloseTask] = useState<Task | null>(null)
  const [staffRole, setStaffRole] = useState('md')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    urgent: true, md: true, lower: true,
  })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d?.staffRole) setStaffRole(d.staffRole) }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/provider/tasks?open=true')
      .then(r => r.json())
      .then(data => {
        const tasks: Task[] = data.tasks ?? []
        setAllTasks(tasks)
        setSections(buildSections(tasks))
      })
      .finally(() => setLoading(false))
  }, [])

  function acknowledge(taskId: string) {
    fetch(`/api/provider/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    })
    setAllTasks(q => {
      const updated = q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t)
      setSections(buildSections(updated))
      return updated
    })
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
    setAllTasks(q => {
      const updated = q.filter(t => t.id !== closeTask.id)
      setSections(buildSections(updated))
      return updated
    })
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
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif font-normal text-3xl text-aubergine tracking-tight">Clinical Tasks</h1>
            <p className="text-sm font-sans text-aubergine/40 mt-1">{allTasks.length} open</p>
          </div>
        </div>

        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.key}>
              <button
                onClick={() => setExpandedSections(s => ({ ...s, [section.key]: !s[section.key] }))}
                className="flex items-center gap-2 mb-3 group w-full text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.dotColor }} />
                <span className="text-xs font-semibold uppercase tracking-wide text-aubergine/50 group-hover:text-aubergine/70 transition-colors">
                  {section.label}
                </span>
                <span className="text-xs text-aubergine/30 font-sans">{section.tasks.length}</span>
                <span className="text-xs text-aubergine/25 ml-auto">
                  {expandedSections[section.key] ? '▾' : '▸'}
                </span>
              </button>

              {expandedSections[section.key] && (
                section.tasks.length === 0 ? (
                  <p className="text-sm text-aubergine/30 italic pl-4 pb-2">None</p>
                ) : (
                  <TaskQueue
                    tasks={section.tasks}
                    onAcknowledge={acknowledge}
                    onClose={setCloseTask}
                  />
                )
              )}
            </div>
          ))}
        </div>

        {allTasks.length === 0 && (
          <div className="text-center py-20">
            <p className="text-aubergine/30 font-sans text-sm">No open tasks — queue is clear.</p>
          </div>
        )}
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
