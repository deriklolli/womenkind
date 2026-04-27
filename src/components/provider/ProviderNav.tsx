'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import { getProviderSession } from '@/lib/getProviderSession'
import { Sun, CircleUser, Calendar, MessageSquare, Pill, Settings, LogOut, ChevronDown } from 'lucide-react'

export type ProviderTab = 'dashboard' | 'patients' | 'schedule' | 'messages' | 'refills'

interface ProviderNavProps {
  providerName?: string
  /** Dashboard passes these to control tab state locally */
  activeTab?: ProviderTab
  onTabChange?: (tab: ProviderTab) => void
  newIntakeCount?: number
  patientCount?: number
  appointmentCount?: number
  unreadMessageCount?: number
  pendingRefillCount?: number
}

export default function ProviderNav({
  providerName,
  activeTab: controlledTab,
  onTabChange,
  newIntakeCount: newIntakeCountProp,
  patientCount,
  appointmentCount: appointmentCountProp,
  unreadMessageCount: unreadMessageCountProp,
  pendingRefillCount: pendingRefillCountProp,
}: ProviderNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Self-fetch provider name and badge counts when not provided by the parent page
  const [selfProviderName, setSelfProviderName] = useState('')
  const [selfIntakeCount, setSelfIntakeCount] = useState(0)
  const [selfMessageCount, setSelfMessageCount] = useState(0)
  const [selfRefillCount, setSelfRefillCount] = useState(0)

  const needsSelfFetch =
    newIntakeCountProp === undefined &&
    unreadMessageCountProp === undefined &&
    pendingRefillCountProp === undefined

  // Always self-fetch provider name when not passed as a prop
  useEffect(() => {
    if (providerName) return
    const loadName = async () => {
      try {
        const session = await getProviderSession()
        if (session?.providerName) setSelfProviderName(session.providerName)
      } catch {}
    }
    loadName()
  }, [providerName])

  useEffect(() => {
    if (!needsSelfFetch) return
    const load = async () => {
      try {
        const session = await getProviderSession()
        if (!session) return
        const resolvedProviderId = session.providerId
        const [refillRes, msgRes, intakeRes] = await Promise.all([
          fetch(`/api/refill-requests?providerId=${resolvedProviderId}&status=pending`),
          fetch(`/api/messages?providerId=${resolvedProviderId}`),
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
  }, [needsSelfFetch])

  const newIntakeCount = newIntakeCountProp ?? selfIntakeCount
  const appointmentCount = appointmentCountProp ?? 0
  const unreadMessageCount = unreadMessageCountProp ?? selfMessageCount
  const pendingRefillCount = pendingRefillCountProp ?? selfRefillCount

  const handleSignOut = async () => {
    localStorage.removeItem('womenkind_demo_provider')
    await supabase.auth.signOut()
    window.location.href = 'https://womenkindhealth.com/provider/login'
  }

  // Resolve provider name: prop → self-fetched session → localStorage demo fallback
  const displayName = providerName || selfProviderName || (() => {
    if (typeof window === 'undefined') return ''
    try {
      const demo = localStorage.getItem('womenkind_demo_provider')
      if (demo) return JSON.parse(demo).name || ''
    } catch {}
    return ''
  })()

  // Determine which tab is active
  const isDashboard = pathname === '/provider/dashboard'
  const isSchedule = pathname === '/provider/schedule'
  const resolvedTab: ProviderTab = controlledTab
    ? controlledTab
    : isSchedule
      ? 'schedule'
      : pathname.startsWith('/provider/patient')
        ? 'patients'
        : 'dashboard'

  const handleTabClick = (tab: ProviderTab) => {
    if (tab === 'dashboard') {
      router.push('/provider/dashboard')
      return
    }
    if (tab === 'schedule') {
      router.push('/provider/schedule')
      return
    }
    router.push(`/provider/dashboard?tab=${tab}`)
    if (isDashboard && onTabChange) {
      onTabChange(tab)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  // Don't show tabs on login page
  const isLogin = pathname === '/provider/login'

  return (
    <div className="relative z-50">
      {/* Top bar */}
      <nav className="bg-aubergine text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push('/provider/dashboard')} className="flex items-center">
              <Image
                src="/womenkind-logo.png"
                alt="Womenkind"
                width={160}
                height={36}
                className="h-[25px] w-auto"
                priority
              />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* User menu */}
            {displayName && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 text-sm font-sans text-white/70 hover:text-white transition-colors rounded-pill px-3 py-1.5 hover:bg-white/10"
                >
                  <div className="w-7 h-7 rounded-full bg-violet/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-white">
                      {displayName.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {displayName}
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-card shadow-xl shadow-aubergine/20 border border-aubergine/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-aubergine/5">
                      <p className="text-sm font-sans font-medium text-aubergine">{displayName}</p>
                      <p className="text-xs font-sans text-aubergine/40 mt-0.5">Provider</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setMenuOpen(false); router.push('/provider/settings') }}
                        className="w-full text-left px-4 py-2.5 text-sm font-sans text-aubergine/70 hover:bg-violet/5 hover:text-aubergine transition-colors flex items-center gap-3"
                      >
                        <Settings className="w-4 h-4 text-aubergine/30" />
                        Settings
                      </button>
                    </div>
                    <div className="border-t border-aubergine/5 py-1">
                      <button
                        onClick={() => { setMenuOpen(false); handleSignOut() }}
                        className="w-full text-left px-4 py-2.5 text-sm font-sans text-red-500/70 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-3"
                      >
                        <LogOut className="w-4 h-4 text-red-400/50" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Tab bar — shown on all provider pages except login */}
      {!isLogin && (
        <div className="border-b border-aubergine/10 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-0">
              <button
                onClick={() => handleTabClick('dashboard')}
                className={`px-5 py-3.5 text-sm font-sans font-medium border-b-2 transition-all
                  ${resolvedTab === 'dashboard'
                    ? 'border-violet text-violet'
                    : 'border-transparent text-aubergine/40 hover:text-aubergine/60'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  Today
                </span>
              </button>
              <button
                onClick={() => handleTabClick('patients')}
                className={`px-5 py-3.5 text-sm font-sans font-medium border-b-2 transition-all
                  ${resolvedTab === 'patients'
                    ? 'border-violet text-violet'
                    : 'border-transparent text-aubergine/40 hover:text-aubergine/60'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <CircleUser className="w-4 h-4" />
                  Patients
                </span>
              </button>
              <button
                onClick={() => handleTabClick('schedule')}
                className={`px-5 py-3.5 text-sm font-sans font-medium border-b-2 transition-all
                  ${resolvedTab === 'schedule'
                    ? 'border-violet text-violet'
                    : 'border-transparent text-aubergine/40 hover:text-aubergine/60'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Schedule
                  {(appointmentCount ?? 0) > 0 && (
                    <span className="bg-violet/20 text-violet text-xs px-1.5 py-0.5 rounded-pill font-medium">
                      {appointmentCount}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => handleTabClick('messages')}
                className={`px-5 py-3.5 text-sm font-sans font-medium border-b-2 transition-all
                  ${resolvedTab === 'messages'
                    ? 'border-violet text-violet'
                    : 'border-transparent text-aubergine/40 hover:text-aubergine/60'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Messages
                  {(unreadMessageCount ?? 0) > 0 && (
                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-pill font-medium">
                      {unreadMessageCount}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => handleTabClick('refills')}
                className={`px-5 py-3.5 text-sm font-sans font-medium border-b-2 transition-all
                  ${resolvedTab === 'refills'
                    ? 'border-violet text-violet'
                    : 'border-transparent text-aubergine/40 hover:text-aubergine/60'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Pill className="w-4 h-4" />
                  Refill Requests
                  {(pendingRefillCount ?? 0) > 0 && (
                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-pill font-medium">
                      {pendingRefillCount}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
