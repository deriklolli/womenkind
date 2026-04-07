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

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFadeIn(true)
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
    <div className="min-h-screen bg-cream flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-1/3 w-[700px] h-[700px] bg-natural/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-100px] right-1/4 w-[500px] h-[500px] bg-aubergine/4 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-[-100px] w-[400px] h-[400px] bg-terracota/5 rounded-full blur-[100px]" />
      </div>

      <div className="flex-1 flex items-center justify-center relative z-10 py-12 px-6">
        <div
          className={`transition-all duration-1000 ease-out w-full max-w-lg mx-auto
            ${fadeIn ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}
        >
          {/* Logo */}
          <div className="text-center mb-10">
            <Image
              src="/womenkind-logo-dark.png"
              alt="Womenkind"
              width={500}
              height={100}
              className="h-20 md:h-24 w-auto mx-auto"
              priority
            />
          </div>

          {/* Success card */}
          <div className="bg-white border border-beige/10 rounded-[24px] p-8 md:p-10 shadow-sm">
            <div className="text-center mb-8">
              {/* Checkmark */}
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-violet/10 border-2 border-violet/20 mb-5">
                <svg className="w-10 h-10 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-sans font-semibold text-2xl md:text-3xl text-aubergine mb-3 tracking-tight">
                Payment confirmed
              </h2>
              <p className="text-sm text-beige/60 font-sans leading-relaxed max-w-sm mx-auto">
                Your intake has been submitted to your provider. They'll review your clinical brief and prepare for your consultation.
              </p>
            </div>

            {/* Dashboard CTA */}
            <button
              onClick={handleSkipMembership}
              className="w-full py-3.5 rounded-full font-sans text-sm font-semibold
                         bg-violet text-white hover:bg-violet/90
                         transition-all duration-300"
            >
              See your dashboard & schedule your consultation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
