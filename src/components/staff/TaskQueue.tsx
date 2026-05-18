'use client'

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

const PRIORITY_DOT: Record<string, string> = {
  red:    'bg-red-500',
  orange: 'bg-orange-400',
  yellow: 'bg-amber-400',
  blue:   'bg-blue-400',
  gray:   'bg-aubergine/20',
}

interface Props {
  tasks: Task[]
  onAcknowledge?: (taskId: string) => void
  onClose?: (task: Task) => void
  onStatusChange?: (taskId: string, newStatus: string) => void
  patientNames?: Record<string, string>
}

export function TaskQueue({ tasks, onAcknowledge, onClose, patientNames = {} }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm font-sans text-aubergine/30">No open tasks — queue is clear.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-aubergine/5">
      {tasks.map((task) => {
        const dot = PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.gray
        const isOverdue = task.due_at && new Date(task.due_at) < new Date()

        return (
          <div
            key={task.id}
            className="px-6 py-4 flex items-center gap-4 hover:bg-aubergine/[0.02] transition-colors"
          >
            {/* Priority circle */}
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />

            {/* Title */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-sans text-aubergine truncate">
                {(() => {
                  const name = patientNames[task.patient_id]
                  const parts = task.title.split(' — ')
                  const bold = name ?? parts[0]
                  const rest = name ? task.title : parts.slice(1).join(' — ')
                  return <>
                    <span className="font-semibold">{bold}</span>
                    {rest && <span className="font-normal text-aubergine/60"> — {rest}</span>}
                  </>
                })()}
              </p>
            </div>

            {/* Category */}
            <span className="shrink-0 text-xs font-sans text-aubergine/40 capitalize hidden sm:block">
              {task.category.replace(/_/g, ' ')}
            </span>

            {/* Due date */}
            {task.due_at && (
              <span className={`shrink-0 text-xs font-sans ${isOverdue ? 'text-red-500 font-semibold' : 'text-aubergine/40'}`}>
                {isOverdue ? 'Overdue' : new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}

            {/* Status pill */}
            <span className="shrink-0 text-xs font-sans text-aubergine/50 bg-aubergine/5 border border-aubergine/10 px-2.5 py-0.5 rounded-pill capitalize">
              {task.status.replace(/_/g, ' ')}
            </span>

            {/* Actions */}
            <div className="shrink-0 flex gap-3">
              {task.status === 'new' && onAcknowledge && (
                <button
                  onClick={() => onAcknowledge(task.id)}
                  className="text-xs font-sans font-semibold text-violet hover:text-aubergine transition-colors"
                >
                  Acknowledge
                </button>
              )}
              {['acknowledged', 'in_progress', 'resolved'].includes(task.status) && onClose && (
                <button
                  onClick={() => onClose(task)}
                  className="text-xs font-sans font-semibold text-violet hover:text-aubergine transition-colors"
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
