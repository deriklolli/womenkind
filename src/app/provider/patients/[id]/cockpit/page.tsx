'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { TaskQueue, Task } from '@/components/staff/TaskQueue'
import { TaskCloseModal } from '@/components/staff/TaskCloseModal'
import { DiffPanel } from '@/components/provider/DiffPanel'
import PlanEditor from '@/components/provider/PlanEditor'
import { MedChangeModal } from '@/components/provider/MedChangeModal'
import ProviderNav from '@/components/provider/ProviderNav'

interface CockpitData {
  patient: {
    id: string
    current_plan: string | null
    next_step: string | null
    last_md_review_at: string | null
    last_meaningful_touch_at: string | null
  }
  liveWmi: number | null
  activeTasks: Task[]
  rxHistory: Array<{
    id: string
    change_type: string
    previous_dosage: string | null
    new_dosage: string | null
    reason: string | null
    created_at: string
    prescription_id: string
  }>
}

interface DiffData {
  since: string | null
  wmiDelta: { from: number | null; to: number; delta: number | null } | null
  rxChanges: any[]
  messageCount: number
  rnNotes: any[]
}

interface AccordionSection {
  key: string
  label: string
}

const ACCORDION_SECTIONS: AccordionSection[] = [
  { key: 'medications', label: 'Medication Timeline' },
  { key: 'trend',       label: 'Symptom Trend' },
  { key: 'labs',        label: 'Labs' },
  { key: 'messages',    label: 'Messages' },
  { key: 'visits',      label: 'Visit & Encounter Notes' },
]

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const CHANGE_LABELS: Record<string, string> = {
  started: 'Started', dose_increased: 'Dose ↑', dose_decreased: 'Dose ↓',
  stopped: 'Stopped', refill_authorized: 'Refill', formulation_changed: 'Formulation changed',
}

