'use client'

import { useState, useEffect } from 'react'

interface Props {
  section: string
  intro: string
  safetyFrame?: { title: string; message: string }
  onContinue: () => void
}

export default function SectionIntro({ section, intro, safetyFrame, onContinue }: Props) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true))
    })
  }, [])

  return (
    <div
      className={`transition-all duration-700 ease-out w-full max-w-xl mx-auto px-6 text-center
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
    >
      {/* Section icon — decorative dot cluster */}
      <div className="flex items-center justify-center gap-1.5 mb-8">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FA6B05]/60" />
        <span className="w-2 h-2 rounded-full bg-[#FA6B05]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#FA6B05]/60" />
      </div>

      {/* Section name */}
      <p className="text-xs font-sans font-semibold tracking-[0.25em] uppercase text-[#FA6B05]/80 mb-4">
        {section}
      </p>

      {/* Safety framing (for sensitive sections) */}
      {safetyFrame ? (
        <div className="mb-8">
          <h2 className="font-serif text-2xl md:text-3xl text-white mb-4 tracking-tight">
            {safetyFrame.title}
          </h2>
          <p className="text-base text-white/60 font-sans leading-relaxed max-w-md mx-auto">
            {safetyFrame.message}
          </p>
        </div>
      ) : (
        <div className="mb-8">
          <p className="text-lg text-white/60 font-sans leading-relaxed">
            {intro}
          </p>
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="inline-flex items-center gap-3 px-8 py-4 rounded-full font-sans text-sm font-semibold
                   bg-[#FA6B05] text-white hover:bg-[#FF8228] shadow-lg shadow-[#FA6B05]/20
                   hover:shadow-[#FA6B05]/40 transition-all duration-300 mt-4"
      >
        Continue
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>
    </div>
  )
}
