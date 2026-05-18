'use client'

import { useState, useRef } from 'react'

interface Props {
  patientId: string
  currentPlan: string | null
  nextStep: string | null
  lastMdReviewAt: string | null
}

export default function PlanEditor({ patientId, currentPlan: initialPlan, nextStep: initialNext, lastMdReviewAt }: Props) {
  const [plan, setPlan]        = useState(initialPlan ?? '')
  const [next, setNext]        = useState(initialNext ?? '')
  const [savedField, setSaved] = useState<'plan' | 'next' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = async (field: 'plan' | 'next', value: string) => {
    const body = field === 'plan' ? { current_plan: value } : { next_step: value }
    try {
      await fetch(`/api/provider/patients/${patientId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setSaved(field)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setSaved(null), 2000)
    } catch {}
  }

  const reviewAgo = lastMdReviewAt
    ? (() => {
        const days = Math.floor((Date.now() - new Date(lastMdReviewAt).getTime()) / 86400000)
        if (days === 0) return 'today'
        if (days === 1) return '1 day ago'
        return `${days} days ago`
      })()
    : null

  return (
    <div className="flex-1 grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">Current Plan</p>
        <textarea
          value={plan}
          onChange={e => setPlan(e.target.value)}
          onBlur={() => save('plan', plan)}
          placeholder="Click to add treatment plan…"
          rows={3}
          className="w-full text-sm font-sans text-aubergine bg-transparent resize-none outline-none border border-transparent rounded-lg px-2 py-1 hover:border-aubergine/10 focus:border-aubergine/20 focus:bg-white transition-colors placeholder:text-aubergine/20"
        />
        {savedField === 'plan' && <p className="text-xs font-sans text-emerald-500 mt-0.5">Saved</p>}
      </div>

      <div>
        <p className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-1">Next Step</p>
        <textarea
          value={next}
          onChange={e => setNext(e.target.value)}
          onBlur={() => save('next', next)}
          placeholder="No current action needed…"
          rows={3}
          className="w-full text-sm font-sans text-aubergine bg-transparent resize-none outline-none border border-transparent rounded-lg px-2 py-1 hover:border-aubergine/10 focus:border-aubergine/20 focus:bg-white transition-colors placeholder:text-aubergine/20"
        />
        {savedField === 'next' && <p className="text-xs font-sans text-emerald-500 mt-0.5">Saved</p>}
        {reviewAgo && (
          <p className="text-xs font-sans text-aubergine/30 mt-0.5">Last MD review: {reviewAgo}</p>
        )}
      </div>
    </div>
  )
}
