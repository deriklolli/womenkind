'use client'

import { useState, useEffect } from 'react'

interface Presentation {
  id: string
  selected_components: string[]
  welcome_message: string | null
  status: 'sent' | 'viewed'
  viewed_at: string | null
  created_at: string
}

interface HealthBlueprintListProps {
  patientId: string
}

const COMPONENT_LABELS: Record<string, string> = {
  brain: 'Brain & Cognition',
  vasomotor: 'Vasomotor',
  metabolism: 'Metabolism & Weight',
  cardiovascular: 'Heart Health',
  bone: 'Bone Health',
  sleep: 'Sleep',
  mood: 'Mood & Cognition',
  gsm: 'Genitourinary',
  thyroid: 'Thyroid',
  metabolic: 'Metabolic Health',
  supplements: 'Supplements',
  skin: 'Skin & Collagen',
  sexual: 'Sexual Health',
  nutrition: 'Nutrition',
}

export default function HealthBlueprintList({ patientId }: HealthBlueprintListProps) {
  const [presentations, setPresentations] = useState<Presentation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPresentations() {
      try {
        const res = await fetch('/api/patient/presentations')
        if (res.ok) {
          const { presentations } = await res.json()
          setPresentations(presentations as Presentation[])
        }
      } catch (err) {
        console.error('Failed to load presentations:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPresentations()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-8">
        <div className="flex items-center justify-center gap-3 py-12">
          <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
          <span className="text-sm font-sans text-aubergine/40">Loading blueprints...</span>
        </div>
      </div>
    )
  }

  if (presentations.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-8 text-center">
        <svg className="w-10 h-10 text-aubergine/12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
        <h3 className="font-sans font-semibold text-lg text-aubergine mb-2">No blueprints yet</h3>
        <p className="text-sm font-sans text-aubergine/40 max-w-sm mx-auto">
          After your consultation, Dr. Urban will prepare a personalized health blueprint for you.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {presentations.map((p, index) => {
        const isNew = p.status === 'sent'
        const date = p.created_at
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
        const components = p.selected_components || []
        const label = index === presentations.length - 1 ? 'Initial Health Blueprint' : 'Updated Health Blueprint'

        return (
          <div
            key={p.id}
            className={`bg-white rounded-card shadow-sm shadow-aubergine/5 p-5 md:p-6 ${
              isNew ? 'border-2 border-violet/20' : 'border border-aubergine/5'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <h4 className="text-sm font-sans font-medium text-aubergine">{label}</h4>
                  {isNew && (
                    <span className="text-xs font-sans font-medium px-2 py-0.5 rounded-pill bg-violet/10 text-violet border border-violet/15">
                      New
                    </span>
                  )}
                  {!isNew && (
                    <span className="text-xs font-sans px-2 py-0.5 rounded-pill bg-emerald-50 text-emerald-600 border border-emerald-200">
                      Viewed
                    </span>
                  )}
                </div>

                <p className="text-xs font-sans text-aubergine/30 mb-3">
                  Prepared {formattedDate} by Dr. Urban
                </p>

                {/* Topic tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {components.map((c) => (
                    <span
                      key={c}
                      className="text-xs font-sans text-aubergine/45 bg-aubergine/[0.04] px-2 py-0.5 rounded-pill"
                    >
                      {COMPONENT_LABELS[c] || c}
                    </span>
                  ))}
                </div>

                {/* Preview of welcome message */}
                {p.welcome_message && (
                  <p className="text-xs font-sans text-aubergine/40 italic leading-relaxed line-clamp-2">
                    &ldquo;{p.welcome_message}&rdquo;
                  </p>
                )}
              </div>

              <button
                onClick={() => window.open(`/presentation-blueprint.html?id=${p.id}`, '_blank')}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-brand text-sm font-sans font-medium transition-colors ${
                  isNew
                    ? 'bg-violet text-white hover:bg-violet/90 shadow-sm'
                    : 'text-violet border border-violet/20 hover:bg-violet/5'
                }`}
              >
                View
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
