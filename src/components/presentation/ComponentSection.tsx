'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import type { PresentationComponent } from '@/lib/presentation-components'

interface ComponentSectionProps {
  component: PresentationComponent
  providerNote: string
  personalizedBody?: string
  index: number
  total: number
  providerName: string
  onCreamBackground?: boolean
}

export default function ComponentSection({
  component,
  providerNote,
  personalizedBody,
  index,
  total,
  providerName,
  onCreamBackground = true,
}: ComponentSectionProps) {
  const bodyText = (personalizedBody?.trim() || component.defaultExplanation).trim()
  const paragraphs = bodyText.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-10% 0px' })

  return (
    <section
      ref={ref}
      className="min-h-[70vh] flex items-center py-20 md:py-32"
    >
      <div className="w-full max-w-4xl mx-auto px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Section label — Figma-style uppercase with dots */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xs font-sans font-semibold tracking-[0.2em] uppercase mb-8"
            style={{ color: '#944fed' }}
          >
            &bull;&ensp;{index + 1} of {total}&ensp;&bull;
          </motion.p>

          {/* Title — Playfair Display serif */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-serif font-normal text-3xl md:text-4xl lg:text-5xl text-aubergine mb-6 leading-tight"
          >
            {component.label.split('&').map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <span className="text-violet">&amp;</span>}
              </span>
            ))}
          </motion.h2>

          {/* Decorative divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="origin-left h-px w-20 mb-8"
            style={{ backgroundColor: component.color }}
          />

          {/* Patient-facing explanation — warm body text, personalized to this patient */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-10 max-w-2xl space-y-5"
          >
            {paragraphs.map((para, i) => (
              <p
                key={i}
                className="text-base md:text-lg font-sans leading-relaxed"
                style={{ color: '#422a1f' }}
              >
                {para}
              </p>
            ))}
          </motion.div>

          {/* Provider's personalized note */}
          {providerNote && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="rounded-2xl border flex items-start gap-5 p-6 md:p-8"
              style={{
                backgroundColor: onCreamBackground ? '#ffffff' : '#f7f3ee',
                borderColor: onCreamBackground ? '#e8e4df' : '#ebe7e2',
              }}
            >
              <img
                src="/dr-urban.jpg"
                alt={providerName}
                className="w-[62px] h-[62px] rounded-full object-cover object-top flex-shrink-0"
              />
              <p className="text-base font-sans leading-relaxed" style={{ color: '#422a1f' }}>
                {providerNote}
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
