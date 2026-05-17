'use client'

import { useState } from 'react'

export interface Task {
  id: string
  patient_id: string
  title: string
  body?: string | null
  category: string
  priority: 'red' | 'orange' | 'yellow' | 'blue' | 'gray'
  status: string
  owner_staff_id?: string | null
  due_at?: string | null
  updated_at: string
  requires_md_signoff: boolean
  patient_notified: boolean
  message_category?: string | null
  closeout_safety_open?: boolean | null
}

const PRIORITY_STYLES: Record<string, { border: string; badge: string; label: string }> = {
  red:    { border: 'border-l-red-500',    badge: 'bg-red-100 text-red-700',    label: 'RED' },
  orange: { border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'ORANGE' },
  yellow: { border: 'border-l-yellow-400', badge: 'bg-yellow-100 text-yellow-700', label: 'YELLOW' },
  blue:   { border: 'border-l-blue-400',   badge: 'bg-blue-100 text-blue-700',   label: 'BLUE' },
  gray:   { border: 'border-l-gray-300',   badge: 'bg-gray-100 text-gray-600',   label: 'GRAY' },
}

interface Props {
  tasks: Task[]
  onAcknowledge?: (taskId: string) => void
  onClose?: (task: Task) => void
  onStatusChange?: (taskId: string, newStatus: string) => void
  patientNames?: Record<string, string>
}

export function TaskQueue({ tasks, onAcknowledge, onClose, onStatusChange, patientNames = {} }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No open tasks — queue is clear.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const style = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.gray
        const isOverdue = task.due_at && new Date(task.due_at) < new Date()

        return (
          <div
            key={task.id}
            className={`bg-white rounded-lg border-l-4 ${style.border} shadow-sm px-4 py-3 flex items-center gap-4`}
          >
            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded ${style.badge}`}>
              {style.label}
            </span>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {patientNames[task.patient_id] ?? task.patient_id.slice(0, 8)}
              </div>
              <div className="text-xs text-gray-500 truncate">{task.title}</div>
            </div>

            {task.due_at && (
              <div className={`shrink-0 text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                {isOverdue ? 'Overdue' : new Date(task.due_at).toLocaleDateString()}
              </div>
            )}

            <span className="shrink-0 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
              {task.status.replace(/_/g, ' ')}
            </span>

            <div className="shrink-0 flex gap-2">
              {task.status === 'new' && onAcknowledge && (
                <button
                  onClick={() => onAcknowledge(task.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Acknowledge
                </button>
              )}
              {['acknowledged', 'in_progress', 'resolved'].includes(task.status) && onClose && (
                <button
                  onClick={() => onClose(task)}
                  className="text-xs text-green-600 hover:text-green-800 font-medium"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
