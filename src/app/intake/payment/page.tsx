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
  const [includeIntake, setIncludeIntake] = useState(true)
  const [addMembership, setAddMembership] = useState(true)

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFadeIn(true))
    })
  }, [])

  const total = (includeIntake ? 650 : 0) + (addMembership ? 200 : 0)

  const handleCheckout = async () => {
    if (total === 0) return
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
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#FA6B05]/3 rounded-full blur-[100px]" />
      </div>

      <div className="flex-1 flex items-center justify-center relative z-10 py-12 px-6">
        <div
          className={`transition-all duration-1000 ease-out w-full max-w-5xl mx-auto
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

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#4ECDC4]/15 border-2 border-[#4ECDC4]/30 mb-5">
              <svg className="w-8 h-8 text-[#4ECDC4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl text-white mb-3 tracking-tight">
              Your intake is complete
            </h2>
            <p className="text-sm text-white/50 font-sans leading-relaxed max-w-md mx-auto">
              Choose your care package below to submit your responses and begin your journey.
            </p>
          </div>

          {canceled && (
            <div className="mb-6 max-w-lg mx-auto px-4 py-3 rounded-brand bg-[#FA6B05]/10 border border-[#FA6B05]/20">
              <p className="text-sm font-sans text-[#FA6B05] text-center">
                Payment was canceled. You can try again when you&apos;re ready.
              </p>
            </div>
          )}

          {/* 3-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">

            {/* LEFT — Intake Assessment Card */}
            <button
              onClick={() => setIncludeIntake(!includeIntake)}
              className={`text-left rounded-[24px] overflow-hidden border transition-all duration-300 ${
                includeIntake
                  ? 'bg-white/8 border-[#4ECDC4]/40 shadow-lg shadow-[#4ECDC4]/10'
                  : 'bg-white/4 border-white/10 opacity-60 hover:opacity-80'
              }`}
            >
              {/* Image */}
              <div className="relative h-44 w-full overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=80&fit=crop&crop=faces"
                  alt="Intake Assessment"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E30] via-[#1A0E30]/40 to-transparent" />

                {/* Checkbox overlay */}
                <div className="absolute top-4 right-4">
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                    includeIntake ? 'bg-[#4ECDC4] border-[#4ECDC4]' : 'border-white/40 bg-black/20'
                  }`}>
                    {includeIntake && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif text-lg text-white">Intake Assessment</h3>
                  <span className="text-lg font-sans font-bold text-white">$650</span>
                </div>
                <p className="text-xs text-white/40 font-sans mb-5">
                  90 minute comprehensive consultation with your MD provider
                </p>

                <div className="space-y-2.5">
                  {[
                    'Comprehensive health assessment review',
                    'Personalized treatment pathway recommendations',
                    'Your Future Health Blueprint presentation',
                    'Initial provider consultation (telehealth)',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg className="w-3.5 h-3.5 text-[#4ECDC4] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs font-sans text-white/50">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </button>

            {/* CENTER — Checkout Summary */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 w-full lg:w-72 self-center">
              {/* Selected items summary */}
              <div className="space-y-3 mb-6">
                {includeIntake && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-sans text-white/70">Intake Assessment</span>
                    <span className="text-sm font-sans font-semibold text-white">$650</span>
                  </div>
                )}
                {addMembership && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-sans text-white/70">Monthly Membership</span>
                    <span className="text-sm font-sans font-semibold text-white">$200<span className="text-xs font-normal text-white/40">/mo</span></span>
                  </div>
                )}
                {!includeIntake && !addMembership && (
                  <p className="text-sm font-sans text-white/30 text-center">Select at least one item</p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 mb-4" />

              {/* Total */}
              <div className="flex items-center justify-between mb-8">
                <span className="text-sm font-sans font-semibold text-white/50 uppercase tracking-wider">Total</span>
                <div className="text-right">
                  <span className="text-2xl font-sans font-bold text-white">${total}</span>
                  {addMembership && <p className="text-xs text-white/30 font-sans mt-0.5">+ $200/mo after first month</p>}
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
                disabled={loading || total === 0}
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
                ) : total === 0 ? (
                  'Select a package'
                ) : (
                  `Pay $${total} & Submit Intake`
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

            {/* RIGHT — Monthly Membership Card */}
            <button
              onClick={() => setAddMembership(!addMembership)}
              className={`text-left rounded-[24px] overflow-hidden border transition-all duration-300 ${
                addMembership
                  ? 'bg-white/8 border-[#4ECDC4]/40 shadow-lg shadow-[#4ECDC4]/10'
                  : 'bg-white/4 border-white/10 opacity-60 hover:opacity-80'
              }`}
            >
              {/* Image */}
              <div className="relative h-44 w-full overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80&fit=crop&crop=center"
                  alt="Monthly Membership"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E30] via-[#1A0E30]/40 to-transparent" />

                {/* Checkbox overlay */}
                <div className="absolute top-4 right-4">
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                    addMembership ? 'bg-[#4ECDC4] border-[#4ECDC4]' : 'border-white/40 bg-black/20'
                  }`}>
                    {addMembership && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif text-lg text-white">Monthly Membership</h3>
                  <span className="text-lg font-sans font-bold text-white">$200<span className="text-sm font-normal text-white/40">/mo</span></span>
                </div>
                <p className="text-xs text-white/40 font-sans mb-5">
                  Continuous care and support on your wellness journey
                </p>

                <div className="space-y-2.5">
                  {[
                    'Ongoing provider follow-up consultations',
                    'Prescription management and refills',
                    'Lab work coordination and review',
                    'Secure patient portal access',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg className="w-3.5 h-3.5 text-[#4ECDC4] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs font-sans text-white/50">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}
