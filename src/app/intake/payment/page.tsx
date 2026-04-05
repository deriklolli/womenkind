'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

function IntakePaymentContent() {
  const searchParams = useSearchParams()
  const intakeId = searchParams.get('intake_id')
  const canceled = searchParams.get('canceled')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fadeIn, setFadeIn] = useState(false)
  const [addMembership, setAddMembership] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFadeIn(true))
    })
  }, [])

  const total = 650

  const handleCheckout = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId, addMembership }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to create checkout session')

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
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

      <div className="flex-1 relative z-10 py-10 md:py-16 px-5 md:px-8">
        <div
          className={`transition-all duration-1000 ease-out w-full max-w-5xl mx-auto
            ${fadeIn ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
        >
          {/* Logo */}
          <div className="text-center mb-12">
            <Image
              src="/womenkind-logo-dark.png"
              alt="Womenkind"
              width={500}
              height={100}
              className="h-20 md:h-24 w-auto mx-auto"
              priority
            />
          </div>

          {/* Headline */}
          <div className="text-center mt-6 mb-14">
            <h1 className="font-serif text-3xl md:text-4xl text-aubergine mb-4 tracking-tight leading-tight">
              You&apos;ve taken the first step
            </h1>
            <p className="text-base text-beige/70 font-sans leading-relaxed max-w-lg mx-auto">
              Your responses are ready. Choose your care plan to share them with your provider and begin your personalized menopause care.
            </p>
          </div>

          {canceled && (
            <div className="mb-8 px-4 py-3 rounded-2xl bg-terracota/10 border border-terracota/30">
              <p className="text-sm font-sans text-terracota text-center">
                Payment was canceled. You can try again when you&apos;re ready.
              </p>
            </div>
          )}

          {/* ── Side-by-side cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

          {/* ── Intake Assessment (always included) ── */}
          <div className="bg-white border border-violet rounded-[20px] overflow-hidden flex flex-col shadow-sm">
            {/* Header bar */}
            <div className="px-6 py-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="font-serif text-xl text-aubergine mb-1.5">Intake Assessment</h2>
                <p className="text-sm text-beige/50 font-sans">
                  90-minute comprehensive consultation with your<br />MD provider
                </p>
              </div>
              <span className="text-xl font-sans font-bold text-beige pt-1">$650</span>
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-aubergine/8" />

            {/* Benefits */}
            <div className="px-6 py-5 space-y-3 flex-1">
              {[
                { icon: 'clipboard', text: 'Comprehensive health assessment review' },
                { icon: 'route', text: 'Personalized treatment pathway' },
                { icon: 'presentation', text: 'Your Future Health Blueprint' },
                { icon: 'video', text: 'Initial provider consultation (telehealth)' },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-[#4ECDC4] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-sans text-beige/70">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Added button (non-interactive) */}
            <div className="px-6 pb-6">
              <div className="w-full py-3 rounded-full font-sans text-sm font-semibold text-center
                             bg-violet/10 text-violet border border-violet/25 cursor-default
                             flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Added
              </div>
            </div>
          </div>

          {/* ── Membership Add-on ── */}
          <div className={`relative flex flex-col rounded-[20px] overflow-hidden border transition-all duration-300 ${
              addMembership
                ? 'bg-white border-violet shadow-sm'
                : 'bg-white border-aubergine/8'
            }`}
          >
            {/* Price + Badge */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
              <div>
                <span className="text-xl font-sans font-bold text-beige">$200</span>
                <span className="text-sm font-sans text-beige/50">/mo</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-violet/10 text-violet text-[11px] font-sans font-semibold tracking-wide uppercase border border-violet/20">
                First Month Free
              </div>
            </div>

            <div className="px-6 py-5 pr-36">
              <h2 className="font-serif text-xl text-aubergine mb-1.5">Monthly Membership</h2>
              <p className="text-sm text-beige/50 font-sans">
                Ongoing care, prescription management, and provider access
              </p>
            </div>

            <div className="mx-6 border-t border-aubergine/8" />

            {/* Benefits */}
            <div className="px-6 py-5 space-y-3 flex-1">
              {[
                'Ongoing provider follow-up consultations',
                'Prescription management & refills',
                'Lab work coordination & review',
                'Secure patient portal access',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-[#4ECDC4] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-sans text-beige/70">{item}</span>
                </div>
              ))}
            </div>

            {/* Add/Remove button */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setAddMembership(!addMembership)}
                className={`w-full py-3 rounded-full font-sans text-sm font-semibold text-center
                           transition-all duration-300 flex items-center justify-center gap-2 ${
                  addMembership
                    ? 'bg-violet/10 text-violet border border-violet/25 hover:bg-violet/15'
                    : 'bg-violet text-white hover:bg-violet-dark active:scale-[0.98]'
                }`}
              >
                {addMembership ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Added
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Membership
                  </>
                )}
              </button>
            </div>
          </div>

          </div>{/* end side-by-side grid */}

          {/* ── Checkout ── */}
          <div className="mt-10 flex flex-col items-center">
            {/* Due today */}
            <div className="text-center mb-4">
              <span className="text-sm font-sans font-semibold text-beige/50 uppercase tracking-wider">Due today</span>
              <div className="mt-1">
                <span className="text-3xl font-sans font-bold text-aubergine">${total}</span>
              </div>
              {addMembership && (
                <p className="text-xs text-beige/40 font-sans mt-1">+ $200/mo starting month 2</p>
              )}
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-2xl bg-red-100 border border-red-300 w-full max-w-lg">
                <p className="text-sm text-red-700 font-sans text-center">{error}</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full max-w-lg py-4 rounded-full font-sans text-base font-semibold
                         bg-violet text-white hover:bg-violet-dark
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300 active:scale-[0.98]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Redirecting to secure checkout...
                </span>
              ) : (
                `Continue to Payment — $${total}`
              )}
            </button>

            {/* Trust signals */}
            <div className="mt-5 flex items-center justify-center gap-5">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-beige/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs font-sans text-beige/40">Secure checkout</span>
              </div>
              <div className="w-px h-3 bg-beige/20" />
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-beige/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-xs font-sans text-beige/40">HIPAA compliant</span>
              </div>
              <div className="w-px h-3 bg-beige/20" />
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-beige/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span className="text-xs font-sans text-beige/40">Powered by Stripe</span>
              </div>
            </div>

            {/* Demo bypass */}
            <button
              onClick={async () => {
                setDemoLoading(true)
                try {
                  // Skip Stripe — just redirect to success
                  window.location.href = `/intake/payment-success?session_id=demo&intake_id=${intakeId || ''}`
                } catch {
                  setDemoLoading(false)
                }
              }}
              disabled={demoLoading}
              className="mt-4 text-xs font-sans text-aubergine/25 hover:text-violet/60 transition-colors underline underline-offset-2"
            >
              {demoLoading ? 'Redirecting...' : 'Demo: Skip Payment'}
            </button>

            {/* Cancellation note */}
            <p className="text-center text-xs text-beige/40 font-sans mt-4">
              Membership can be canceled anytime from your patient portal.
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
