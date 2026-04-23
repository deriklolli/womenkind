'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { getComponents, type PresentationComponent } from '@/lib/presentation-components'
import ComponentSection from '@/components/presentation/ComponentSection'

interface Presentation {
  id: string
  patient_id: string
  provider_id: string
  selected_components: string[]
  component_notes: Record<string, { provider_note: string; ai_draft?: string; personalized_body?: string }>
  welcome_message: string | null
  closing_message: string | null
  status: string
  created_at: string
}

export default function PresentationViewerPage() {
  const params = useParams()
  const presentationId = params.id as string

  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [firstName, setFirstName] = useState<string>('there')
  const [components, setComponents] = useState<PresentationComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPresentation()
  }, [presentationId])

  const loadPresentation = async () => {
    try {
      const res = await fetch(`/api/presentations/${presentationId}`)
      if (!res.ok) {
        setError('Presentation not found')
        return
      }

      const { presentation: pres, patientName } = await res.json()

      setPresentation(pres as Presentation)
      setFirstName(patientName || 'there')

      // Resolve components
      const comps = getComponents(pres.selected_components)
      setComponents(comps)

      // Mark as viewed if status is 'sent'
      if (pres.status === 'sent') {
        await fetch(`/api/presentations/${presentationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'viewed', viewed_at: new Date().toISOString() }),
        })
      }
    } catch (err) {
      console.error('Failed to load presentation:', err)
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-aubergine flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-sans text-white/40">Loading your care summary...</p>
        </div>
      </div>
    )
  }

  if (error || !presentation) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="font-sans font-semibold text-xl text-aubergine/30">{error || 'Not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Opening section - dark hero */}
      <section className="min-h-screen bg-aubergine flex items-center justify-center relative overflow-hidden">
        {/* Ambient background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-terracota/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            <Image
              src="/womenkind-logo.png"
              alt="Womenkind"
              width={200}
              height={45}
              className="h-[42px] w-auto mx-auto mb-12 opacity-60"
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
            className="font-serif font-normal text-3xl md:text-4xl text-white mb-6 leading-tight"
          >
            Your Future Health<br />Blueprint Summary
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-base font-sans text-white/60 leading-relaxed mb-10 max-w-lg mx-auto"
          >
            {presentation.welcome_message ||
              `${firstName}, I've put together a personalized summary of what's happening in your body and how we're going to address it together.`}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="flex items-center justify-center gap-3 text-sm font-sans"
            style={{ color: '#d4b896' }}
          >
            <span>Prepared by Dr. Joseph Urban Jr.</span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'rgba(212,184,150,0.5)' }} />
            <span>
              {new Date(presentation.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </motion.div>

        </div>

        {/* Scroll indicator — violet circle with bouncing arrow, clicks to next section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10"
        >
          <button
            onClick={() => {
              document.getElementById('overview-section')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="w-12 h-12 rounded-full border-2 border-violet flex items-center justify-center cursor-pointer hover:bg-violet/10 transition-colors"
          >
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg className="w-5 h-5 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </button>
        </motion.div>
      </section>

      {/* Body overview section — full-bleed hero image */}
      <section
        id="overview-section"
        className="relative min-h-screen flex items-center overflow-hidden"
      >
        {/* Hero background image */}
        <div className="absolute inset-0" style={{ backgroundColor: '#c9b8a8' }} />
        <img
          src="/middleagedwoman.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        {/* Warm brown gradient overlay — left-weighted for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(90,62,38,0.95) 0%, rgba(90,62,38,0.85) 30%, rgba(90,62,38,0.4) 52%, rgba(90,62,38,0.0) 70%)',
          }}
        />
        {/* Subtle bottom gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(70,50,35,0.3) 0%, transparent 30%)',
          }}
        />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-8 md:px-16 py-24" style={{ maxWidth: '720px', marginLeft: 0 }}>
          <div style={{ paddingLeft: '72px', paddingRight: 0 }}>
            {/* Section label */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-xs font-sans font-semibold tracking-[0.2em] uppercase mb-6"
              style={{ color: 'rgba(255,230,200,0.75)' }}
            >
              &bull;&ensp;{firstName}&apos;s Care Plan&ensp;&bull;
            </motion.p>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="font-serif font-normal text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-6"
            >
              Understanding Your Care<br />Brings Peace of Mind
            </motion.h2>

            {/* Body text */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-base font-sans leading-relaxed mb-10 max-w-md"
              style={{ color: 'rgba(255,255,255,0.78)' }}
            >
              Knowing what&apos;s happening in your body — and why — makes the journey feel lighter.
              We&apos;ve identified {components.length} areas to focus on together, each explained in plain language below.
            </motion.p>

            {/* Component pills — violet bg, white text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap gap-2"
            >
              {components.map((comp, i) => (
                <motion.a
                  key={comp.key}
                  href={`#section-${comp.key}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.6 + i * 0.08 }}
                  className="text-sm font-sans font-semibold px-5 py-3 rounded-full text-white cursor-pointer transition-all duration-200 hover:opacity-90 hover:-translate-y-px"
                  style={{ backgroundColor: '#944fed' }}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(`section-${comp.key}`)?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  {comp.shortLabel}
                </motion.a>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Component sections — alternating cream / white per Figma */}
      <div>
        {components.map((comp, i) => (
          <div
            key={comp.key}
            id={`section-${comp.key}`}
            className={i % 2 === 0 ? 'bg-cream' : 'bg-white'}
          >
            <ComponentSection
              component={comp}
              providerNote={presentation.component_notes[comp.key]?.provider_note || ''}
              personalizedBody={presentation.component_notes[comp.key]?.personalized_body || ''}
              index={i}
              total={components.length}
              providerName="Dr. Urban"
              onCreamBackground={i % 2 === 0}
            />
          </div>
        ))}
      </div>

      {/* Closing section */}
      <section className="bg-aubergine py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-12 h-12 mx-auto mb-6 rounded-full bg-violet/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>

            <h2 className="font-serif font-normal text-2xl md:text-3xl text-white mb-6">
              You&apos;re Not Alone in This
            </h2>

            <p className="text-base font-sans text-white/60 leading-relaxed mb-8">
              {presentation.closing_message ||
                "Remember, this is a journey and you're not alone in it. I'm here to guide you every step of the way. — Dr. Urban"}
            </p>

            <div className="h-px w-16 mx-auto bg-white/10 mb-8" />

            <p className="text-sm font-sans text-white/30">
              This care summary was prepared exclusively for you by Dr. Joseph Urban Jr.
              <br />
              You can revisit this presentation anytime from your patient portal.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-aubergine border-t border-white/5 py-6">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <Image
            src="/womenkind-logo.png"
            alt="Womenkind"
            width={120}
            height={27}
            className="h-5 w-auto opacity-30"
          />
          <p className="text-xs font-sans text-white/20">
            &copy; {new Date().getFullYear()} Womenkind. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
