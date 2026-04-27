'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProviderNav, { type ProviderTab } from '@/components/provider/ProviderNav'
import ProviderRefillQueue from '@/components/provider/ProviderRefillQueue'
import ProviderMessagesInbox from '@/components/provider/ProviderMessagesInbox'
import ProviderCancellationAlerts from '@/components/provider/ProviderCancellationAlerts'
import DashboardHome from '@/components/provider/DashboardHome'
import { devFixtures } from '@/lib/dev-fixtures'
import { useChatContext } from '@/lib/chat-context'
import { getProviderSession } from '@/lib/getProviderSession'
import { signOutProvider } from '@/lib/signOut'

type DashboardTab = ProviderTab

interface Intake {
  id: string
  status: string
  answers: Record<string, any>
  submitted_at: string | null
  reviewed_at: string | null
  ai_brief: any
  patients: {
    subscriptions: {
      status: string
      plan_type: string
    }[]
  } | null
}

interface DirectoryPatient {
  id: string
  profile_id: string
  date_of_birth: string | null
  phone: string | null
  state: string | null
  profiles: {
    first_name: string | null
    last_name: string | null
    email: string | null
  }
  intakes: {
    id: string
    status: string
    ai_brief: any
    submitted_at: string | null
  }[]
  visits: {
    id: string
    visit_type: string
    visit_date: string
  }[]
  subscriptions: {
    status: string
    plan_type: string
  }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: 'New', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  reviewed: { label: 'Reviewed', color: 'text-violet', bg: 'bg-violet/5 border-violet/20' },
  care_plan_sent: { label: 'Care Plan Sent', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  draft: { label: 'In Progress', color: 'text-aubergine/40', bg: 'bg-gray-50 border-gray-200' },
}

export default function ProviderDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const validTabs: DashboardTab[] = ['patients', 'schedule', 'messages', 'refills']
  const isDashboardHome = !tabParam
  const initialTab = (validTabs.includes(tabParam as DashboardTab) ? tabParam : 'patients') as DashboardTab
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab)
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [patients, setPatients] = useState<DirectoryPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [patientsLoading, setPatientsLoading] = useState(true)
  const [providerName, setProviderName] = useState('')
  const [providerId, setProviderId] = useState<string>('')
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [pendingRefillCount, setPendingRefillCount] = useState(0)

  const { setPageContext } = useChatContext()

  useEffect(() => {
    setPageContext({ page: 'dashboard' })
  }, [])

  useEffect(() => {
    getProviderSession().then(session => {
      if (!session) {
        router.push('/provider/login')
        return
      }
      setProviderName(session.providerName)
      setProviderId(session.providerId)
    })
    loadIntakes()
    loadPatients()
  }, [])

  // Load badge counts once we have a provider ID
  useEffect(() => {
    if (!providerId) return
    loadCounts()
  }, [providerId])

  const loadCounts = async () => {
    try {
      // Fetch pending refill count
      const refillRes = await fetch(`/api/refill-requests?providerId=${providerId}&status=pending`)
      const refillData = await refillRes.json()
      setPendingRefillCount((refillData.refillRequests || []).length)

      // Fetch unread message count
      const msgRes = await fetch(`/api/messages?providerId=${providerId}`)
      const msgData = await msgRes.json()
      const unread = (msgData.threads || []).reduce((sum: number, t: any) => sum + (t.unreadCount || 0), 0)
      setUnreadMessageCount(unread)
    } catch (err) {
      console.error('Failed to load counts:', err)
    }
  }

  const loadIntakes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/provider/intakes')
      if (!res.ok) throw new Error('Failed to fetch intakes')
      const data = await res.json()
      setIntakes(data.intakes || [])
    } catch (err) {
      console.error('Failed to load intakes:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPatients = async () => {
    setPatientsLoading(true)
    try {
      const res = await fetch('/api/provider/patients')
      if (!res.ok) throw new Error('Failed to fetch patients')
      const data = await res.json()
      setPatients(data.patients || [])
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        setPatients(devFixtures.patients as DirectoryPatient[])
      } else {
        console.error('Failed to load patients:', err)
      }
    } finally {
      setPatientsLoading(false)
    }
  }

  const handleSignOut = () => {
    signOutProvider()
  }

  const filteredIntakes = filter === 'all'
    ? intakes
    : intakes.filter((i) => i.status === filter)

  const counts = {
    all: intakes.length,
    submitted: intakes.filter((i) => i.status === 'submitted').length,
    reviewed: intakes.filter((i) => i.status === 'reviewed').length,
    care_plan_sent: intakes.filter((i) => i.status === 'care_plan_sent').length,
  }

  const filteredPatients = patients.filter((p) => {
    if (!searchQuery) return true
    const name = `${p.profiles?.first_name || ''} ${p.profiles?.last_name || ''}`.toLowerCase()
    const email = (p.profiles?.email || '').toLowerCase()
    const q = searchQuery.toLowerCase()
    return name.includes(q) || email.includes(q)
  })

  const getPatientName = (answers: Record<string, any>) =>
    answers?.full_name || 'Unknown Patient'

  const getPatientAge = (dob: string | null) => {
    if (!dob) return null
    const birth = new Date(dob)
    const now = new Date()
    return Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  }

  const getPatientAgeFromAnswers = (answers: Record<string, any>) => {
    if (!answers?.dob) return null
    return getPatientAge(answers.dob)
  }

  const getTopConcerns = (answers: Record<string, any>) => {
    if (!answers?.priorities) return []
    const priorities = Array.isArray(answers.priorities) ? answers.priorities : []
    return priorities.slice(0, 3)
  }

  const getSymptomBurden = (brief: any) =>
    brief?.metadata?.symptom_burden || null

  const getMenopausalStage = (brief: any) =>
    brief?.metadata?.menopausal_stage || null

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatShortDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav
        providerName={providerName}
        activeTab={isDashboardHome ? undefined : activeTab}
        onTabChange={setActiveTab}
        patientCount={patients.length}
        unreadMessageCount={unreadMessageCount}
        pendingRefillCount={pendingRefillCount}
      />

      {isDashboardHome ? (
        <DashboardHome />
      ) : (
      <div className="max-w-7xl mx-auto px-6 py-8">
        {providerId && <ProviderCancellationAlerts providerId={providerId} />}

        {activeTab === 'patients' && (
          /* ====== PATIENTS DIRECTORY TAB ====== */
          <>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="font-serif font-normal text-4xl text-aubergine">My Patients</h1>
                <p className="text-sm font-sans text-aubergine/50 mt-1">
                  {patients.length} active {patients.length === 1 ? 'patient' : 'patients'}
                </p>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative mb-6 max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aubergine/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search patients by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine placeholder:text-aubergine/30 focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10 shadow-sm"
              />
            </div>

            {/* Patient directory list */}
            {patientsLoading ? (
              <div className="text-center py-20">
                <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-card shadow-sm">
                <p className="text-lg font-sans font-semibold text-aubergine/30">
                  {searchQuery ? 'No patients match your search' : 'No patients yet'}
                </p>
                <p className="text-sm font-sans text-aubergine/20 mt-2">
                  {searchQuery ? 'Try a different search term' : 'Patients will appear here after completing intake'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-card shadow-sm border border-aubergine/5 divide-y divide-aubergine/5 overflow-hidden">
                {filteredPatients.map((patient) => {
                  const name = `${patient.profiles?.first_name || ''} ${patient.profiles?.last_name || ''}`.trim() || 'Unknown'
                  const age = getPatientAge(patient.date_of_birth)
                  const visitCount = patient.visits?.length || 0
                  const hasMembership = patient.subscriptions?.some(
                    (s) => s.plan_type === 'membership' && s.status === 'active'
                  )
                  const latestVisitDate = patient.visits?.sort((a, b) =>
                    new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
                  )[0]?.visit_date

                  return (
                    <button
                      key={patient.id}
                      onClick={() => router.push(`/provider/patient/${patient.id}`)}
                      className="w-full px-6 py-4 hover:bg-violet/8 transition-colors text-left group flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-sans font-semibold text-violet">
                          {(patient.profiles?.first_name?.[0] || '?').toUpperCase()}
                          {(patient.profiles?.last_name?.[0] || '').toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-0.5">
                          <h3 className="font-sans font-semibold text-sm text-aubergine truncate">{name}</h3>
                          {age && (
                            <span className="text-xs font-sans text-aubergine/40 flex-shrink-0">{age}y</span>
                          )}
                          {hasMembership && (
                            <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 text-xs font-sans font-medium px-2 py-0.5 rounded-pill flex-shrink-0">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              Member
                            </span>
                          )}
                        </div>
                      </div>

                      <svg className="w-4 h-4 text-aubergine/20 group-hover:text-violet transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'messages' && (
          /* ====== MESSAGES TAB ====== */
          <ProviderMessagesInbox providerId={providerId} onCountChange={setUnreadMessageCount} />
        )}

        {activeTab === 'refills' && (
          /* ====== REFILL REQUESTS TAB ====== */
          <ProviderRefillQueue providerId={providerId} onCountChange={setPendingRefillCount} />
        )}
      </div>
      )}
    </div>
  )
}
