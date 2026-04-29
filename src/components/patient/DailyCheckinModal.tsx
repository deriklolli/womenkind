'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  hasWearable?: boolean
  onSuccess: () => void
  onClose: () => void
}

const STANDARD_QUESTIONS = [
  {
    domain: 'vasomotor',
    question: 'On average, how many hot flashes or night sweats did you have per day this week?',
    inputType: 'counter' as const,
  },
  {
    domain: 'mood',
    question: 'How much have mood changes, irritability, or anxiety affected you this week?',
    inputType: 'slider' as const,
  },
  {
    domain: 'cognition',
    question: 'How much has brain fog, difficulty concentrating, or memory lapses affected you this week?',
    inputType: 'slider' as const,
  },
  {
    domain: 'gsm',
    question: 'Have you noticed vaginal dryness, discomfort during intimacy, or urinary changes this week?',
    inputType: 'slider' as const,
  },
  {
    domain: 'bone',
    question: 'How much have joint pain, stiffness, or muscle aches affected you this week?',
    inputType: 'slider' as const,
  },
  {
    domain: 'weight',
    question: 'How much have bloating, appetite changes, or weight-related concerns affected you this week?',
    inputType: 'slider' as const,
  },
  {
    domain: 'libido',
    question: 'How much have changes in sexual desire or intimacy affected your quality of life this week?',
    inputType: 'slider' as const,
  },
  {
    domain: 'cardio',
    question: 'Did you experience heart palpitations, racing heart, or chest discomfort this week?',
    inputType: 'cardio' as const,
  },
  {
    domain: 'overall',
    question: 'Overall, how much are your symptoms affecting your quality of life this week?',
    inputType: 'slider' as const,
  },
]

