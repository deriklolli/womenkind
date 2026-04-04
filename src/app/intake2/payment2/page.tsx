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
    <div className="min-h-screen bg-[#1A0E30] flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-1/3 w-[700px] h-[700px] bg-violet/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-100px] right-1/4 w-[500px] h-[500px] bg-[#4ECDC4]/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-[-100px] w-[400px] h-[400px] bg-[#FA6B05]/4 rounded-full blur-[100px]" />
      </div>

      <div className="flex-1 relative z-10 py-10 md:py-16 px-5 md:px-8">
        <div
          className={`transition-all duration-1000 ease-out w-full max-w-5xl mx-auto
            ${fadeIn ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
        >
          {/* Logo */}
          <div className="text-center mb-12">
            <Image
              src="/womenkind-logo.png"
              alt="Womenkind"
              width={500}
              height={100}
              className="h-9 md:h-10 w-auto mx-auto"
              priority
            />
          </div>

          {/* Headline */}
          <div className="text-center mt-6 mb-14">
            <h1 className="font-serif text-3xl md:text-4xl text-white mb-4 tracking-tight leading-tight">
              You&apos;ve taken the first step
            </h1>
            <p className="text-base text-white/50 font-sans leading-relaxed max-w-lg mx-auto">
              Your responses are ready. Choose your care plan to share them with your provider and begin your personalized menopause care.
            </p>
          </div>

          {canceled && (
            <div className="mb-8 px-4 py-3 rounded-2xl bg-[#FA6B05]/10 border border-[#FA6B05]/20">
              <p className="text-sm font-sans text-[#FA6B05] text-center">
                Payment was canceled. You can try again when you&apos;re ready.
              </p>
            </div>
          )}

          {/* ── Side-by-side cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

          {/* ── Intake Assessment (always included) ── */}
          <div className="bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] rounded-[20px] overflow-hidden flex flex-col">
            {/* Header bar */}
            <div className="px-6 py-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-8 h-8 rounded-full bg-violet/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="font-serif text-xl text-white">Intake Assessment</h2>
                </div>
                <p className="text-sm text-white/40 font-sans pl-11">
                  90-minute comprehensive consultation with your MD provider
                </p>
              </div>
              <span className="text-xl font-sans font-bold text-white pt-1">$650</span>
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-white/[0.06]" />

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
                  <span className="text-sm font-sans text-white/60">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Added button (non-interactive) */}
            <div className="px-6 pb-6">
              <div className="w-full py-3 rounded-full font-sans text-sm font-semibold text-center
                             bg-[#4ECDC4]/15 text-[#4ECDC4] border border-[#4ECDC4]/25 cursor-default
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
                ? 'bg-white/[0.06] backdrop-blur-sm border-[#4ECDC4]/30 shadow-lg shadow-[#4ECDC4]/5'
                : 'bg-white/[0.03] border-white/[0.06]'
            }`}
          >
            {/* Price + Badge */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
              <div>
                <span className="text-xl font-sans font-bold text-white">$200</span>
                <span className="text-sm font-sans text-white/40">/mo</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#FA6B05] text-white text-[11px] font-sans font-semibold tracking-wide uppercase shadow-md shadow-[#FA6B05]/25">
                First Month Free
              </div>
            </div>

            <div className="px-6 py-5 pr-36">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-8 h-8 rounded-full bg-violet/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h2 className="font-serif text-xl text-white">Monthly Membership</h2>
              </div>
              <p className="text-sm text-white/40 font-sans pl-11">
                Ongoing care, prescription management, and provider access
              </p>
            </div>

            <div className="mx-6 border-t border-white/[0.06]" />

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
                  <span className="text-sm font-sans text-white/60">{item}</span>
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
                    ? 'bg-[#4ECDC4]/15 text-[#4ECDC4] border border-[#4ECDC4]/25 hover:bg-[#4ECDC4]/20'
                    : 'bg-[#FA6B05]/15 text-[#FA6B05] border border-[#FA6B05]/25 hover:bg-[#FA6B05] hover:text-white hover:shadow-lg hover:shadow-[#FA6B05]/20'
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
          <div className="bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-[20px] p-6 md:p-8 max-w-md mx-auto">
            {/* Line items */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-sans text-white/60">Intake Assessment</span>
                <span className="text-sm font-sans font-medium text-white">$650</span>
              </div>
              {addMembership && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-sans text-white/60">Monthly Membership</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-sans text-white/30 line-through">$200</span>
                    <span className="text-sm font-sans font-medium text-[#4ECDC4]">Free</span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.08] mb-5" />

            {/* Total */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-sans font-semibold text-white/40 uppercase tracking-wider">
                Due today
              </span>
              <div className="text-right">
                <span className="text-3xl font-sans font-bold text-white">${total}</span>
                {addMembership && (
                  <p className="text-xs text-white/30 font-sans mt-1">$200/mo starting month 2</p>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400 font-sans">{error}</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-4 rounded-full font-sans text-base font-semibold
                         bg-[#FA6B05] text-white hover:bg-[#FF8228]
                         shadow-lg shadow-[#FA6B05]/20 hover:shadow-xl hover:shadow-[#FA6B05]/30
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
                <svg className="w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs font-sans text-white/25">Secure checkout</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-xs font-sans text-white/25">HIPAA compliant</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span className="text-xs font-sans text-white/25">Powered by Stripe</span>
              </div>
            </div>
          </div>

          {/* Cancellation note */}
          <p className="text-center text-xs text-white/20 font-sans mt-6">
            Membership can be canceled anytime from your patient portal.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function IntakePaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1A0E30]" />}>
      <IntakePaymentContent />
    </Suspense>
  )
}
