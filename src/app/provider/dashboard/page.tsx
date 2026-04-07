'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import ProviderNav, { type ProviderTab } from '@/components/provider/ProviderNav'
import ProviderRefillQueue from '@/components/provider/ProviderRefillQueue'
import ProviderMessagesInbox from '@/components/provider/ProviderMessagesInbox'
import { useChatContext } from '@/lib/chat-context'

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
  const validTabs: DashboardTab[] = ['queue', 'patients', 'schedule', 'messages', 'refills']
  const initialTab = (validTabs.includes(tabParam as DashboardTab) ? tabParam : 'queue') as DashboardTab
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab)
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [patients, setPatients] = useState<DirectoryPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [providerName, setProviderName] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [pendingRefillCount, setPendingRefillCount] = useState(0)

  const PROVIDER_ID = 'b0000000-0000-0000-0000-000000000001'

  const { setPageContext } = useChatContext()

  useEffect(() => {
    setPageContext({ page: 'dashboard' })
  }, [])

  useEffect(() => {
    const demo = localStorage.getItem('womenkind_demo_provider')
    if (demo) {
      const provider = JSON.parse(demo)
      setProviderName(provider.name)
    } else {
      // Real Supabase auth — fetch name from profiles table
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          const meta = data.user.user_metadata
          const first = meta?.first_name || ''
          const last = meta?.last_name || ''
          if (first || last) {
            setProviderName(`Dr. ${first} ${last}`.trim())
          } else {
            // Fall back to profiles table
            supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', data.user.id)
              .single()
              .then(({ data: profile }) => {
                if (profile) {
                  setProviderName(`Dr. ${profile.first_name || ''} ${profile.last_name || ''}`.trim())
                }
              })
          }
        }
      })
    }
    loadIntakes()
    loadPatients()
    loadCounts()
  }, [])

  const loadCounts = async () => {
    try {
      // Fetch pending refill count
      const refillRes = await fetch(`/api/refill-requests?providerId=${PROVIDER_ID}&status=pending`)
      const refillData = await refillRes.json()
      setPendingRefillCount((refillData.refillRequests || []).length)

      // Fetch unread message count
      const msgRes = await fetch(`/api/messages?providerId=${PROVIDER_ID}`)
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
      const { data, error } = await supabase
        .from('intakes')
        .select('id, status, answers, submitted_at, reviewed_at, ai_brief, patients(subscriptions(status, plan_type))')
        .in('status', ['submitted', 'reviewed', 'care_plan_sent'])
        .order('submitted_at', { ascending: false })

      if (error) throw error
      setIntakes((data as unknown as Intake[]) || [])
    } catch (err) {
      console.error('Failed to load intakes:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          profile_id,
          date_of_birth,
          phone,
          state,
          profiles ( first_name, last_name, email ),
          intakes ( id, status, ai_brief, submitted_at ),
          visits ( id, visit_type, visit_date ),
          subscriptions ( status, plan_type )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPatients((data as unknown as DirectoryPatient[]) || [])
    } catch (err) {
      console.error('Failed to load patients:', err)
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem('womenkind_demo_provider')
    supabase.auth.signOut()
    router.push('/provider/login')
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
        activeTab={activeTab}
        onTabChange={setActiveTab}
        newIntakeCount={counts.submitted}
        patientCount={patients.length}
        unreadMessageCount={unreadMessageCount}
        pendingRefillCount={pendingRefillCount}
      />

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'queue' && (
          /* ====== INTAKE QUEUE TAB ====== */
          <>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="font-serif text-2xl text-aubergine tracking-tight">Intake Queue</h1>
                <p className="text-sm font-sans text-aubergine/50 mt-1">
                  {counts.submitted} new {counts.submitted === 1 ? 'intake' : 'intakes'} awaiting review
                </p>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-6 bg-white rounded-brand p-1 w-fit shadow-sm">
              {[
                { key: 'all', label: 'All' },
                { key: 'submitted', label: 'New' },
                { key: 'reviewed', label: 'Reviewed' },
                { key: 'care_plan_sent', label: 'Care Plan Sent' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-4 py-2 rounded-brand text-sm font-sans font-medium transition-all
                    ${filter === tab.key
                      ? 'bg-aubergine text-white shadow-sm'
                      : 'text-aubergine/50 hover:text-aubergine hover:bg-aubergine/5'
                    }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 text-xs ${filter === tab.key ? 'text-white/60' : 'text-aubergine/30'}`}>
                    {counts[tab.key as keyof typeof counts]}
                  </span>
                </button>
              ))}
            </div>

            {/* Patient list */}
            {loading ? (
              <div className="text-center py-20">
                <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin mx-auto" />
                <p className="text-sm font-sans text-aubergine/40 mt-4">Loading intakes...</p>
              </div>
            ) : filteredIntakes.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-card shadow-sm">
                <p className="text-lg font-serif text-aubergine/30">No intakes found</p>
                <p className="text-sm font-sans text-aubergine/20 mt-2">
                  {filter !== 'all' ? 'Try a different filter' : 'Completed intakes will appear here'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIntakes.map((intake) => {
                  const name = getPatientName(intake.answers)
                  const age = getPatientAgeFromAnswers(intake.answers)
                  const concerns = getTopConcerns(intake.answers)
                  const burden = getSymptomBurden(intake.ai_brief)
                  const isMember = intake.patients?.subscriptions?.some(
                    (s) => s.plan_type === 'membership' && s.status === 'active'
                  )
                  const status = STATUS_CONFIG[intake.status] || STATUS_CONFIG.draft

                  return (
                    <button
                      key={intake.id}
                      onClick={() => router.push(`/provider/brief/${intake.id}`)}
                      className="w-full bg-white rounded-card p-5 shadow-sm hover:shadow-md
                                 border border-transparent hover:border-violet/10
                                 transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-serif text-lg text-aubergine group-hover:text-violet transition-colors truncate">
                              {name}
                            </h3>
                            {age && (
                              <span className="text-xs font-sans text-aubergine/40 flex-shrink-0">
                                {age}y
                              </span>
                            )}
                            <span className={`text-xs font-sans px-2.5 py-0.5 rounded-pill border flex-shrink-0 ${status.color} ${status.bg}`}>
                              {status.label}
                            </span>
                            {burden && (
                              <span className={`text-xs font-sans px-2.5 py-0.5 rounded-pill flex-shrink-0
                                ${burden === 'severe' ? 'text-red-600 bg-red-50 border border-red-200' :
                                  burden === 'high' ? 'text-orange-600 bg-orange-50 border border-orange-200' :
                                  burden === 'moderate' ? 'text-amber-600 bg-amber-50 border border-amber-200' :
                                  'text-emerald-600 bg-emerald-50 border border-emerald-200'}`}
                              >
                                {burden.charAt(0).toUpperCase() + burden.slice(1)} burden
                              </span>
                            )}
                            {isMember && (
                              <span className="text-xs font-sans text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-pill border border-emerald-200 flex-shrink-0">
                                Member
                              </span>
                            )}
                          </div>
                          {concerns.length > 0 && (
                            <div className="flex gap-2 mb-2">
                              {concerns.map((c: string) => (
                                <span
                                  key={c}
                                  className="text-xs font-sans text-aubergine/40 bg-aubergine/5 px-2 py-0.5 rounded-pill"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs font-sans text-aubergine/30">
                            Submitted {formatDate(intake.submitted_at)}
                          </p>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          <svg className="w-5 h-5 text-aubergine/20 group-hover:text-violet transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'patients' && (
          /* ====== PATIENTS DIRECTORY TAB ====== */
          <>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="font-serif text-2xl text-aubergine tracking-tight">My Patients</h1>
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
            {filteredPatients.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-card shadow-sm">
                <p className="text-lg font-serif text-aubergine/30">
                  {searchQuery ? 'No patients match your search' : 'No patients yet'}
                </p>
                <p className="text-sm font-sans text-aubergine/20 mt-2">
                  {searchQuery ? 'Try a different search term' : 'Patients will appear here after completing intake'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPatients.map((patient) => {
                  const name = `${patient.profiles?.first_name || ''} ${patient.profiles?.last_name || ''}`.trim() || 'Unknown'
                  const age = getPatientAge(patient.date_of_birth)
                  const latestIntake = patient.intakes?.sort((a, b) =>
                    new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
                  )[0]
                  const burden = getSymptomBurden(latestIntake?.ai_brief)
                  const stage = getMenopausalStage(latestIntake?.ai_brief)
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
                      className="w-full bg-white rounded-card p-5 shadow-sm hover:shadow-md
                                 border border-transparent hover:border-violet/10
                                 transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-sans font-semibold text-violet">
                              {(patient.profiles?.first_name?.[0] || '?').toUpperCase()}
                              {(patient.profiles?.last_name?.[0] || '').toUpperCase()}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-serif text-lg text-aubergine group-hover:text-violet transition-colors truncate">
                                {name}
                              </h3>
                              {age && (
                                <span className="text-xs font-sans text-aubergine/40 flex-shrink-0">{age}y</span>
                              )}
                              {stage && (
                                <span className="text-xs font-sans text-violet/70 bg-violet/5 px-2 py-0.5 rounded-pill border border-violet/10 flex-shrink-0">
                                  {stage}
                                </span>
                              )}
                              {hasMembership && (
                                <span className="text-xs font-sans text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-pill border border-emerald-200 flex-shrink-0">
                                  Member
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs font-sans text-aubergine/40">
                              <span>{visitCount} {visitCount === 1 ? 'visit' : 'visits'}</span>
                              {latestVisitDate && (
                                <span>Last seen {formatShortDate(latestVisitDate)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex-shrink-0 ml-4">
                          <svg className="w-5 h-5 text-aubergine/20 group-hover:text-violet transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'messages' && (
          /* ====== MESSAGES TAB ====== */
          <ProviderMessagesInbox providerId={PROVIDER_ID} onCountChange={setUnreadMessageCount} />
        )}

        {activeTab === 'refills' && (
          /* ====== REFILL REQUESTS TAB ====== */
          <ProviderRefillQueue providerId={PROVIDER_ID} onCountChange={setPendingRefillCount} />
        )}
      </div>
    </div>
  )
}
