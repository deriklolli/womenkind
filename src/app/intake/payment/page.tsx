'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

function IntakePaymentContent() {
  const searchParams = useSearchParams()
  const intakeId = searchParams.get('intake_id')
  const canceled = searchParams.get('canceled') === 'true'
  const [fadeIn, setFadeIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFadeIn(true))
    })
  }, [])

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId, addMembership: false }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Unable to start checkout. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
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

          {canceled && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-terracota/10 border border-terracota/20 text-center">
              <p className="text-sm text-terracota font-sans">
                Your payment was not completed. You can try again below.
              </p>
            </div>
          )}

          <div className="bg-white border border-beige/10 rounded-[24px] p-8 md:p-10 shadow-sm">
            <div className="mb-8">
              <h2 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-3 tracking-tight">
                Complete your intake
              </h2>
              <p className="text-sm text-beige/60 font-sans leading-relaxed">
                One-time payment to submit your health intake and schedule your initial consultation with Dr. Urban.
              </p>
            </div>

            {/* Price row */}
            <div className="flex items-center justify-between py-4 border-t border-b border-beige/15 mb-8">
              <div>
                <p className="text-sm font-semibold text-aubergine font-sans">Health Intake + Initial Consultation</p>
                <p className="text-xs text-beige/50 font-sans mt-0.5">Includes AI-powered clinical brief review</p>
              </div>
              <span className="text-2xl font-serif text-aubergine font-normal">$650</span>
            </div>

            {error && (
              <p className="text-sm text-red-500 font-sans mb-4 text-center">{error}</p>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3.5 rounded-full font-sans text-sm font-semibold
                         bg-violet text-white hover:bg-violet/90 disabled:opacity-60
                         transition-all duration-300"
            >
              {loading ? 'Redirecting to checkout…' : 'Pay $650 & Submit Intake'}
            </button>

            <p className="text-xs text-beige/40 font-sans text-center mt-4">
              Secured by Stripe. Your payment info is never stored on our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function IntakePaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <IntakePaymentContent />
    </Suspense>
  )
}
