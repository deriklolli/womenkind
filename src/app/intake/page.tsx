'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  QUESTIONS,
  SECTIONS,
  SEC_INTROS,
  SAFETY_FRAMES,
  getVisibleQuestions,
  type IntakeQuestion,
} from '@/lib/intake-questions'
import Image from 'next/image'
import IntakeQuestionCard from '@/components/IntakeQuestion'
import IntakeProgress from '@/components/IntakeProgress'
import SectionIntro from '@/components/SectionIntro'

type Screen =
  | { type: 'welcome' }
  | { type: 'section-intro'; section: string }
  | { type: 'question'; index: number }
  | { type: 'complete' }

export default function IntakePage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [screen, setScreen] = useState<Screen>({ type: 'welcome' })
  const [animDirection, setAnimDirection] = useState<'forward' | 'backward'>('forward')
  const [seenSections, setSeenSections] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [welcomeVisible, setWelcomeVisible] = useState(false)
  const [completeVisible, setCompleteVisible] = useState(false)
  const [intakeId, setIntakeId] = useState<string | null>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-save answers to Supabase (debounced)
  const autoSave = useCallback(
    async (currentAnswers: Record<string, any>) => {
      try {
        const res = await fetch('/api/intake/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intakeId,
            answers: currentAnswers,
          }),
        })
        const data = await res.json()
        if (data.intakeId && !intakeId) {
          setIntakeId(data.intakeId)
        }
      } catch (err) {
        console.error('Auto-save failed:', err)
      }
    },
    [intakeId]
  )

  // Debounced save on answer change
  useEffect(() => {
    if (Object.keys(answers).length === 0) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => autoSave(answers), 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [answers, autoSave])

  // Compute visible questions based on current answers
  const visibleQuestions = useMemo(() => getVisibleQuestions(answers), [answers])

  // Progress calculation
  const progress = useMemo(() => {
    if (screen.type === 'welcome') return 0
    if (screen.type === 'complete') return 100
    if (screen.type === 'question') {
      return Math.round(((screen.index + 1) / visibleQuestions.length) * 100)
    }
    // section-intro: find the index of the first question in this section
    if (screen.type === 'section-intro') {
      const idx = visibleQuestions.findIndex((q) => q.sec === screen.section)
      return idx >= 0 ? Math.round((idx / visibleQuestions.length) * 100) : 0
    }
    return 0
  }, [screen, visibleQuestions])

  // Current section
  const currentSection = useMemo(() => {
    if (screen.type === 'question') return visibleQuestions[screen.index]?.sec || ''
    if (screen.type === 'section-intro') return screen.section
    return ''
  }, [screen, visibleQuestions])

  // Welcome animation
  useEffect(() => {
    if (screen.type === 'welcome') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWelcomeVisible(true))
      })
    }
  }, [screen.type])

  // Complete animation
  useEffect(() => {
    if (screen.type === 'complete') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setCompleteVisible(true))
      })
    }
  }, [screen.type])

  const startIntake = useCallback(() => {
    setAnimDirection('forward')
    // Show intro for first section
    const firstSection = visibleQuestions[0]?.sec
    if (firstSection && SEC_INTROS[firstSection]) {
      setSeenSections(new Set([firstSection]))
      setScreen({ type: 'section-intro', section: firstSection })
    } else {
      setScreen({ type: 'question', index: 0 })
    }
  }, [visibleQuestions])

  const goToQuestion = useCallback(
    (index: number, direction: 'forward' | 'backward') => {
      setAnimDirection(direction)

      if (index < 0) return
      if (index >= visibleQuestions.length) {
        setScreen({ type: 'complete' })
        return
      }

      const q = visibleQuestions[index]
      const isNewSection = !seenSections.has(q.sec)

      if (direction === 'forward' && isNewSection) {
        setSeenSections((prev) => {
          const next = new Set(Array.from(prev))
          next.add(q.sec)
          return next
        })
        if (SEC_INTROS[q.sec] || SAFETY_FRAMES[q.sec]) {
          setScreen({ type: 'section-intro', section: q.sec })
          return
        }
      }

      setScreen({ type: 'question', index })
    },
    [visibleQuestions, seenSections]
  )

  const handleSectionIntroContinue = useCallback(() => {
    if (screen.type !== 'section-intro') return
    const idx = visibleQuestions.findIndex((q) => q.sec === screen.section)
    if (idx >= 0) {
      setAnimDirection('forward')
      setScreen({ type: 'question', index: idx })
    }
  }, [screen, visibleQuestions])

  const handleAnswer = useCallback((questionId: string, val: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }))
  }, [])

  const handleNext = useCallback(() => {
    if (screen.type !== 'question') return
    goToQuestion(screen.index + 1, 'forward')
  }, [screen, goToQuestion])

  const handleBack = useCallback(() => {
    if (screen.type !== 'question') return
    goToQuestion(screen.index - 1, 'backward')
  }, [screen, goToQuestion])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      // Final save before submitting
      await autoSave(answers)

      const res = await fetch('/api/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId, answers }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Submission failed')

      // Redirect to payment gate
      const id = intakeId || data.intakeId
      router.push(`/intake/payment?intake_id=${id}`)
    } catch (err) {
      console.error('Submit error:', err)
      // Still redirect to payment for demo
      if (intakeId) {
        router.push(`/intake/payment?intake_id=${intakeId}`)
      } else {
        setScreen({ type: 'complete' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [answers, intakeId, autoSave])

  return (
    <div className="min-h-screen bg-[#1A0E30] flex flex-col relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#FA6B05]/3 rounded-full blur-[100px]" />
      </div>

      {/* Progress bar (visible during questions) */}
      {screen.type !== 'welcome' && screen.type !== 'complete' && (
        <div className="sticky top-0 z-20 bg-[#1A0E30]/80 backdrop-blur-xl">
          <IntakeProgress currentSection={currentSection} progress={progress} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center relative z-10 py-12">
        {/* Welcome screen */}
        {screen.type === 'welcome' && (
          <div
            className={`transition-all duration-1000 ease-out w-full max-w-xl mx-auto px-6 text-center
              ${welcomeVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}
          >
            {/* Logo */}
            <div className="mb-10">
              <Image
                src="/womenkind-logo.png"
                alt="Womenkind"
                width={500}
                height={100}
                className="h-10 md:h-11 w-auto mx-auto"
                priority
              />
            </div>

            <h2 className="font-serif text-2xl md:text-3xl text-white mb-4 tracking-tight leading-snug">
              Your intake starts here
            </h2>
            <p className="text-base text-white/50 font-sans leading-relaxed max-w-md mx-auto mb-4">
              This questionnaire helps your clinician understand your symptoms,
              history, and goals before your first visit. It takes about 15{'\u2013'}20 minutes.
            </p>
            <p className="text-sm text-white/30 font-sans mb-10">
              Your answers are private and stored securely.
            </p>

            <button
              onClick={startIntake}
              className="inline-flex items-center gap-3 px-10 py-4 rounded-full font-sans text-base font-semibold
                         bg-[#FA6B05] text-white hover:bg-[#FF8228] shadow-xl shadow-[#FA6B05]/25
                         hover:shadow-[#FA6B05]/50 transition-all duration-300 hover:scale-[1.02]"
            >
              Begin Your Intake
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        )}

        {/* Section intro */}
        {screen.type === 'section-intro' && (
          <SectionIntro
            key={screen.section}
            section={screen.section}
            intro={SEC_INTROS[screen.section] || ''}
            safetyFrame={SAFETY_FRAMES[screen.section]}
            onContinue={handleSectionIntroContinue}
          />
        )}

        {/* Question */}
        {screen.type === 'question' && visibleQuestions[screen.index] && (
          <IntakeQuestionCard
            key={visibleQuestions[screen.index].id}
            question={visibleQuestions[screen.index]}
            value={answers[visibleQuestions[screen.index].id]}
            onChange={(val) => handleAnswer(visibleQuestions[screen.index].id, val)}
            onNext={screen.index === visibleQuestions.length - 1 ? handleSubmit : handleNext}
            onBack={handleBack}
            isFirst={screen.index === 0}
            isLast={screen.index === visibleQuestions.length - 1}
            animDirection={animDirection}
          />
        )}

        {/* Complete screen */}
        {screen.type === 'complete' && (
          <div
            className={`transition-all duration-1000 ease-out w-full max-w-xl mx-auto px-6 text-center
              ${completeVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}
          >
            {/* Success icon */}
            <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#4ECDC4]/15 border-2 border-[#4ECDC4]/30">
              <svg className="w-10 h-10 text-[#4ECDC4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="font-serif text-3xl md:text-4xl text-white mb-4 tracking-tight">
              Intake complete
            </h2>
            <p className="text-base text-white/50 font-sans leading-relaxed max-w-md mx-auto mb-3">
              Thank you for sharing this information. Your clinician will review
              your responses and prepare a personalized clinical brief before your visit.
            </p>
            <p className="text-sm text-white/30 font-sans mb-10">
              You{'\u2019'}ll receive an email when your brief is ready.
            </p>

            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
              <span className="w-2 h-2 rounded-full bg-[#4ECDC4] animate-pulse" />
              <span className="text-sm font-sans text-[#4ECDC4]">Processing your intake</span>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard nav hint at bottom */}
      {screen.type === 'question' && (
        <div className="pb-6 text-center">
          <div className="inline-flex items-center gap-4 text-white/15 text-xs font-sans">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px]">{'\u2191'}</kbd>
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px]">{'\u2193'}</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-0.5 bg-white/5 rounded text-[10px]">Enter</kbd>
              continue
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
