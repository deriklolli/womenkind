'use client'

import { useRef, useEffect } from 'react'
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

  const sectionRef = useRef<HTMLElement>(null)
  const labelRef = useRef<HTMLParagraphElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ctx: any

    const init = async () => {
      const { gsap } = await import('gsap')
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 72%',
            once: true,
          },
          defaults: { ease: 'power3.out' },
        })

        tl.from(labelRef.current, { opacity: 0, y: 12, duration: 0.5 })
          .from(titleRef.current, { opacity: 0, y: 44, duration: 0.75 }, '-=0.25')
          .from(dividerRef.current, { scaleX: 0, transformOrigin: 'left center', duration: 0.65 }, '-=0.5')
          .from(
            bodyRef.current ? Array.from(bodyRef.current.children) : [],
            { opacity: 0, y: 24, stagger: 0.14, duration: 0.65 },
            '-=0.35'
          )

        if (cardRef.current) {
          tl.from(cardRef.current, { opacity: 0, y: 20, duration: 0.55 }, '-=0.25')
        }
      }, sectionRef)
    }

    init()
    return () => ctx?.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="min-h-[70vh] flex items-center py-20 md:py-32"
    >
      <div className="w-full max-w-4xl mx-auto px-8 md:px-16">
        <p
          ref={labelRef}
          className="text-xs font-sans font-semibold tracking-[0.2em] uppercase mb-8"
          style={{ color: '#944fed' }}
        >
          &bull;&ensp;{index + 1} of {total}&ensp;&bull;
        </p>

        <h2
          ref={titleRef}
          className="font-serif font-normal text-3xl md:text-4xl lg:text-5xl text-aubergine mb-6 leading-tight"
        >
          {component.label.split('&').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && <span className="text-violet">&amp;</span>}
            </span>
          ))}
        </h2>

        <div
          ref={dividerRef}
          className="h-px w-20 mb-8"
          style={{ backgroundColor: component.color }}
        />

        <div ref={bodyRef} className="mb-10 max-w-2xl space-y-5">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className="text-base md:text-lg font-sans leading-relaxed"
              style={{ color: '#422a1f' }}
            >
              {para}
            </p>
          ))}
        </div>

        {providerNote && (
          <div
            ref={cardRef}
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
          </div>
        )}
      </div>
    </section>
  )
}
