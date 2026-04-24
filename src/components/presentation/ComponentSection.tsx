'use client'

import { useRef, useEffect } from 'react'
import type { PresentationComponent } from '@/lib/presentation-components'
import { SECTION_IMAGES } from '@/lib/presentation-section-images'

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

  const sectionImage = SECTION_IMAGES[component.key] ?? null

  const sectionRef  = useRef<HTMLElement>(null)
  const labelRef    = useRef<HTMLParagraphElement>(null)
  const titleRef    = useRef<HTMLHeadingElement>(null)
  const dividerRef  = useRef<HTMLDivElement>(null)
  const bodyRef     = useRef<HTMLDivElement>(null)
  const cardRef     = useRef<HTMLDivElement>(null)
  const imgBoxRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ctx: any

    const init = async () => {
      const { gsap } = await import('gsap')
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      ctx = gsap.context(() => {
        // ── Scroll-in timeline ──────────────────────────────────────────
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 72%',
            once: true,
          },
          defaults: { ease: 'power3.out' },
        })

        if (imgBoxRef.current) {
          tl.from(imgBoxRef.current, {
            opacity: 0,
            x: sectionImage?.side === 'left' ? -60 : 60,
            scale: 0.96,
            duration: 1.1,
          }, 0)
        }

        if (labelRef.current)   tl.from(labelRef.current,   { opacity: 0, y: 14, duration: 0.5 }, 0)
        if (titleRef.current)   tl.from(titleRef.current,   { opacity: 0, y: 48, duration: 0.8 }, '-=0.3')
        if (dividerRef.current) tl.from(dividerRef.current, { scaleX: 0, transformOrigin: 'left center', duration: 0.65 }, '-=0.5')
        if (bodyRef.current)    tl.from(Array.from(bodyRef.current.children), { opacity: 0, y: 26, stagger: 0.14, duration: 0.65 }, '-=0.4')
        if (cardRef.current)    tl.from(cardRef.current,    { opacity: 0, y: 20, duration: 0.55 }, '-=0.3')

        // ── 3D tilt on image box ────────────────────────────────────────
        if (imgBoxRef.current) {
          const box = imgBoxRef.current

          const onMove = (e: MouseEvent) => {
            const rect = box.getBoundingClientRect()
            const x = (e.clientX - rect.left)  / rect.width  - 0.5
            const y = (e.clientY - rect.top)   / rect.height - 0.5
            gsap.to(box, {
              rotateY:  x * 14,
              rotateX: -y * 14,
              scale: 1.03,
              duration: 0.4,
              ease: 'power2.out',
            })
          }

          const onLeave = () => {
            gsap.to(box, {
              rotateX: 0,
              rotateY: 0,
              scale: 1,
              duration: 0.7,
              ease: 'elastic.out(1, 0.5)',
            })
          }

          box.addEventListener('mousemove', onMove)
          box.addEventListener('mouseleave', onLeave)

          return () => {
            box.removeEventListener('mousemove', onMove)
            box.removeEventListener('mouseleave', onLeave)
          }
        }
      }, sectionRef)
    }

    init()
    return () => ctx?.revert()
  }, [sectionImage])

  const textContent = (
    <>
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

      <div ref={bodyRef} className="mb-10 space-y-5">
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
            borderColor:     onCreamBackground ? '#e8e4df' : '#ebe7e2',
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
    </>
  )

  return (
    <section
      ref={sectionRef}
      className="min-h-[70vh] flex items-center py-20 md:py-32"
    >
      {sectionImage ? (
        // Split layout — text + image side by side
        <div
          className="w-full max-w-6xl mx-auto px-8 md:px-16 flex items-center gap-14"
          style={{ perspective: '1000px' }}
        >
          {sectionImage.side === 'left' && (
            <div
              ref={imgBoxRef}
              className="hidden md:block flex-shrink-0 rounded-[20px] overflow-hidden shadow-[0_20px_60px_rgba(60,30,10,0.13)]"
              style={{ width: '38%', aspectRatio: '3/4', willChange: 'transform' }}
            >
              <img
                src={sectionImage.src}
                alt=""
                className="w-full h-full object-cover"
                style={{ objectPosition: sectionImage.objectPosition ?? 'center top' }}
              />
            </div>
          )}

          <div className="flex-1 max-w-2xl">
            {textContent}
          </div>

          {sectionImage.side === 'right' && (
            <div
              ref={imgBoxRef}
              className="hidden md:block flex-shrink-0 rounded-[20px] overflow-hidden shadow-[0_20px_60px_rgba(60,30,10,0.13)]"
              style={{ width: '38%', aspectRatio: '3/4', willChange: 'transform' }}
            >
              <img
                src={sectionImage.src}
                alt=""
                className="w-full h-full object-cover"
                style={{ objectPosition: sectionImage.objectPosition ?? 'center top' }}
              />
            </div>
          )}
        </div>
      ) : (
        // Text-only layout
        <div className="w-full max-w-4xl mx-auto px-8 md:px-16">
          {textContent}
        </div>
      )}
    </section>
  )
}