export default function CockpitPage() {
  const params = useParams()
  const patientId = params.id as string

  const [cockpit, setCockpit] = useState<CockpitData | null>(null)
  const [diff, setDiff] = useState<DiffData | null>(null)
  const [loading, setLoading] = useState(true)
  const [closeTask, setCloseTask] = useState<Task | null>(null)
  const [staffRole, setStaffRole] = useState('md')
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({})
  const [medChangeTarget, setMedChangeTarget] = useState<{ rxId: string; medName: string; dosage: string } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d?.staffRole) setStaffRole(d.staffRole) }).catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`/api/provider/patients/${patientId}/cockpit`).then(r => r.json()),
      fetch(`/api/provider/patients/${patientId}/diff`).then(r => r.json()),
    ]).then(([cockpitData, diffData]) => {
      setCockpit(cockpitData)
      setTasks(cockpitData.activeTasks ?? [])
      setDiff(diffData)
    }).finally(() => setLoading(false))
  }, [patientId])

  function toggleAccordion(key: string) {
    setOpenAccordions(s => ({ ...s, [key]: !s[key] }))
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
    // Refresh last_md_review_at if required
    fetch(`/api/provider/patients/${patientId}/cockpit`)
      .then(r => r.json())
      .then(data => setCockpit(data))
      .catch(() => {})
  }

  if (loading) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
    </div>
  )
  if (!cockpit) return <div className="p-8 text-aubergine/40">Patient not found.</div>

  const wmiDelta = diff?.wmiDelta
  const hasReview = !!cockpit.patient.last_md_review_at

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav />
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Patient strip */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <a
                href={`/provider/patient/${patientId}`}
                className="text-xs font-sans text-violet hover:underline"
              >
                ← Back to chart
              </a>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-sans text-aubergine/40 bg-aubergine/5 px-2.5 py-1 rounded-full">
                Last MD review: {formatDate(cockpit.patient.last_md_review_at)}
              </span>
              {wmiDelta && wmiDelta.delta != null && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  wmiDelta.delta >= 0
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  WMI {wmiDelta.delta >= 0 ? `↑ ${wmiDelta.delta}` : `↓ ${Math.abs(wmiDelta.delta)}`}
                </span>
              )}
            </div>
          </div>

          <PlanEditor
            patientId={patientId}
            currentPlan={cockpit.patient.current_plan}
            nextStep={cockpit.patient.next_step}
            lastMdReviewAt={cockpit.patient.last_md_review_at ?? null}
          />
        </div>

        {/* Since last MD review */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5">
          <div className="px-6 pt-5 pb-3 border-b border-aubergine/5">
            <h2 className="font-sans font-semibold text-base text-aubergine">
              Since last MD review
              {hasReview && (
                <span className="text-xs font-normal text-aubergine/40 ml-2">
                  {formatDate(cockpit.patient.last_md_review_at)}
                </span>
              )}
            </h2>
          </div>
          <div className="px-6 py-4">
            {diff ? <DiffPanel diff={diff} /> : <p className="text-sm text-aubergine/40">Loading...</p>}
          </div>
        </div>

        {/* Active tasks */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5">
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-aubergine/5">
            <h2 className="font-sans font-semibold text-base text-aubergine">
              Active Tasks
              {tasks.length > 0 && (
                <span className="ml-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                  {tasks.length}
                </span>
              )}
            </h2>
          </div>
          <div className="px-6 py-4">
            <TaskQueue
              tasks={tasks}
              onAcknowledge={async (taskId) => {
                const res = await fetch(`/api/provider/tasks/${taskId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'acknowledged' }),
                })
                if (res.ok) {
                  setTasks(q => q.map(t => t.id === taskId ? { ...t, status: 'acknowledged' } : t))
                }
              }}
              onClose={setCloseTask}
            />
          </div>
        </div>

        {/* History accordions */}
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5 divide-y divide-aubergine/5">
          {ACCORDION_SECTIONS.map(section => (
            <div key={section.key}>
              <button
                onClick={() => toggleAccordion(section.key)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-aubergine/[0.02] transition-colors"
              >
                <span className="text-sm font-sans font-medium text-aubergine/70">
                  {section.key === 'medications'
                    ? `Medication Timeline (${(cockpit.rxHistory ?? []).length} changes)`
                    : section.label}
                </span>
                <span className="text-xs text-aubergine/30">
                  {openAccordions[section.key] ? '▾' : '▸'}
                </span>
              </button>

              {openAccordions[section.key] && (
                <div className="px-6 pb-5">
                  {section.key === 'medications' && (
                    cockpit.rxHistory.length === 0 ? (
                      <p className="text-sm text-aubergine/30 italic">No medication changes recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {cockpit.rxHistory.map(c => (
                          <div key={c.id} className="flex items-center gap-3 text-sm">
                            <span className="text-xs font-semibold text-aubergine/40 w-20 flex-shrink-0">
                              {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-aubergine/60">
                              {CHANGE_LABELS[c.change_type] ?? c.change_type}
                              {c.new_dosage ? ` → ${c.new_dosage}` : ''}
                            </span>
                            <button
                              onClick={() => setMedChangeTarget({
                                rxId: c.prescription_id,
                                medName: 'Medication',
                                dosage: c.new_dosage ?? '',
                              })}
                              className="ml-auto text-xs text-violet hover:underline"
                            >
                              + Record change
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                  {section.key !== 'medications' && (
                    <p className="text-sm text-aubergine/30 italic">
                      Open the full patient chart to view {section.label.toLowerCase()}.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
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

      {medChangeTarget && (
        <MedChangeModal
          patientId={patientId}
          prescriptionId={medChangeTarget.rxId}
          medicationName={medChangeTarget.medName}
          currentDosage={medChangeTarget.dosage}
          onClose={() => setMedChangeTarget(null)}
          onSuccess={() => {
            fetch(`/api/provider/patients/${patientId}/cockpit`)
              .then(r => r.json())
              .then(data => setCockpit(data))
          }}
        />
      )}
    </div>
  )
}
