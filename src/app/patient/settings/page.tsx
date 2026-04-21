'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-browser'
import PatientSettings from '@/components/patient/PatientSettings'
import NotificationBell from '@/components/patient/NotificationBell'
import type { DashboardView } from '@/components/patient/QuickActions'

type MembershipStatus = 'active' | 'canceled' | 'past_due' | 'none'

interface PatientData {
  patientId: string
  name: string
  email: string
  membershipStatus: MembershipStatus
  membershipRenewal: string | null
}

const DEMO_PATIENT: PatientData = {
  patientId: 'c0000000-0000-0000-0000-000000000001',
  name: 'Sarah Mitchell',
  email: 'sarah@example.com',
  membershipStatus: 'active',
  membershipRenewal: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
}

export default function SettingsPage() {
  const router = useRouter()
  const [patient, setPatient] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    loadPatient()
  }, [])

  async function loadPatient() {
    try {
      // Demo mode
      const demo = localStorage.getItem('womenkind_demo_patient')
      if (demo) {
        setPatient(DEMO_PATIENT)
        setLoading(false)
        return
      }

      // Verify Supabase session before hitting the API
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/patient/login'); return }

      const res = await fetch('/api/patient/settings')
      if (!res.ok) {
        if (res.status === 401) { router.push('/patient/login'); return }
        // 403 or 5xx — still authenticated, stay on page with empty state
        console.error('Settings API returned', res.status)
        return
      }

      const data = await res.json()

      const membershipStatus: MembershipStatus =
        data.subscription?.status === 'active' ? 'active'
        : data.subscription?.status === 'canceled' ? 'canceled'
        : data.subscription?.status === 'past_due' ? 'past_due'
        : 'none'

      setPatient({
        patientId: data.patientId,
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || '',
        email: data.email || '',
        membershipStatus,
        membershipRenewal: data.subscription?.current_period_end ?? null,
      })
    } catch (err) {
      console.error('Error loading patient data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMembershipEnroll = async () => {
    if (!patient) return
    setMembershipLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.patientId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setMembershipLoading(false)
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('womenkind_demo_patient')
    await supabase.auth.signOut()
    window.location.href = 'https://womenkindhealth.com/patient/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (!patient) return null

  return (
    <div className="min-h-screen bg-cream">
      {/* Top nav */}
      <nav className="bg-white border-b border-aubergine/5">
        <div className="max-w-5xl mx-auto px-6 py-[3px] flex items-center justify-between">
          <Image
            src="/womenkind-logo-dark.png"
            alt="Womenkind"
            width={400}
            height={90}
            className="h-16 w-auto -ml-2"
          />

          <div className="flex items-center gap-2">
            <NotificationBell patientId={patient.patientId} onNavigate={(view: DashboardView) => router.push(`/patient/dashboard?view=${view}`)} />

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-pill hover:bg-violet/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-violet/10 flex items-center justify-center">
                  <span className="text-xs font-sans font-semibold text-violet">
                    {patient.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <span className="text-sm font-sans font-medium text-aubergine hidden md:inline">
                  {patient.name}
                </span>
                <svg className="w-3.5 h-3.5 text-aubergine/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-card shadow-xl shadow-aubergine/10 border border-aubergine/10 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-aubergine/5">
                    <p className="text-sm font-sans font-medium text-aubergine">{patient.name}</p>
                    <p className="text-xs font-sans text-aubergine/40 mt-0.5">{patient.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setMenuOpen(false); router.push('/patient/dashboard') }}
                      className="w-full text-left px-4 py-2.5 text-sm font-sans text-aubergine/70 hover:bg-violet/5 hover:text-aubergine transition-colors flex items-center gap-3"
                    >
                      <svg className="w-4 h-4 text-aubergine/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                      </svg>
                      Dashboard
                    </button>
                  </div>
                  <div className="border-t border-aubergine/5 py-1">
                    <button
                      onClick={() => { setMenuOpen(false); handleLogout() }}
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
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Page header — matches dashboard welcome placement */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/patient/dashboard')}
            className="flex items-center gap-1.5 text-sm font-sans text-aubergine/40 hover:text-violet transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2">
            Settings
          </h1>
          <p className="text-sm font-sans text-aubergine/40">
            Manage your connected devices, membership, and preferences.
          </p>
        </div>

        <PatientSettings
          patientId={patient.patientId}
          membershipStatus={patient.membershipStatus}
          membershipRenewal={patient.membershipRenewal}
          onEnrollMembership={handleMembershipEnroll}
          membershipLoading={membershipLoading}
        />
      </main>
    </div>
  )
}
