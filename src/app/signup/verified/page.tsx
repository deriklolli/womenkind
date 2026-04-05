'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

export default function VerifiedPage() {
  const router = useRouter()
  const [fadeIn, setFadeIn] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFadeIn(true))
    })

    // Get the user's name and ensure patient record exists
    const setupPatient = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      if (session.user.user_metadata?.first_name) {
        setUserName(session.user.user_metadata.first_name)
      }

      // Create patient record if it doesn't exist
      try {
        await fetch('/api/auth/create-patient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id }),
        })
      } catch (err) {
        console.error('Failed to create patient record:', err)
      }
    }
    setupPatient()
  }, [])

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div
        className={`w-full max-w-md transition-all duration-1000 ease-out
          ${fadeIn ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/womenkind-logo-dark.png"
            alt="Womenkind"
            width={600}
            height={135}
            className="h-[120px] w-auto mx-auto mb-2"
            priority
          />
        </div>

        {/* Verified card */}
        <div className="bg-white rounded-card shadow-lg shadow-aubergine/5 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet/10 border-2 border-violet/20 mb-5">
            <svg className="w-8 h-8 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="font-serif text-xl text-aubergine mb-3">
            {userName ? `Welcome, ${userName}` : 'Email verified'}
          </h2>
          <p className="text-sm font-sans text-aubergine/50 leading-relaxed mb-8">
            Your account is ready. Start your intake survey to help your provider understand your health history and goals.
          </p>

          <button
            onClick={() => router.push('/intake')}
            className="w-full py-3.5 rounded-full font-sans text-sm font-semibold
                       bg-violet text-white hover:bg-violet/90
                       transition-all duration-300"
          >
            Begin your intake survey
          </button>
        </div>
      </div>
    </div>
  )
}
