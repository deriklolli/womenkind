'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { ChatContextProvider, useChatContext } from '@/lib/chat-context'
import { RecordingProvider } from '@/lib/recording-context'
import ChatWidget from '@/components/provider/ChatWidget'
import RecordingBar from '@/components/provider/RecordingBar'
import ProviderNav from '@/components/provider/ProviderNav'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { signOutProvider } from '@/lib/signOut'

// HIPAA §164.312(a)(2)(iii) automatic logoff — 20 min of inactivity.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000

function ChatWidgetWithContext() {
  const { pageContext } = useChatContext()
  return <ChatWidget context={pageContext} />
}

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
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Clear stale demo key so it can never interfere with real auth
        localStorage.removeItem('womenkind_demo_provider')

        const role = session.user.user_metadata?.role

        if (role === 'provider') {
          setAuthorized(true)
          setChecking(false)
          return
        }

        // Logged in but not a provider — redirect
        router.replace('/provider/login')
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
    enabled: authorized && pathname !== '/provider/login',
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
        <div className="flex min-h-screen">
          <ProviderNav />
          <main className="flex-1 min-w-0 overflow-y-auto">
            {children}
          </main>
        </div>
        <RecordingBar />
        <ChatWidgetWithContext />
      </RecordingProvider>
    </ChatContextProvider>
  )
}
