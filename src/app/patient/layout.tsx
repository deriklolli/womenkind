'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { signOutPatient } from '@/lib/signOut'

// HIPAA §164.312(a)(2)(iii) automatic logoff — 20 min of inactivity.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Login page doesn't need protection
    if (pathname === '/patient/login') {
      setAuthorized(true)
      setChecking(false)
      return
    }

    const checkAccess = async () => {
      // Dev shortcut: always allow access in development
      if (process.env.NODE_ENV === 'development') {
        setAuthorized(true)
        setChecking(false)
        return
      }

      // Real session always takes priority — check it first
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        // Clear stale demo key so it can never interfere with real auth
        localStorage.removeItem('womenkind_demo_patient')

        const role = session.user.user_metadata?.role

        if (role === 'patient') {
          setAuthorized(true)
          setChecking(false)
          return
        }

        // Logged in but not a patient — redirect
        router.replace('/patient/login')
        return
      }

      // No real session — fall back to demo mode
      const demo = localStorage.getItem('womenkind_demo_patient')
      if (demo) {
        setAuthorized(true)
        setChecking(false)
        return
      }

      // Not authorized — redirect to login
      router.replace('/patient/login')
    }

    checkAccess()
  }, [pathname, router])

  useIdleTimeout({
    timeoutMs: IDLE_TIMEOUT_MS,
    onTimeout: () => signOutPatient('idle'),
    enabled: authorized && pathname !== '/patient/login',
  })

  if (checking && pathname !== '/patient/login') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (!authorized && pathname !== '/patient/login') return null

  return <>{children}</>
}
