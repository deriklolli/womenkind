'use client'

import { useEffect, useState } from 'react'

interface OutcomesTask {
  id: string
  patient_id: string
  title: string
  updated_at: string
}

interface Props {
  patientNames?: Record<string, string>
}

export function OutcomesWatchQueue({ patientNames = {} }: Props) {
  const [tasks, setTasks] = useState<OutcomesTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/provider/tasks?source=score_drop&status=new')
      .then(r => r.json())
      .then(data => setTasks(data.tasks ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-gray-400 py-4">Loading outcomes watch...</div>

  if (tasks.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        No patients with worsening trends.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Outcomes Watch — {tasks.length} patient{tasks.length !== 1 ? 's' : ''}
      </p>
      {tasks.map(task => (
        <div key={task.id} className="bg-white rounded-lg border border-green-200 px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-900">
            {patientNames[task.patient_id] ?? task.patient_id.slice(0, 8)}
          </span>
          <span className="text-xs text-gray-500 flex-1">{task.title}</span>
          <a
            href={`/provider/patients/${task.patient_id}`}
            className="text-xs text-blue-600 hover:underline shrink-0"
          >
            View patient →
          </a>
        </div>
      ))}
    </div>
  )
}
