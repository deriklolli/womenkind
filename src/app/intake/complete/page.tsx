'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function IntakeCompletePage() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })

    const timer = setTimeout(() => {
      router.replace('/patient/dashboard')
    }, 4000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-1/3 w-[700px] h-[700px] bg-natural/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-100px] right-1/4 w-[500px] h-[500px] bg-aubergine/4 rounded-full blur-[120px]" />
      </div>

      <div
        className={`relative z-10 flex flex-col items-center text-center px-6 transition-all duration-1000 ease-out
          ${visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
      >
        <Image
          src="/womenkind-logo-dark.png"
          alt="Womenkind"
          width={400}
          height={80}
          className="h-16 w-auto mb-16"
          priority
        />

        {/* Animated indicator */}
        <div className="relative mb-10">
          <div className="w-16 h-16 rounded-full border-2 border-violet/20 border-t-violet animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-violet animate-pulse" />
          </div>
        </div>

        <h1 className="font-serif font-normal text-3xl text-aubergine mb-3 tracking-tight">
          Setting up your account...
        </h1>
        <p className="text-base text-beige/60 font-sans max-w-sm leading-relaxed">
          We&apos;re preparing your personalized dashboard. This only takes a moment.
        </p>
      </div>
    </div>
  )
}
