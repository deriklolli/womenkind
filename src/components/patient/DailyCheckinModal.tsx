'use client'

import { useState } from 'react'

interface Props {
  onSuccess: () => void
  onClose: () => void
}

const QUESTIONS = [
  {
    domain: 'vasomotor',
    question: 'How bothersome have your hot flashes or night sweats been today?',
  },
  {
    domain: 'sleep',
    question: 'How much has poor sleep affected your daily life today?',
  },
  {
    domain: 'energy',
    question: 'How much has fatigue or low energy affected you today?',
  },
  {
    domain: 'mood',
    question: 'How much have mood changes, irritability, or anxiety affected you today?',
  },
  {
    domain: 'cognition',
    question: 'How much has brain fog, difficulty concentrating, or memory lapses affected you today?',
  },
  {
    domain: 'gsm',
    question: 'Have you noticed vaginal dryness, discomfort during intimacy, or urinary changes today?',
  },
  {
    domain: 'bone',
    question: 'How much have joint pain, stiffness, or muscle aches affected you today?',
  },
  {
    domain: 'weight',
    question: 'How much have bloating, appetite changes, or weight-related concerns affected you today?',
  },
  {
    domain: 'libido',
    question: 'How much have changes in sexual desire or intimacy affected your quality of life recently?',
  },
  {
    domain: 'cardio',
    question: 'Have you noticed heart palpitations, racing heart, or chest discomfort today?',
  },
  {
    domain: 'overall',
    question: 'Overall, how much are your symptoms affecting your quality of life right now?',
  },
]

const SCORE_LABELS: Record<number, string> = {
  1: 'Not at all',
  2: 'Mild',
  3: 'Moderate',
  4: 'Significant',
  5: 'Severe',
}

function scoreColor(val: number): string {
  if (val <= 1) return 'text-emerald-600'
  if (val === 2) return 'text-amber-500'
  if (val === 3) return 'text-amber-600'
  if (val === 4) return 'text-orange-600'
  return 'text-red-600'
}

export default function DailyCheckinModal({ onSuccess, onClose }: Props) {
  const [scores, setScores] = useState<Record<string, number>>({
    vasomotor: 3,
    sleep: 3,
    energy: 3,
    mood: 3,
    cognition: 3,
    gsm: 3,
    bone: 3,
    weight: 3,
    libido: 3,
    cardio: 3,
    overall: 3,
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSlider = (domain: string, value: number) => {
    setScores((prev) => ({ ...prev, [domain]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/daily-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setSuccess(true)
      setTimeout(() => onSuccess(), 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div>
            <h2 className="font-display text-lg text-aubergine">Today's Check-In</h2>
            <p className="font-sans text-xs text-aubergine/50">Takes about 2 minutes</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-aubergine/40 hover:text-aubergine"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="w-14 h-14 rounded-full bg-violet/10 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="font-display text-xl text-aubergine mb-2">Logged for today</h3>
            <p className="font-sans text-sm text-aubergine/50">Your tracker is updating.</p>
          </div>
        ) : (
          <div className="px-6 py-6">
            <div className="space-y-4">
              {QUESTIONS.map((q, idx) => {
                const val = scores[q.domain]
                const pct = ((val - 1) / 4) * 100
                return (
                  <div key={q.domain} className="rounded-xl p-4 border border-gray-100 bg-gray-50">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="font-sans text-xs font-semibold text-aubergine/30 mt-0.5 w-4 shrink-0">
                        {idx + 1}
                      </span>
                      <p className="font-sans text-sm font-medium text-aubergine leading-relaxed">
                        {q.question}
                      </p>
                    </div>

                    <div className="pl-7">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-sans text-sm font-semibold ${scoreColor(val)}`}>
                          {SCORE_LABELS[val]}
                        </span>
                        <span className="font-sans text-xs text-aubergine/30 tabular-nums">{val} / 5</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={val}
                        onChange={(e) => handleSlider(q.domain, Number(e.target.value))}
                        className="daily-checkin-slider w-full h-1.5 appearance-none rounded-full cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #944fed ${pct}%, #e5e7eb ${pct}%)`,
                        }}
                      />
                      <div className="flex justify-between mt-1.5">
                        <span className="font-sans text-xs text-aubergine/30">Not at all</span>
                        <span className="font-sans text-xs text-aubergine/30">Severe</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <p className="font-sans text-sm text-red-500 mt-4">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-6 w-full font-sans font-semibold text-sm text-white bg-aubergine rounded-xl py-3 hover:bg-aubergine/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Logging…' : 'Log today\'s symptoms'}
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        .daily-checkin-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #944fed;
          border: 3px solid white;
          box-shadow: 0 1px 4px rgba(40, 15, 73, 0.2);
          cursor: pointer;
        }
        .daily-checkin-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #944fed;
          border: 3px solid white;
          box-shadow: 0 1px 4px rgba(40, 15, 73, 0.2);
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  )
}
