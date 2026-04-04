'use client'

import Image from 'next/image'
import { SECTIONS } from '@/lib/intake-questions'

interface Props {
  currentSection: string
  progress: number // 0-100
}

export default function IntakeProgressLight({ currentSection, progress }: Props) {
  const sectionIndex = SECTIONS.indexOf(currentSection as any)

  return (
    <div className="w-full">
      {/* Top bar: logo + progress */}
      <div className="flex items-center justify-between px-6 py-1 bg-white">
        {/* Logo */}
        <Image
          src="/womenkind-logo-dark.png"
          alt="Womenkind"
          width={400}
          height={80}
          className="h-16 w-auto -ml-2.5"
          priority
        />

        {/* Percentage */}
        <span className="text-xs font-sans font-semibold text-violet tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-[2px] bg-transparent relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet to-violet-light transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
