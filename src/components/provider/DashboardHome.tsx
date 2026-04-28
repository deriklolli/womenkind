'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProviderSession } from '@/lib/getProviderSession'
import { devFixtures } from '@/lib/dev-fixtures'

interface TodayAppointment {
  id: string
  starts_at: string
  ends_at: string
  status: string
  video_room_url: string | null
  appointment_types: { name: string; duration_minutes: number; color: string } | null
  patients: {
    id: string
    profiles: { first_name: string | null; last_name: string | null } | null
    subscriptions?: { status: string; plan_type: string }[]
  } | null
}

interface NewIntake {
  id: string
  status: string
  answers: Record<string, any>
  submitted_at: string | null
  ai_brief: any
  patient_id?: string
}

interface UnreadThread {
  id: string
  thread_id: string
  body: string
  created_at: string
  unreadCount: number
  senderName?: string
}

interface PendingRefill {
  id: string
  created_at: string
  patient_note: string | null
  prescriptions: { medication_name: string; dosage: string; frequency: string } | null
  patients: {
    id: string
    profiles: { first_name: string | null; last_name: string | null } | null
  } | null
}

interface Cancellation {
  id: string
  canceled_at: string
  appointment_types: { name: string } | null
  patients: {
    profiles: { first_name: string | null; last_name: string | null } | null
  } | null
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const BURDEN_STYLES: Record<string, string> = {
  severe: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  moderate: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
}

export default function DashboardHome() {
  const router = useRouter()
  const [providerId, setProviderId] = useState('')
  const [providerName, setProviderName] = useState('')
  const [loading, setLoading] = useState(true)

  const [appointments, setAppointments] = useState<TodayAppointment[]>([])
  const [intakes, setIntakes] = useState<NewIntake[]>([])
  const [threads, setThreads] = useState<UnreadThread[]>([])
  const [refills, setRefills] = useState<PendingRefill[]>([])
  const [cancellations, setCancellations] = useState<Cancellation[]>([])

  useEffect(() => {
    getProviderSession().then(session => {
      if (!session) return
      setProviderId(session.providerId)
      setProviderName(session.providerName)
    })
  }, [])

  useEffect(() => {
    if (!providerId) return
    const today = new Date().toISOString().slice(0, 10)

    const safeFetch = async (url: string) => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`${res.status}`)
        return await res.json()
      } catch (_) {
        return null
      }
    }

