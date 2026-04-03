'use client'

import { motion } from 'framer-motion'

interface BodySilhouetteProps {
  activeZones: { cx: number; cy: number; r: number; color: string }[]
}

export default function BodySilhouette({ activeZones }: BodySilhouetteProps) {
  return (
    <div className="relative w-full max-w-[120px] mx-auto">
      <svg
        viewBox="0 0 100 200"
        className="w-full h-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body silhouette - stylized, abstract human form */}
        <defs>
          <linearGradient id="bodyGradient" x1="50" y1="0" x2="50" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#280f49" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#280f49" stopOpacity="0.03" />
          </linearGradient>
          {activeZones.map((zone, i) => (
            <radialGradient key={`glow-${i}`} id={`zone-glow-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={zone.color} stopOpacity="0.4" />
              <stop offset="70%" stopColor={zone.color} stopOpacity="0.1" />
              <stop offset="100%" stopColor={zone.color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* Head */}
        <ellipse cx="50" cy="18" rx="12" ry="14" fill="url(#bodyGradient)" stroke="#280f49" strokeOpacity="0.06" strokeWidth="0.5" />

        {/* Neck */}
        <rect x="46" y="32" width="8" height="6" rx="2" fill="url(#bodyGradient)" stroke="#280f49" strokeOpacity="0.06" strokeWidth="0.5" />

        {/* Torso */}
        <path
          d="M 30 38 Q 30 36 34 36 L 66 36 Q 70 36 70 38 L 72 80 Q 72 90 65 92 L 55 95 Q 50 96 45 95 L 35 92 Q 28 90 28 80 Z"
          fill="url(#bodyGradient)"
          stroke="#280f49"
          strokeOpacity="0.06"
          strokeWidth="0.5"
        />

        {/* Left arm */}
        <path
          d="M 30 38 Q 22 40 18 55 Q 15 65 16 80 Q 16 85 18 85"
          stroke="#280f49"
          strokeOpacity="0.06"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Right arm */}
        <path
          d="M 70 38 Q 78 40 82 55 Q 85 65 84 80 Q 84 85 82 85"
          stroke="#280f49"
          strokeOpacity="0.06"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left leg */}
        <path
          d="M 40 95 Q 38 120 36 145 Q 35 160 36 175 Q 36 185 34 190"
          stroke="#280f49"
          strokeOpacity="0.06"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Right leg */}
        <path
          d="M 60 95 Q 62 120 64 145 Q 65 160 64 175 Q 64 185 66 190"
          stroke="#280f49"
          strokeOpacity="0.06"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Active zone highlights */}
        {activeZones.map((zone, i) => (
          <motion.circle
            key={i}
            cx={zone.cx}
            cy={(zone.cy / 100) * 200}
            r={zone.r * 1.8}
            fill={`url(#zone-glow-${i})`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
          />
        ))}

        {/* Pulsing dots at zone centers */}
        {activeZones.map((zone, i) => (
          <motion.circle
            key={`dot-${i}`}
            cx={zone.cx}
            cy={(zone.cy / 100) * 200}
            r={2.5}
            fill={zone.color}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6] }}
            transition={{ duration: 1.5, delay: i * 0.15 + 0.3, repeat: Infinity, repeatType: 'reverse' }}
          />
        ))}
      </svg>
    </div>
  )
}
