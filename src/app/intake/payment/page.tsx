'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

export default function IntakePaymentPage() {
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

      // Redirect to Stripe Checkout
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
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#FA6B05]/3 rounded-full blur-[100px]" />
      </div>

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

          {/* Payment card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-10">
            {/* Success checkmark */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#4ECDC4]/15 border-2 border-[#4ECDC4]/30 mb-5">
                <svg className="w-8 h-8 text-[#4ECDC4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl text-white mb-3 tracking-tight">
                Your intake is complete
              </h2>
              <p className="text-sm text-white/50 font-sans leading-relaxed max-w-sm mx-auto">
                To submit your responses and schedule your provider consultation, complete your intake payment below.
              </p>
            </div>

            {canceled && (
              <div className="mb-6 px-4 py-3 rounded-brand bg-[#FA6B05]/10 border border-[#FA6B05]/20">
                <p className="text-sm font-sans text-[#FA6B05]">
                  Payment was canceled. You can try again when you're ready.
                </p>
              </div>
            )}

            {/* Price breakdown */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between py-3 border-b border-white/10">
                <div>
                  <p className="text-sm font-sans font-semibold text-white">Intake Assessment</p>
                  <p className="text-xs text-white/40 font-sans mt-0.5">
                    AI-powered clinical intake + provider consultation
                  </p>
                </div>
                <p className="text-lg font-sans font-bold text-white">$650</p>
              </div>

              <button
                onClick={() => setAddMembership(!addMembership)}
                className={`w-full flex items-center justify-between py-3 border-b border-white/10 transition-all duration-300 text-left ${
                  addMembership ? 'opacity-100' : 'opacity-60 hover:opacity-80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                      addMembership
                        ? 'bg-[#4ECDC4] border-[#4ECDC4]'
                        : 'border-white/30'
                    }`}
                  >
                    {addMembership && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-sans font-semibold text-white">Monthly Membership</p>
                    <p className="text-xs text-white/40 font-sans mt-0.5">
                      Ongoing care, follow-ups, prescriptions
                    </p>
                  </div>
                </div>
                <p className="text-lg font-sans font-bold text-white">$200<span className="text-sm font-normal text-white/40">/mo</span></p>
              </button>
            </div>

            {/* What's included */}
            <div className="mb-8">
              <p className="text-xs font-sans font-semibold text-white/30 uppercase tracking-wider mb-3">
                Your intake includes
              </p>
              <div className="space-y-2.5">
                {[
                  'AI-generated clinical brief reviewed by your provider',
                  'Personalized treatment pathway recommendations',
                  'Initial provider consultation (telehealth)',
                  'Secure patient portal access',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-[#4ECDC4] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-sans text-white/60">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 font-sans bg-red-400/10 px-3 py-2 rounded-brand mb-4">
                {error}
              </p>
            )}

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-4 rounded-full font-sans text-base font-semibold
                         bg-[#FA6B05] text-white hover:bg-[#FF8228] shadow-xl shadow-[#FA6B05]/25
                         hover:shadow-[#FA6B05]/40 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Redirecting to checkout...
                </span>
              ) : (
                addMembership ? 'Pay $650 + $200/mo & Submit Intake' : 'Pay $650 & Submit Intake'
              )}
            </button>

            {/* Security note */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs font-sans text-white/20">Secure payment via Stripe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
