'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const intakeId = searchParams.get('intake_id')
  const [fadeIn, setFadeIn] = useState(false)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFadeIn(true)
        setTimeout(() => setShowConfetti(true), 500)
      })
    })
  }, [])

  const handleMembershipEnroll = async () => {
    setMembershipLoading(true)
    try {
      const res = await fetch('/api/stripe/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setMembershipLoading(false)
    }
  }

  const handleSkipMembership = () => {
    router.push('/patient/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#1A0E30] flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#4ECDC4]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet/5 rounded-full blur-[100px]" />
      </div>

      {/* Confetti-like particles */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-bounce"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `-${Math.random() * 20}%`,
                backgroundColor: ['#4ECDC4', '#FA6B05', '#944fed', '#ffd4b0'][i % 4],
                opacity: 0.4,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center relative z-10 py-12 px-6">
        <div
          className={`transition-all duration-1000 ease-out w-full max-w-lg mx-auto
            ${fadeIn ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}
        >
          {/* Logo */}
          <div className="text-center mb-10">
            <Image
              src="/womenkind-logo.png"
              alt="Womenkind"
              width={500}
              height={100}
              className="h-10 md:h-11 w-auto mx-auto"
              priority
            />
          </div>

          {/* Success card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-10">
            <div className="text-center mb-8">
              {/* Animated checkmark */}
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#4ECDC4]/15 border-2 border-[#4ECDC4]/30 mb-5">
                <svg className="w-10 h-10 text-[#4ECDC4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl text-white mb-3 tracking-tight">
                Payment confirmed
              </h2>
              <p className="text-sm text-white/50 font-sans leading-relaxed max-w-sm mx-auto">
                Your intake has been submitted to your provider. They'll review your AI-generated clinical brief and prepare for your consultation.
              </p>
            </div>

            {/* Status timeline */}
            <div className="mb-8 space-y-3">
              {[
                { label: 'Intake completed', done: true },
                { label: 'Payment confirmed', done: true },
                { label: 'AI clinical brief generated', done: true },
                { label: 'Provider review', done: false, active: true },
                { label: 'Consultation scheduled', done: false },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      step.done
                        ? 'bg-[#4ECDC4]/20 border border-[#4ECDC4]/40'
                        : step.active
                        ? 'bg-violet/20 border border-violet/40'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    {step.done ? (
                      <svg className="w-3.5 h-3.5 text-[#4ECDC4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : step.active ? (
                      <span className="w-2 h-2 rounded-full bg-violet animate-pulse" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-white/20" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-sans ${
                      step.done
                        ? 'text-[#4ECDC4]/80'
                        : step.active
                        ? 'text-violet-light'
                        : 'text-white/30'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Membership upsell */}
            <div className="bg-white/5 rounded-[16px] border border-violet/20 p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-violet/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-violet-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-sans font-semibold text-white mb-1">
                    Continue with membership
                  </h3>
                  <p className="text-sm text-white/40 font-sans leading-relaxed mb-4">
                    Get ongoing care for $200/month — follow-up visits, progress tracking, prescription management, and personalized care presentations.
                  </p>
                  <button
                    onClick={handleMembershipEnroll}
                    disabled={membershipLoading}
                    className="px-6 py-2.5 rounded-full font-sans text-sm font-semibold
                               bg-violet text-white hover:bg-violet-dark shadow-lg shadow-violet/20
                               disabled:opacity-50 transition-all duration-300"
                  >
                    {membershipLoading ? 'Loading...' : 'Enroll — $200/month'}
                  </button>
                </div>
              </div>
            </div>

            {/* Skip / go to portal */}
            <button
              onClick={handleSkipMembership}
              className="w-full py-3 rounded-full font-sans text-sm
                         text-white/40 hover:text-white/60 transition-colors"
            >
              Skip for now — go to patient portal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1A0E30]" />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
