'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
const QUESTIONS = [
  {
    domain: 'vasomotor',
    question: 'How bothersome have your hot flashes or night sweats been this week?',
    low: 'Not at all',
    high: 'Severely',
  },
  {
    domain: 'sleep',
    question: 'How much has poor sleep affected your daily life this week?',
    low: 'Not at all',
    high: 'Severely',
  },
  {
    domain: 'energy',
    question: 'How much has fatigue or low energy affected your daily activities this week?',
    low: 'Not at all',
    high: 'Severely',
  },
  {
    domain: 'mood',
    question: 'How much have mood changes, anxiety, or brain fog affected you this week?',
    low: 'Not at all',
    high: 'Severely',
  },
  {
    domain: 'gsm',
    question: 'Have you noticed vaginal dryness, discomfort during intimacy, or urinary changes this week?',
    low: 'Not at all',
    high: 'Severely',
  },
  {
    domain: 'overall',
    question: 'Overall, how much are your symptoms affecting your quality of life right now?',
    low: 'Not at all',
    high: 'Severely',
  },
]

type Scores = Record<string, number>

export default function CheckInPage() {
  const router = useRouter()
  const params = useParams()
  const appointmentId = params.appointmentId as string

  const [appointment, setAppointment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState<Scores>({
    vasomotor: 3,
    sleep: 3,
    energy: 3,
    mood: 3,
    gsm: 3,
    overall: 3,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch appointment details
        const res = await fetch(`/api/scheduling/appointments?patientId=all`)
        // We fetch by appointmentId directly via a dedicated lookup
        const aptRes = await fetch(`/api/checkin?appointmentId=${appointmentId}`)
        const aptData = await aptRes.json()

        if (aptData.checkedIn) {
          setAlreadyCheckedIn(true)
          setLoading(false)
          return
        }

        // Fetch appointment info for display
        const meRes = await fetch('/api/patient/me')
        if (!meRes.ok) {
          router.replace('/patient/login')
          return
        }
        const meData = await meRes.json()

        if (!meData.patientId) {
          setError('Could not find your patient record.')
          setLoading(false)
          return
        }

        const aptFetchRes = await fetch(
          `/api/scheduling/appointments?patientId=${meData.patientId}`
        )
        const aptFetchData = await aptFetchRes.json()
        const found = (aptFetchData.appointments || []).find(
          (a: any) => a.id === appointmentId
        )

        if (!found) {
          setError('Appointment not found.')
          setLoading(false)
          return
        }

        setAppointment(found)
      } catch (err) {
        setError('Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [appointmentId, router])

  const handleSlider = (domain: string, value: number) => {
    setScores((prev) => ({ ...prev, [domain]: value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, scores }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

  const scoreLabel = (val: number) => {
    const labels: Record<number, string> = {
      1: 'Not at all',
      2: 'Mild',
      3: 'Moderate',
      4: 'Significant',
      5: 'Severe',
    }
    return labels[val] ?? ''
  }

  const scoreColor = (val: number) => {
    if (val <= 1) return 'text-emerald-600'
    if (val === 2) return 'text-amber-500'
    if (val === 3) return 'text-amber-600'
    if (val === 4) return 'text-orange-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (submitted || alreadyCheckedIn) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-violet/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="font-display text-2xl text-aubergine mb-3">
            {alreadyCheckedIn ? 'Already checked in' : 'Check-in complete'}
          </h1>
          <p className="font-sans text-sm text-aubergine/60 mb-8">
            {alreadyCheckedIn
              ? 'You\'ve already completed your check-in for this appointment. Your provider will review your responses before your visit.'
              : 'Your responses have been sent to your provider. They\'ll review your symptoms before your visit.'}
          </p>
          <button
            onClick={() => router.push('/patient/dashboard')}
            className="font-sans font-semibold text-sm text-white bg-aubergine rounded-brand px-6 py-3 hover:bg-aubergine/90 transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  if (error && !appointment) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <p className="font-sans text-sm text-red-500 mb-6">{error}</p>
          <button
            onClick={() => router.push('/patient/dashboard')}
            className="font-sans font-semibold text-sm text-aubergine underline"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-white border-b border-aubergine/8">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="16" fill="#280f49" />
                <path d="M10 16.5C10 13.46 12.46 11 15.5 11C17.43 11 19.12 11.97 20.13 13.45" stroke="#F5F0EA" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M22 15.5C22 18.54 19.54 21 16.5 21C14.57 21 12.88 20.03 11.87 18.55" stroke="#F5F0EA" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="20.5" cy="11.5" r="1.5" fill="#944fed" />
                <circle cx="11.5" cy="20.5" r="1.5" fill="#944fed" />
              </svg>
            </div>
            <span className="font-display text-lg text-aubergine">WomenKind</span>
          </div>
          <button
            onClick={() => router.push('/patient/dashboard')}
            className="font-sans text-sm text-aubergine/50 hover:text-aubergine transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Intro */}
        <div className="mb-8">
          <h1 className="font-display text-3xl text-aubergine mb-2">How are you feeling?</h1>
          {appointment && (
            <p className="font-sans text-sm text-aubergine/50">
              Pre-visit check-in for your appointment on {formatDate(appointment.starts_at)}
            </p>
          )}
          <p className="font-sans text-sm text-aubergine/50 mt-1">
            This takes about 2 minutes. Your answers help your provider track how your treatment is working.
          </p>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {QUESTIONS.map((q, idx) => {
            const val = scores[q.domain]
            return (
              <div key={q.domain} className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5">
                <div className="flex items-start gap-3 mb-5">
                  <span className="font-sans text-xs font-semibold text-aubergine/30 mt-0.5 w-5 shrink-0">
                    {idx + 1}
                  </span>
                  <p className="font-sans text-sm font-medium text-aubergine leading-relaxed">
                    {q.question}
                  </p>
                </div>

                {/* Score display */}
                <div className="flex items-center justify-between mb-3 pl-8">
                  <span className={`font-sans text-sm font-semibold ${scoreColor(val)}`}>
                    {scoreLabel(val)}
                  </span>
                  <span className="font-sans text-xs text-aubergine/30 tabular-nums">{val} / 5</span>
                </div>

                {/* Slider */}
                <div className="pl-8">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={val}
                    onChange={(e) => handleSlider(q.domain, Number(e.target.value))}
                    className="w-full h-1.5 appearance-none rounded-full cursor-pointer checkin-slider"
                    style={{
                      background: `linear-gradient(to right, #944fed ${((val - 1) / 4) * 100}%, #280f4915 ${((val - 1) / 4) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between mt-2">
                    <span className="font-sans text-xs text-aubergine/30">{q.low}</span>
                    <span className="font-sans text-xs text-aubergine/30">{q.high}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="font-sans text-sm text-red-500 mt-4">{error}</p>
        )}

        {/* Submit */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => router.push('/patient/dashboard')}
            className="font-sans text-sm text-aubergine/50 hover:text-aubergine transition-colors"
          >
            Save for later
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="font-sans font-semibold text-sm text-white bg-aubergine rounded-brand px-7 py-3 hover:bg-aubergine/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit check-in'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .checkin-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #944fed;
          border: 3px solid white;
          box-shadow: 0 1px 4px rgba(40, 15, 73, 0.2);
          cursor: pointer;
        }
        .checkin-slider::-moz-range-thumb {
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
}
