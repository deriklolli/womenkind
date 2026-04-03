'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

interface ProviderNavProps {
  providerName?: string
  /** Dashboard passes these to control tab state locally */
  activeTab?: 'queue' | 'patients'
  onTabChange?: (tab: 'queue' | 'patients') => void
  newIntakeCount?: number
  patientCount?: number
}

export default function ProviderNav({
  providerName,
  activeTab: controlledTab,
  onTabChange,
  newIntakeCount,
  patientCount,
}: ProviderNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleSignOut = () => {
    localStorage.removeItem('womenkind_demo_provider')
    supabase.auth.signOut()
    router.push('/provider/login')
  }

  // Resolve provider name from props or localStorage
  const displayName = providerName || (() => {
    if (typeof window === 'undefined') return ''
    try {
      const demo = localStorage.getItem('womenkind_demo_provider')
      if (demo) return JSON.parse(demo).name || ''
    } catch {}
    return ''
  })()

  // Determine which tab is active
  const isDashboard = pathname === '/provider/dashboard'
  const resolvedTab: 'queue' | 'patients' = controlledTab
    ? controlledTab
    : pathname.startsWith('/provider/patient')
      ? 'patients'
      : 'queue'

  const handleTabClick = (tab: 'queue' | 'patients') => {
    if (isDashboard && onTabChange) {
      onTabChange(tab)
    } else {
      // Navigate back to dashboard with tab param
      router.push(`/provider/dashboard?tab=${tab}`)
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
                className="h-7 w-auto"
                priority
              />
            </button>
            <span className="text-xs font-sans text-white/40 border-l border-white/10 pl-6">
              Provider Portal
            </span>
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
                  <svg
                    className={`w-3.5 h-3.5 text-white/40 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
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
                        onClick={() => { setMenuOpen(false) }}
                        className="w-full text-left px-4 py-2.5 text-sm font-sans text-aubergine/70 hover:bg-violet/5 hover:text-aubergine transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-aubergine/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        Profile
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false) }}
                        className="w-full text-left px-4 py-2.5 text-sm font-sans text-aubergine/70 hover:bg-violet/5 hover:text-aubergine transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-aubergine/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                    </div>
                    <div className="border-t border-aubergine/5 py-1">
                      <button
                        onClick={() => { setMenuOpen(false); handleSignOut() }}
                        className="w-full text-left px-4 py-2.5 text-sm font-sans text-red-500/70 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-red-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
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
                onClick={() => handleTabClick('queue')}
                className={`px-5 py-3.5 text-sm font-sans font-medium border-b-2 transition-all
                  ${resolvedTab === 'queue'
                    ? 'border-violet text-violet'
                    : 'border-transparent text-aubergine/40 hover:text-aubergine/60'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Intake Queue
                  {(newIntakeCount ?? 0) > 0 && (
                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-pill font-medium">
                      {newIntakeCount}
                    </span>
                  )}
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  My Patients
                  {(patientCount ?? 0) > 0 && (
                    <span className="text-xs text-aubergine/30">{patientCount}</span>
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
