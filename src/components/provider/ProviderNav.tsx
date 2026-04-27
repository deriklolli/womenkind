'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { getProviderSession } from '@/lib/getProviderSession'

export type ProviderTab = 'home' | 'queue' | 'patients' | 'schedule' | 'messages' | 'refills'

export default function ProviderNav() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [selfProviderName, setSelfProviderName] = useState('')
  const [selfIntakeCount, setSelfIntakeCount] = useState(0)
  const [selfMessageCount, setSelfMessageCount] = useState(0)
  const [selfRefillCount, setSelfRefillCount] = useState(0)

  useEffect(() => {
    const loadName = async () => {
      try {
        const session = await getProviderSession()
        if (session?.providerName) setSelfProviderName(session.providerName)
      } catch {}
    }
    loadName()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const session = await getProviderSession()
        if (!session) return
        const [refillRes, msgRes, intakeRes] = await Promise.all([
          fetch(`/api/refill-requests?providerId=${session.providerId}&status=pending`),
          fetch(`/api/messages?providerId=${session.providerId}`),
          fetch('/api/provider/pending-intakes'),
        ])
        const refillData = await refillRes.json()
        setSelfRefillCount((refillData.refillRequests || []).length)
        const msgData = await msgRes.json()
        const unread = (msgData.threads || []).reduce((sum: number, t: any) => sum + (t.unreadCount || 0), 0)
        setSelfMessageCount(unread)
        const intakeData = await intakeRes.json()
        setSelfIntakeCount(intakeData.count ?? 0)
      } catch {}
    }
    load()
  }, [])

  const handleSignOut = async () => {
    localStorage.removeItem('womenkind_demo_provider')
    await supabase.auth.signOut()
    window.location.href = 'https://womenkindhealth.com/provider/login'
  }

  const displayName = selfProviderName || (() => {
    if (typeof window === 'undefined') return ''
    try {
      const demo = localStorage.getItem('womenkind_demo_provider')
      if (demo) return JSON.parse(demo).name || ''
    } catch {}
    return ''
  })()

  // Resolve active nav item
  const tabParam = searchParams.get('tab') as ProviderTab | null
  const isSchedule = pathname === '/provider/schedule'
  const isPatient = pathname.startsWith('/provider/patient') || pathname.startsWith('/provider/brief')
  const isSettings = pathname === '/provider/settings'

  const isDashboardHome = pathname === '/provider/dashboard' && !tabParam
  const activeItem: ProviderTab | 'settings' = isSettings
    ? 'settings'
    : isSchedule
      ? 'schedule'
      : isPatient
        ? 'patients'
        : isDashboardHome
          ? 'home'
          : tabParam ?? 'home'

  const isLogin = pathname === '/provider/login'
  if (isLogin) return null

  const navItems: { key: ProviderTab; label: string; badge?: number; badgeColor?: string; icon: React.ReactNode }[] = [
    {
      key: 'home',
      label: 'Today',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: 'queue',
      label: 'Intake Queue',
      badge: selfIntakeCount > 0 ? selfIntakeCount : undefined,
      badgeColor: 'bg-orange-500 text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      key: 'patients',
      label: 'My Patients',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: 'schedule',
      label: 'Schedule',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: 'messages',
      label: 'Messages',
      badge: selfMessageCount > 0 ? selfMessageCount : undefined,
      badgeColor: 'bg-orange-500 text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
    },
    {
      key: 'refills',
      label: 'Refill Requests',
      badge: selfRefillCount > 0 ? selfRefillCount : undefined,
      badgeColor: 'bg-orange-500 text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 8.5l7 7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.636 15.364a5 5 0 010-7.071l4.95-4.95a5 5 0 017.07 7.07l-4.95 4.95a5 5 0 01-7.07 0z" />
        </svg>
      ),
    },
  ]

  const handleNavClick = (key: ProviderTab) => {
    if (key === 'home') {
      router.push('/provider/dashboard')
    } else if (key === 'schedule') {
      router.push('/provider/schedule')
    } else {
      router.push(`/provider/dashboard?tab=${key}`)
    }
  }

  const initials = displayName.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase()

  return (
    <nav className="w-60 min-h-screen bg-aubergine flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-6">
        <button onClick={() => router.push('/provider/dashboard')} className="flex items-center">
          <Image
            src="/womenkind_logowhite.png"
            alt="Womenkind"
            width={160}
            height={36}
            className="h-[22px] w-auto"
            priority
          />
        </button>
      </div>

      {/* Nav items */}
      <div className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ key, label, badge, badgeColor, icon }) => {
          const isActive = activeItem === key
          return (
            <button
              key={key}
              onClick={() => handleNavClick(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-all text-left
                ${isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                }`}
            >
              <span className={isActive ? 'text-white' : 'text-white/50'}>{icon}</span>
              <span className="flex-1">{label}</span>
              {badge !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor}`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Bottom: user info + settings + sign out */}
      <div className="px-3 pb-5 mt-auto space-y-0.5">
        <div className="border-t border-white/10 pt-4 mb-2 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-violet/40 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-sans font-medium text-white truncate">{displayName}</p>
              <p className="text-xs font-sans text-white/40">Provider</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/provider/settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-all text-left
            ${isSettings
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white/80'
            }`}
        >
          <svg className={`w-5 h-5 ${isSettings ? 'text-white' : 'text-white/50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-all text-left text-white/60 hover:bg-red-500/10 hover:text-red-300"
        >
          <svg className="w-5 h-5 text-white/40 group-hover:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Sign Out
        </button>
      </div>
    </nav>
  )
}