    Promise.all([
      safeFetch(`/api/scheduling/appointments?providerId=${providerId}&startDate=${today}&endDate=${today}`),
      safeFetch('/api/provider/intakes'),
      safeFetch(`/api/messages?providerId=${providerId}`),
      safeFetch(`/api/refill-requests?providerId=${providerId}&status=pending`),
      safeFetch(`/api/provider/recent-cancellations?providerId=${providerId}`),
    ]).then(([apptData, intakeData, msgData, refillData, cancelData]) => {
      const isDev = process.env.NODE_ENV === 'development'

      const appts = apptData
        ? (apptData.appointments || []).filter((a: TodayAppointment) => a.status !== 'canceled')
        : isDev ? devFixtures.todayAppointments as TodayAppointment[] : []

      const newIntakes = intakeData
        ? (intakeData.intakes || []).filter((i: NewIntake) => i.status === 'submitted').slice(0, 5)
        : isDev ? devFixtures.newIntakes as NewIntake[] : []

      const newThreads = msgData
        ? (msgData.threads || []).filter((t: UnreadThread) => t.unreadCount > 0).slice(0, 5)
        : isDev ? devFixtures.unreadThreads as UnreadThread[] : []

      const newRefills = refillData
        ? (refillData.refillRequests || []).slice(0, 5)
        : isDev ? devFixtures.pendingRefills as PendingRefill[] : []

      const newCancellations = cancelData
        ? (cancelData.appointments || []).slice(0, 3)
        : isDev ? devFixtures.recentCancellations as Cancellation[] : []

      setAppointments(appts)
      setIntakes(newIntakes)
      setThreads(newThreads)
      setRefills(newRefills)
      setCancellations(newCancellations)
      setLoading(false)
    })
  }, [providerId])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const displayName = providerName.replace(/^Dr\.\s*/i, '')

  if (loading && !providerId) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif font-normal text-3xl text-aubergine tracking-tight">
            {getGreeting()}{providerName ? `, ${providerName}` : ''}.
          </h1>
          <p className="text-sm font-sans text-aubergine/40 mt-1">{today}</p>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">

          {/* Today's Schedule */}
          <div className="bg-white rounded-card shadow-sm border border-aubergine/5 flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-aubergine/5">
              <h2 className="font-sans font-semibold text-base text-aubergine">Today's Schedule</h2>
              <button
                onClick={() => router.push('/provider/schedule')}
                className="text-xs font-sans text-violet hover:text-aubergine/60 transition-colors"
              >
                View all →
              </button>
            </div>
            <div className="flex-1 divide-y divide-aubergine/5">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
                </div>
              ) : appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <svg className="w-8 h-8 text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-sans text-aubergine/30">No appointments today</p>
                </div>
              ) : (
                appointments.map(appt => {
                  const name = [appt.patients?.profiles?.first_name, appt.patients?.profiles?.last_name].filter(Boolean).join(' ') || 'Unknown'
                  const isMember = appt.patients?.subscriptions?.some(s => s.plan_type === 'membership' && s.status === 'active')
                  return (
                    <div key={appt.id} className="px-6 py-3.5 flex items-center gap-3">
                      <div className="text-center w-[68px] flex-shrink-0">
                        <p className="text-sm font-sans font-bold text-aubergine">{formatTime(appt.starts_at)}</p>
                        <p className="text-[10px] font-sans text-aubergine/30">{formatTime(appt.ends_at)}</p>
                      </div>
                      <div
                        className="w-1 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: appt.appointment_types?.color || '#944fed' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => router.push(`/provider/patient/${appt.patients?.id}`)}
                            className="text-sm font-sans font-semibold text-aubergine hover:text-violet transition-colors"
                          >
                            {name}
                          </button>
                          {isMember && (
                            <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 text-xs font-sans font-medium px-2 py-0.5 rounded-pill flex-shrink-0">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                              Member
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-sans text-aubergine/40 truncate">{appt.appointment_types?.name || 'Appointment'} · {appt.appointment_types?.duration_minutes}min</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {appt.patients?.id && (
                          <a
                            href={`/provider/patient/${appt.patients.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-violet bg-violet/5 border border-violet/15 px-3 py-1.5 rounded-pill hover:bg-violet/10 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                            Visit Prep
                          </a>
                        )}
                        {appt.video_room_url ? (
                          <a
                            href={`/api/visits/join-as-host?appointmentId=${appt.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-white bg-violet px-3 py-1.5 rounded-pill hover:bg-violet/90 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            Join Call
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-sans font-medium text-aubergine/50 bg-aubergine/5 border border-aubergine/10 px-3 py-1.5 rounded-pill">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6h1.5m-1.5 3h1.5m-1.5 3h1.5M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                            </svg>
                            In-Office
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* New Intakes */}
          <div className="bg-white rounded-card shadow-sm border border-aubergine/5 flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-aubergine/5">
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-semibold text-base text-aubergine">New Intakes</h2>
                {intakes.length > 0 && (
                  <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">{intakes.length}</span>
                )}
              </div>
            </div>
            <div className="flex-1 divide-y divide-aubergine/5">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
                </div>
              ) : intakes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <svg className="w-8 h-8 text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm font-sans text-aubergine/30">No new intakes</p>
                </div>
              ) : (
                intakes.map(intake => {
                  const name = intake.answers?.full_name || 'Unknown Patient'
                  const burden = intake.ai_brief?.metadata?.symptom_burden
                  const stage = intake.ai_brief?.metadata?.menopausal_stage
                  return (
                    <button
                      key={intake.id}
                      onClick={() => intake.patient_id
                        ? router.push(`/provider/patient/${intake.patient_id}?tab=intake`)
                        : router.push(`/provider/brief/${intake.id}`)}
                      className="w-full px-6 py-4 flex items-center gap-3 hover:bg-violet/3 transition-colors text-left group"
                    >
                      <div className="w-2 h-2 rounded-full bg-violet flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-sans font-semibold text-aubergine truncate">{name}</p>
                        <p className="text-xs font-sans text-aubergine/40 mt-0.5">
                          {stage ? stage.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'New patient'}
                          {intake.submitted_at ? ` · ${formatRelative(intake.submitted_at)}` : ''}
                        </p>
                      </div>
                      {burden && (
                        <span className={`flex-shrink-0 text-xs font-sans px-2 py-0.5 rounded-pill border ${BURDEN_STYLES[burden] || BURDEN_STYLES.low}`}>
                          {burden.charAt(0).toUpperCase() + burden.slice(1)}
                        </span>
                      )}
                      <svg className="w-4 h-4 text-aubergine/20 group-hover:text-violet transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-2 gap-6 mb-6">

          {/* Messages */}
          <div className="bg-white rounded-card shadow-sm border border-aubergine/5 flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-aubergine/5">
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-semibold text-base text-aubergine">Messages</h2>
                {threads.length > 0 && (
                  <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">{threads.length}</span>
                )}
              </div>
              <button
                onClick={() => router.push('/provider/dashboard?tab=messages')}
                className="text-xs font-sans text-violet hover:text-aubergine/60 transition-colors"
              >
                View all →
              </button>
            </div>
            <div className="flex-1 divide-y divide-aubergine/5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
                </div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <svg className="w-8 h-8 text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <p className="text-sm font-sans text-aubergine/30">All caught up</p>
                </div>
              ) : (
                threads.map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => router.push('/provider/dashboard?tab=messages')}
                    className="w-full px-6 py-4 flex items-start gap-3 hover:bg-violet/3 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-violet">
                        {(thread.senderName || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-sm font-sans font-semibold text-aubergine truncate">{thread.senderName || 'Patient'}</p>
                        <p className="text-xs font-sans text-aubergine/30 flex-shrink-0">{formatRelative(thread.created_at)}</p>
                      </div>
                      <p className="text-xs font-sans text-aubergine/50 truncate">{thread.body}</p>
                    </div>
                    {thread.unreadCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Refill Requests */}
          <div className="bg-white rounded-card shadow-sm border border-aubergine/5 flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-aubergine/5">
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-semibold text-base text-aubergine">Refill Requests</h2>
                {refills.length > 0 && (
                  <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">{refills.length}</span>
                )}
              </div>
              <button
                onClick={() => router.push('/provider/dashboard?tab=refills')}
                className="text-xs font-sans text-violet hover:text-aubergine/60 transition-colors"
              >
                View all →
              </button>
            </div>
            <div className="flex-1 divide-y divide-aubergine/5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
                </div>
              ) : refills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <svg className="w-8 h-8 text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 8.5l7 7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.636 15.364a5 5 0 010-7.071l4.95-4.95a5 5 0 017.07 7.07l-4.95 4.95a5 5 0 01-7.07 0z" />
                  </svg>
                  <p className="text-sm font-sans text-aubergine/30">No pending refills</p>
                </div>
              ) : (
                refills.map(refill => {
                  const name = [refill.patients?.profiles?.first_name, refill.patients?.profiles?.last_name].filter(Boolean).join(' ') || 'Unknown'
                  const med = refill.prescriptions?.medication_name || 'Medication'
                  const dose = refill.prescriptions?.dosage || ''
                  return (
                    <button
                      key={refill.id}
                      onClick={() => router.push('/provider/dashboard?tab=refills')}
                      className="w-full px-6 py-4 flex items-center gap-3 hover:bg-violet/3 transition-colors text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-sans font-semibold text-aubergine truncate">{name}</p>
                        <p className="text-xs font-sans text-aubergine/50 truncate">{med}{dose ? ` · ${dose}` : ''}</p>
                        <p className="text-xs font-sans text-aubergine/30 mt-0.5">{formatRelative(refill.created_at)}</p>
                      </div>
                      <span className="flex-shrink-0 text-xs font-sans px-2.5 py-1 rounded-pill bg-amber-50 text-amber-600 border border-amber-200 font-medium">
                        Pending
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Cancellations — only show if any */}
        {cancellations.length > 0 && (
          <div className="bg-white rounded-card shadow-sm border border-red-100">
            <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-red-50">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="font-sans font-semibold text-base text-aubergine">Recent Cancellations</h2>
            </div>
            <div className="divide-y divide-red-50">
              {cancellations.map(c => {
                const name = [c.patients?.profiles?.first_name, c.patients?.profiles?.last_name].filter(Boolean).join(' ') || 'Unknown'
                return (
                  <div key={c.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-sans text-aubergine">
                        <span className="font-semibold">{name}</span> canceled their{' '}
                        <span className="text-aubergine/60">{c.appointment_types?.name || 'appointment'}</span>
                      </p>
                    </div>
                    <p className="text-xs font-sans text-aubergine/40 flex-shrink-0">{formatRelative(c.canceled_at)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
