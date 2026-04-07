'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { IntakeQuestion } from '@/lib/intake-questions'

/** Auto-format phone: 1234567890 → 123-456-7890 */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Auto-format height: 56 → 5'6" */
function formatHeight(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 3)
  if (digits.length === 0) return ''
  if (digits.length === 1) return `${digits}'`
  // first digit = feet, rest = inches
  const feet = digits[0]
  const inches = digits.slice(1)
  return `${feet}'${inches}"`
}

interface Props {
  question: IntakeQuestion
  value: any
  onChange: (val: any) => void
  onNext: () => void
  onBack: () => void
  isFirst: boolean
  isLast: boolean
  animDirection: 'forward' | 'backward'
}

export default function IntakeQuestionCard({
  question,
  value,
  onChange,
  onNext,
  onBack,
  isFirst,
  isLast,
  animDirection,
}: Props) {
  const [isVisible, setIsVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setIsVisible(false)
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true))
    })
    return () => cancelAnimationFrame(t)
  }, [question.id])

  useEffect(() => {
    if (isVisible && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 350)
      return () => clearTimeout(timer)
    }
  }, [isVisible, question.id])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && question.type !== 'textarea') {
        e.preventDefault()
        onNext()
      }
    },
    [onNext, question.type]
  )

  const canProceed =
    !question.req ||
    (question.type === 'multi' ? Array.isArray(value) && value.length > 0 : value !== undefined && value !== '')

  const translateClass =
    animDirection === 'forward'
      ? isVisible
        ? 'translate-y-0 opacity-100'
        : 'translate-y-8 opacity-0'
      : isVisible
        ? 'translate-y-0 opacity-100'
        : '-translate-y-8 opacity-0'

  return (
    <div
      className={`transition-all duration-500 ease-out ${translateClass} w-full max-w-2xl mx-auto px-6`}
      onKeyDown={handleKeyDown}
    >
      {/* Optional badge (no step counter — adaptive flow means total is dynamic) */}
      {!question.req && (
        <div className="mb-6">
          <span className="text-xs font-sans text-white/30 bg-white/5 px-2.5 py-0.5 rounded-full">
            Optional
          </span>
        </div>
      )}

      {/* Label */}
      <h2 className="font-sans font-semibold text-2xl md:text-3xl text-white leading-snug mb-3 tracking-tight">
        {question.label}
      </h2>

      {/* Sub-label */}
      {question.sub && (
        <p className="text-sm text-white/50 font-sans mb-6 leading-relaxed">{question.sub}</p>
      )}

      {/* Input area */}
      <div className="mt-8">
        {(question.type === 'text' || question.type === 'number') && (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={question.type === 'number' ? 'number' : 'text'}
            inputMode={question.id === 'phone' || question.id === 'height' ? 'numeric' : undefined}
            value={value || ''}
            onChange={(e) => {
              const raw = e.target.value
              if (question.id === 'phone') return onChange(formatPhone(raw))
              if (question.id === 'height') return onChange(formatHeight(raw))
              onChange(raw)
            }}
            placeholder={question.ph}
            className="w-full bg-transparent border-b-2 border-white/20 focus:border-[#FA6B05] py-4 text-white text-lg
                       placeholder:text-white/30 font-sans outline-none transition-colors duration-300"
          />
        )}

        {question.type === 'date' && (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent border-b-2 border-white/20 focus:border-[#FA6B05] py-4 text-white text-lg
                       font-sans outline-none transition-colors duration-300
                       [color-scheme:dark]"
          />
        )}

        {question.type === 'textarea' && (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.ph}
            rows={4}
            className="w-full bg-white/5 border border-white/10 focus:border-[#FA6B05] rounded-2xl p-5 text-white text-base
                       placeholder:text-white/30 font-sans outline-none transition-colors duration-300 resize-none"
          />
        )}

        {question.type === 'single' && question.opts && (
          <div className="space-y-3">
            {question.opts.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt)
                  // Auto-advance after a brief delay for single-select
                  setTimeout(onNext, 350)
                }}
                className={`w-full text-left px-5 py-4 rounded-2xl font-sans text-base transition-all duration-200
                  ${
                    value === opt
                      ? 'bg-[#FA6B05]/15 border-2 border-[#FA6B05] text-white shadow-[0_0_20px_rgba(250,107,5,0.1)]'
                      : 'bg-white/5 border-2 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                  }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200
                    ${value === opt ? 'border-[#FA6B05] bg-[#FA6B05]' : 'border-white/30'}`}
                  >
                    {value === opt && (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </span>
                  {opt}
                </span>
              </button>
            ))}
          </div>
        )}

        {question.type === 'multi' && question.opts && (
          <div className="space-y-3">
            {question.opts.map((opt) => {
              const selected = Array.isArray(value) && value.includes(opt)
              return (
                <button
                  key={opt}
                  onClick={() => {
                    const current = Array.isArray(value) ? [...value] : []
                    if (selected) {
                      onChange(current.filter((v: string) => v !== opt))
                    } else {
                      onChange([...current, opt])
                    }
                  }}
                  className={`w-full text-left px-5 py-4 rounded-2xl font-sans text-base transition-all duration-200
                    ${
                      selected
                        ? 'bg-[#FA6B05]/15 border-2 border-[#FA6B05] text-white shadow-[0_0_20px_rgba(250,107,5,0.1)]'
                        : 'bg-white/5 border-2 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                    }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`w-5 h-5 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200
                      ${selected ? 'border-[#FA6B05] bg-[#FA6B05]' : 'border-white/30'}`}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {opt}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-10">
        <button
          onClick={onBack}
          disabled={isFirst}
          className={`flex items-center gap-2 px-5 py-3 rounded-full font-sans text-sm font-medium transition-all duration-200
            ${isFirst ? 'opacity-0 pointer-events-none' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Only show Next/Submit for non-single-select (single auto-advances) */}
        {(question.type !== 'single' || !canProceed) && (
          <button
            onClick={onNext}
            disabled={!canProceed}
            className={`flex items-center gap-3 px-7 py-3.5 rounded-full font-sans text-sm font-semibold transition-all duration-300
              ${
                canProceed
                  ? 'bg-[#FA6B05] text-white hover:bg-[#FF8228] shadow-lg shadow-[#FA6B05]/20 hover:shadow-[#FA6B05]/40'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
          >
            {isLast ? 'Submit' : 'Next'}
            <span
              className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300
              ${canProceed ? 'bg-white/20' : 'bg-white/5'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </button>
        )}

        {/* Show a subtle next hint for single-select that's already selected */}
        {question.type === 'single' && canProceed && (
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-5 py-3 rounded-full font-sans text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            {isLast ? 'Submit' : 'Next'}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Enter hint */}
      {question.type !== 'single' && question.type !== 'multi' && (
        <p className="text-center text-xs text-white/20 mt-6 font-sans">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/40 text-[10px]">Enter</kbd> to continue
        </p>
      )}
    </div>
  )
}
