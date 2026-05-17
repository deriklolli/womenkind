'use client'

import { useState } from 'react'

interface Props {
  patientId: string
  initialPlan: string | null
  initialNextStep: string | null
}

export function PlanEditor({ patientId, initialPlan, initialNextStep }: Props) {
  const [plan, setPlan] = useState(initialPlan ?? '')
  const [nextStep, setNextStep] = useState(initialNextStep ?? '')
  const [savedPlan, setSavedPlan] = useState(false)
  const [savedNextStep, setSavedNextStep] = useState(false)
  const [error, setError] = useState('')

  async function save(field: 'plan' | 'nextStep') {
    try {
      const body = field === 'plan'
        ? { current_plan: plan || null }
        : { next_step: nextStep || null }
      const res = await fetch(`/api/provider/patients/${patientId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Save failed')
      if (field === 'plan') { setSavedPlan(true); setTimeout(() => setSavedPlan(false), 2000) }
      else { setSavedNextStep(true); setTimeout(() => setSavedNextStep(false), 2000) }
    } catch {
      setError('Failed to save')
      setTimeout(() => setError(''), 3000)
    }
  }

  return (
    <div className="space-y-3">
      {/* Current Plan */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-aubergine/40">Current Plan</span>
          {savedPlan && <span className="text-xs text-emerald-600">Saved</span>}
        </div>
        <textarea
          value={plan}
          onChange={e => setPlan(e.target.value)}
          onBlur={() => save('plan')}
          placeholder="Enter treatment plan..."
          rows={3}
          className="w-full text-sm text-aubergine border border-aubergine/10 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white"
        />
      </div>

      {/* Next Step */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-aubergine/40">Next Step</span>
          {savedNextStep && <span className="text-xs text-emerald-600">Saved</span>}
        </div>
        <input
          type="text"
          value={nextStep}
          onChange={e => setNextStep(e.target.value)}
          onBlur={() => save('nextStep')}
          placeholder="No current action needed"
          className="w-full text-sm text-aubergine border border-aubergine/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet/30 bg-white"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