const WEARABLE_QUESTIONS = [
  {
    domain: 'sleep',
    question: 'On average, how many hours of sleep per night did you get this week?',
    inputType: 'hours' as const,
  },
  {
    domain: 'energy',
    question: 'How much has fatigue or low energy affected you this week?',
    inputType: 'slider' as const,
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

function buildInitialScores(hasWearable: boolean): Record<string, number> {
  const base: Record<string, number> = {
    vasomotor: 0,
    mood: 3, cognition: 3, gsm: 3, bone: 3, weight: 3, libido: 3,
    cardio: 0,
    overall: 3,
  }
  if (!hasWearable) {
    base.sleep = 7
    base.energy = 3
  }
  return base
}

export default function DailyCheckinModal({ hasWearable = false, onSuccess, onClose }: Props) {
  const [scores, setScores] = useState<Record<string, number>>(() => buildInitialScores(hasWearable))
  const [cardioYes, setCardioYes] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Track which non-slider questions have been explicitly answered
  const [touched, setTouched] = useState<Set<string>>(new Set())

  useEffect(() => { setMounted(true) }, [])

  const questions = hasWearable
    ? STANDARD_QUESTIONS
    : [...STANDARD_QUESTIONS.slice(0, 1), ...WEARABLE_QUESTIONS, ...STANDARD_QUESTIONS.slice(1)]

  // Slider questions are pre-answered (default 3 is valid). Counter, hours, cardio need explicit touch.
  const explicitDomains = questions
    .filter(q => q.inputType !== 'slider')
    .map(q => q.domain)
  const allAnswered = explicitDomains.every(d => touched.has(d))

  const touch = (domain: string) =>
    setTouched(prev => new Set(prev).add(domain))

  const set = (domain: string, value: number) => {
    setScores(prev => ({ ...prev, [domain]: value }))
    touch(domain)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/weekly-checkin', {
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

  const modal = (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ height: 'min(85vh, 680px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-display text-lg text-aubergine">This Week's Check-In</h2>
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
          <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-violet/10 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="font-display text-xl text-aubergine mb-2">Logged for this week</h3>
            <p className="font-sans text-sm text-aubergine/50">Your tracker is updating.</p>
          </div>
        ) : (
          <>
            {/* Scrollable questions */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                {questions.map((q, idx) => (
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
                      {q.inputType === 'counter' && (
                        <CounterInput
                          value={scores[q.domain]}
                          min={0}
                          max={20}
                          unit="per day avg"
                          onChange={(v) => set(q.domain, v)}
                        />
                      )}
                      {q.inputType === 'hours' && (
                        <HoursInput
                          value={scores[q.domain]}
                          onChange={(v) => set(q.domain, v)}
                        />
                      )}
                      {q.inputType === 'cardio' && (
                        <CardioInput
                          value={scores[q.domain]}
                          cardioYes={cardioYes}
                          onToggle={(yes) => {
                            setCardioYes(yes)
                            set(q.domain, yes ? 1 : 0)
                          }}
                          onCount={(v) => set(q.domain, v)}
                        />
                      )}
                      {q.inputType === 'slider' && (
                        <SliderInput
                          value={scores[q.domain]}
                          onChange={(v) => set(q.domain, v)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky footer */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              {error && (
                <p className="font-sans text-sm text-red-500 mb-3">{error}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || !allAnswered}
                className="w-full font-sans font-semibold text-sm text-white bg-aubergine rounded-xl py-3 hover:bg-aubergine/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Logging…' : !allAnswered ? 'Answer all questions to continue' : "Log this week's symptoms"}
              </button>
            </div>
          </>
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
        }
      `}</style>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function SliderInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = ((value - 1) / 4) * 100
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-sans text-sm font-semibold ${scoreColor(value)}`}>
          {SCORE_LABELS[value]}
        </span>
        <span className="font-sans text-xs text-aubergine/30 tabular-nums">{value} / 5</span>
      </div>
      <input
        type="range"
        min={1} max={5} step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="daily-checkin-slider w-full h-1.5 appearance-none rounded-full cursor-pointer"
        style={{ background: `linear-gradient(to right, #944fed ${pct}%, #e5e7eb ${pct}%)` }}
      />
      <div className="flex justify-between mt-1.5">
        <span className="font-sans text-xs text-aubergine/30">Not at all</span>
        <span className="font-sans text-xs text-aubergine/30">Severe</span>
      </div>
    </>
  )
}

function CounterInput({
  value, min, max, unit, onChange,
}: {
  value: number; min: number; max: number; unit: string; onChange: (v: number) => void
}) {
  const countColor = value === 0 ? 'text-emerald-600' : value <= 3 ? 'text-amber-600' : value <= 7 ? 'text-orange-600' : 'text-red-600'
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 rounded-full border-2 border-aubergine/15 flex items-center justify-center text-aubergine/50 hover:border-aubergine/40 hover:text-aubergine transition-colors"
        style={{ lineHeight: 1 }}
        aria-label="Decrease"
      >
        <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
          <line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <div className="flex-1 text-center">
        <span className={`font-serif text-4xl leading-none ${countColor}`}>{value}</span>
        <p className="font-sans text-xs text-aubergine/40 mt-1">
          {value === 0 ? 'None this week' : unit}
        </p>
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-9 h-9 rounded-full border-2 border-aubergine/15 flex items-center justify-center text-aubergine/50 hover:border-aubergine/40 hover:text-aubergine transition-colors"
        style={{ lineHeight: 1 }}
        aria-label="Increase"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

function HoursInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const hoursColor = value >= 7 ? 'text-emerald-600' : value >= 5 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-9 h-9 rounded-full border-2 border-aubergine/15 flex items-center justify-center text-aubergine/50 hover:border-aubergine/40 hover:text-aubergine transition-colors"
        aria-label="Decrease"
      >
        <svg width="12" height="2" viewBox="0 0 12 2" fill="none">
          <line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <div className="flex-1 text-center">
        <span className={`font-serif text-4xl leading-none ${hoursColor}`}>{value}</span>
        <p className="font-sans text-xs text-aubergine/40 mt-1">hours</p>
      </div>
      <button
        onClick={() => onChange(Math.min(12, value + 1))}
        className="w-9 h-9 rounded-full border-2 border-aubergine/15 flex items-center justify-center text-aubergine/50 hover:border-aubergine/40 hover:text-aubergine transition-colors"
        aria-label="Increase"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

function CardioInput({
  value, cardioYes, onToggle, onCount,
}: {
  value: number; cardioYes: boolean; onToggle: (yes: boolean) => void; onCount: (v: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => onToggle(false)}
          className={`flex-1 py-2 rounded-lg border text-sm font-sans font-medium transition-colors ${
            !cardioYes
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-gray-200 text-aubergine/50 hover:border-aubergine/30'
          }`}
        >
          None this week
        </button>
        <button
          onClick={() => onToggle(true)}
          className={`flex-1 py-2 rounded-lg border text-sm font-sans font-medium transition-colors ${
            cardioYes
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-white border-gray-200 text-aubergine/50 hover:border-aubergine/30'
          }`}
        >
          Yes, I had some
        </button>
      </div>
      {cardioYes && (
        <div>
          <p className="font-sans text-xs text-aubergine/50 mb-2">How many episodes?</p>
          <CounterInput
            value={value}
            min={1}
            max={20}
            unit="episodes"
            onChange={onCount}
          />
        </div>
      )}
    </div>
  )
}
