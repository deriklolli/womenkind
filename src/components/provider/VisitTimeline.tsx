'use client'

import { useState } from 'react'

interface Visit {
  id: string
  visit_type: string
  visit_date: string
  symptom_scores: Record<string, number>
  provider_notes: string | null
  treatment_updates: string | null
  intake_id: string | null
}

interface VisitTimelineProps {
  visits: Visit[]
  onViewBrief?: (intakeId: string) => void
}

const VISIT_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  intake: {
    label: 'Initial Intake',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'text-violet bg-violet/10 border-violet/20',
  },
  follow_up: {
    label: 'Follow-up Visit',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    color: 'text-terracota bg-terracota/10 border-terracota/20',
  },
  check_in: {
    label: 'Check-in',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    color: 'text-aubergine/60 bg-aubergine/5 border-aubergine/10',
  },
}

const SCORE_LABELS: Record<string, string> = {
  vasomotor: 'Hot Flashes',
  sleep: 'Sleep',
  energy: 'Energy',
  mood: 'Mood',
  gsm: 'Vaginal / Urinary',
  overall: 'Overall',
}

export default function VisitTimeline({ visits, onViewBrief }: VisitTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sortedVisits = [...visits].sort(
    (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
  )

  if (sortedVisits.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-card shadow-sm border border-aubergine/5">
        <p className="text-sm font-sans text-aubergine/30">No visits recorded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {sortedVisits.map((visit, index) => {
        const config = VISIT_TYPE_CONFIG[visit.visit_type] || VISIT_TYPE_CONFIG.follow_up
        const isExpanded = expandedId === visit.id
        const isLast = index === sortedVisits.length - 1

        return (
          <div key={visit.id} className="relative flex gap-4">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[19px] top-10 bottom-0 w-px bg-aubergine/10" />
            )}

            {/* Timeline dot */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border ${config.color}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <button
                onClick={() => setExpandedId(isExpanded ? null : visit.id)}
                className="w-full text-left bg-white rounded-card p-4 shadow-sm border border-aubergine/5 hover:border-violet/10 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-sans font-medium text-aubergine">{config.label}</span>
                    <span className="text-xs font-sans text-aubergine/40 ml-3">
                      {new Date(visit.visit_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-aubergine/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Scores row (always visible) */}
                {visit.symptom_scores && Object.keys(visit.symptom_scores).length > 0 && (
                  <div className="flex gap-3 mt-3">
                    {Object.entries(visit.symptom_scores).map(([key, val]) => (
                      <span
                        key={key}
                        className={`text-xs font-sans px-2 py-0.5 rounded-pill border ${
                          val >= 4
                            ? 'text-red-600 bg-red-50 border-red-100'
                            : val >= 3
                            ? 'text-amber-600 bg-amber-50 border-amber-100'
                            : 'text-emerald-600 bg-emerald-50 border-emerald-100'
                        }`}
                      >
                        {SCORE_LABELS[key] || key}: {val}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-aubergine/5 space-y-3" onClick={(e) => e.stopPropagation()}>
                    {visit.provider_notes && (
                      <div>
                        <p className="text-xs font-sans font-medium text-aubergine/50 mb-1">Provider Notes</p>
                        <p className="text-sm font-sans text-aubergine/70 whitespace-pre-wrap">{visit.provider_notes}</p>
                      </div>
                    )}
                    {visit.treatment_updates && (
                      <div>
                        <p className="text-xs font-sans font-medium text-aubergine/50 mb-1">Treatment Updates</p>
                        <p className="text-sm font-sans text-aubergine/70 whitespace-pre-wrap">{visit.treatment_updates}</p>
                      </div>
                    )}
                    {visit.visit_type === 'intake' && visit.intake_id && onViewBrief && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewBrief(visit.intake_id!)
                        }}
                        className="text-xs font-sans font-medium text-violet hover:text-violet-dark transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View AI Clinical Brief
                      </button>
                    )}
                    {!visit.provider_notes && !visit.treatment_updates && visit.visit_type !== 'intake' && (
                      <p className="text-xs font-sans text-aubergine/30 italic">No notes recorded for this visit</p>
                    )}
                  </div>
                )}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
