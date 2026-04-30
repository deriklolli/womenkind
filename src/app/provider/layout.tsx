'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { ChatContextProvider } from '@/lib/chat-context'
import { RecordingProvider } from '@/lib/recording-context'
import RecordingBar from '@/components/provider/RecordingBar'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { signOutProvider } from '@/lib/signOut'

// HIPAA §164.312(a)(2)(iii) automatic logoff — 20 min of inactivity.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Login page doesn't need protection
    if (pathname === '/provider/login') {
      setAuthorized(true)
      setChecking(false)
      return
    }

    const checkAccess = async () => {
      // Real session always takes priority — check it first
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Clear stale demo key so it can never interfere with real auth
        localStorage.removeItem('womenkind_demo_provider')
        setAuthorized(true)
        setChecking(false)
        return
      }

      // No real session — fall back to demo mode
      const demo = localStorage.getItem('womenkind_demo_provider')
      if (demo) {
        setAuthorized(true)
        setChecking(false)
        return
      }

      // Not authorized — redirect to login
      router.replace('/provider/login')
    }

    checkAccess()
  }, [pathname, router])

  useIdleTimeout({
    timeoutMs: IDLE_TIMEOUT_MS,
    onTimeout: () => signOutProvider('idle'),
    enabled: process.env.NODE_ENV !== 'development' && authorized && pathname !== '/provider/login',
  })

  if (checking && pathname !== '/provider/login') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (!authorized && pathname !== '/provider/login') return null

  const isLoginPage = pathname === '/provider/login'

  if (isLoginPage) return <>{children}</>

  return (
    <ChatContextProvider>
      <RecordingProvider>
        {children}
        <RecordingBar />
      </RecordingProvider>
    </ChatContextProvider>
  )
}
