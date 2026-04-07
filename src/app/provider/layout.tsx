'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { ChatContextProvider, useChatContext } from '@/lib/chat-context'
import ChatWidget from '@/components/provider/ChatWidget'

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

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (profile?.role === 'provider') {
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
      {children}
      <ChatWidgetWithContext />
    </ChatContextProvider>
  )
}
