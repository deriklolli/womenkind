'use client'

import Image from 'next/image'
import { SECTIONS } from '@/lib/intake-questions'

interface Props {
  currentSection: string
  progress: number // 0-100
}

export default function IntakeProgress({ currentSection, progress }: Props) {
  const sectionIndex = SECTIONS.indexOf(currentSection as any)

  return (
    <div className="w-full">
      {/* Top bar: logo + progress */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Image
          src="/womenkind-logo.png"
          alt="Womenkind"
          width={400}
          height={80}
          className="h-5 w-auto"
          priority
        />

        {/* Percentage */}
        <span className="text-xs font-sans font-semibold text-[#FA6B05] tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-[2px] bg-white/10 relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FA6B05] to-[#FF8228] transition-all duration-700 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          {/* Glow effect */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-4 bg-[#FA6B05]/50 blur-md rounded-full" />
        </div>
      </div>

      {/* Section dots */}
      <div className="flex items-center justify-center gap-1.5 pt-3 pb-1">
        {SECTIONS.map((sec, i) => (
          <div
            key={sec}
            className={`rounded-full transition-all duration-500
              ${
                i < sectionIndex
                  ? 'w-2 h-2 bg-[#FA6B05]'
                  : i === sectionIndex
                    ? 'w-6 h-2 bg-[#FA6B05] rounded-full'
                    : 'w-2 h-2 bg-white/15'
              }`}
            title={sec}
          />
        ))}
      </div>
    </div>
  )
}
