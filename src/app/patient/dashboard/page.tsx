'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-browser'

type IntakeStatus = 'draft' | 'submitted' | 'reviewed' | 'care_plan_sent'
type MembershipStatus = 'active' | 'canceled' | 'past_due' | 'none'

interface PatientData {
  patientId: string
  name: string
  email: string
  intakeStatus: IntakeStatus | null
  intakeSubmittedAt: string | null
  intakeReviewedAt: string | null
  membershipStatus: MembershipStatus
  membershipRenewal: string | null
  intakeSummary: {
    topConcern: string
    domains: { domain: string; severity: string }[]
    menopausalStage: string
    symptomBurden: string
  } | null
  presentationId: string | null
  intakeId: string | null
}

// Demo data for investor demo
const DEMO_PATIENT: PatientData = {
  patientId: 'c0000000-0000-0000-0000-000000000001',
  name: 'Sarah Mitchell',
  email: 'sarah@example.com',
  intakeStatus: 'reviewed',
  intakeSubmittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  intakeReviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  membershipStatus: 'active',
  membershipRenewal: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
  intakeSummary: {
    topConcern: 'Hot flashes disrupting sleep and daily activities',
    domains: [
      { domain: 'Vasomotor', severity: 'severe' },
      { domain: 'Sleep', severity: 'moderate' },
      { domain: 'Mood & Cognition', severity: 'moderate' },
      { domain: 'GSM', severity: 'mild' },
      { domain: 'Bone Health', severity: 'mild' },
    ],
    menopausalStage: 'Perimenopause',
    symptomBurden: 'high',
  },
  presentationId: 'e3303689-bda9-4044-b695-37d8c075f2bb',
  intakeId: 'demo-intake-id',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'In Progress', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  submitted: { label: 'Under Review', color: 'text-violet', bg: 'bg-violet/5 border-violet/20' },
  reviewed: { label: 'Reviewed', color: 'text-[#4ECDC4]', bg: 'bg-[#4ECDC4]/5 border-[#4ECDC4]/20' },
  care_plan_sent: { label: 'Care Plan Ready', color: 'text-[#4ECDC4]', bg: 'bg-[#4ECDC4]/10 border-[#4ECDC4]/30' },
}

const SEVERITY_COLORS: Record<string, string> = {
  none: 'bg-human text-aubergine/40 border border-aubergine/10',
  mild: 'bg-[#4ECDC4]/10 text-[#4ECDC4] border border-[#4ECDC4]/20',
  moderate: 'bg-amber-50 text-amber-600 border border-amber-200',
  severe: 'bg-red-50 text-red-600 border border-red-200',
}

function UpcomingAppointments({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) { setLoading(false); return }
    const fetchAppointments = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const res = await fetch(`/api/scheduling/appointments?patientId=${patientId}&startDate=${today}`)
        const data = await res.json()
        setAppointments((data.appointments || []).filter((a: any) => a.status === 'confirmed').slice(0, 3))
      } catch (err) {
        console.error('Failed to fetch appointments:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAppointments()
  }, [patientId])

  return (
    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider">
          Upcoming Appointments
        </h3>
        <button
          onClick={() => router.push('/patient/schedule')}
          className="text-xs font-sans font-medium text-violet hover:text-violet/80 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Schedule New
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm font-sans text-aubergine/35 mb-3">No upcoming appointments</p>
          <button
            onClick={() => router.push('/patient/schedule')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet text-white text-sm font-sans font-medium rounded-xl hover:bg-violet/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Book an Appointment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt: any) => (
            <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-human/50 border border-aubergine/5">
              <div
                className="w-1.5 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: apt.appointment_types?.color || '#944fed' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-medium text-aubergine truncate">
                  {apt.appointment_types?.name || 'Appointment'}
                </p>
                <p className="text-xs font-sans text-aubergine/45">
                  {new Date(apt.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' at '}
                  {new Date(apt.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`/api/scheduling/calendar-export?appointmentId=${apt.id}`}
                  className="p-1.5 text-aubergine/30 hover:text-violet hover:bg-violet/5 rounded-lg transition-colors"
                  title="Add to calendar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                  </svg>
                </a>
                {apt.video_room_url ? (
                  <a
                    href={apt.video_room_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold text-white bg-violet rounded-pill hover:bg-violet/90 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Join Call
                  </a>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-sans font-medium rounded-pill bg-emerald-50 border border-emerald-200 text-emerald-600">
                    Confirmed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PatientDashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [patient, setPatient] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fadeIn, setFadeIn] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const membershipParam = searchParams.get('membership')

  const handleMembershipEnroll = async () => {
    if (!patient) return
    setMembershipLoading(true)
    try {
      const res = await fetch('/api/stripe/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intakeId: patient.intakeId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setMembershipLoading(false)
    }
  }

  useEffect(() => {
    loadPatientData()
  }, [])

  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFadeIn(true))
      })
    }
  }, [loading])

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

  const loadPatientData = async () => {
    // Check demo mode first (explicit user choice takes priority)
    const demo = localStorage.getItem('womenkind_demo_patient')
    if (demo) {
      setPatient(DEMO_PATIENT)
      setLoading(false)
      return
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/patient/login')
        return
      }

      const userId = session.user.id

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', userId)
        .single()

      // Get patient record
      const { data: patientRecord } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle()

      // Get latest intake (by patient_id, or fallback to email match in answers)
      let intakeData = null
      if (patientRecord) {
        const { data: intake } = await supabase
          .from('intakes')
          .select('id, status, submitted_at, reviewed_at, ai_brief, answers')
          .eq('patient_id', patientRecord.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        intakeData = intake
      }

      // Fallback: find intake by email if not linked by patient_id
      if (!intakeData && profile?.email) {
        const { data: intakeByEmail } = await supabase
          .from('intakes')
          .select('id, status, submitted_at, reviewed_at, ai_brief, answers')
          .neq('status', 'draft')
          .order('started_at', { ascending: false })
          .limit(10)

        if (intakeByEmail) {
          intakeData = intakeByEmail.find(
            (i: any) => i.answers?.email?.toLowerCase() === profile.email.toLowerCase()
          ) || null

          // Link the intake to the patient record if found
          if (intakeData && patientRecord) {
            await supabase
              .from('intakes')
              .update({ patient_id: patientRecord.id })
              .eq('id', intakeData.id)
          }
        }
      }

      // Gate: if user has a patient record but no submitted intake, redirect to intake
      if (patientRecord && (!intakeData || intakeData.status === 'draft')) {
        router.replace('/intake')
        return
      }

      // Get membership
      let membershipStatus: MembershipStatus = 'none'
      let membershipRenewal: string | null = null
      if (patientRecord) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, current_period_end')
          .eq('patient_id', patientRecord.id)
          .eq('plan_type', 'membership')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (sub) {
          membershipStatus = sub.status as MembershipStatus
          membershipRenewal = sub.current_period_end
        }
      }

      // Build intake summary from AI brief
      let intakeSummary = null
      if (intakeData?.ai_brief) {
        const brief = intakeData.ai_brief
        intakeSummary = {
          topConcern:
            intakeData.answers?.top_concern ||
            brief.symptom_summary?.overview ||
            '',
          domains:
            brief.symptom_summary?.domains?.map((d: any) => ({
              domain: d.domain,
              severity: d.severity,
            })) || [],
          menopausalStage: brief.metadata?.menopausal_stage || 'Unknown',
          symptomBurden: brief.metadata?.symptom_burden || 'unknown',
        }
      }

      // Check for care presentation
      let presentationId: string | null = null
      if (patientRecord) {
        const { data: presData } = await supabase
          .from('care_presentations')
          .select('id')
          .eq('patient_id', patientRecord.id)
          .in('status', ['sent', 'viewed'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        presentationId = presData?.id || null
      }

      setPatient({
        patientId: patientRecord?.id || '',
        name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Patient',
        email: profile?.email || session.user.email || '',
        intakeStatus: intakeData?.status || null,
        intakeSubmittedAt: intakeData?.submitted_at || null,
        intakeReviewedAt: intakeData?.reviewed_at || null,
        membershipStatus,
        membershipRenewal,
        intakeSummary,
        presentationId,
        intakeId: intakeData?.id || null,
      })
    } catch (err) {
      console.error('Error loading patient data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('womenkind_demo_patient')
    await supabase.auth.signOut()
    router.push('/patient/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (!patient) return null

  const statusConfig = patient.intakeStatus
    ? STATUS_CONFIG[patient.intakeStatus]
    : null

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
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 text-sm font-sans text-aubergine/60 hover:text-aubergine transition-colors rounded-pill px-3 py-1.5 hover:bg-aubergine/5"
            >
              <div className="w-7 h-7 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-violet">
                  {patient.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {patient.name}
              <svg
                className={`w-3.5 h-3.5 text-aubergine/30 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
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
                    onClick={() => { setMenuOpen(false); router.push('/provider/dashboard') }}
                    className="w-full text-left px-4 py-2.5 text-sm font-sans text-violet/70 hover:bg-violet/5 hover:text-violet transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-violet/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    Switch to Provider View
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
      </nav>

      <div
        className={`max-w-5xl mx-auto px-6 py-10 transition-all duration-700 ease-out
          ${fadeIn ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
      >
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="font-serif text-2xl md:text-3xl text-aubergine mb-2">
            Welcome back, {patient.name.split(' ')[0]}
          </h1>
          <p className="text-sm font-sans text-aubergine/40">
            Here's the latest on your care journey.
          </p>
        </div>

        {/* Scheduling banner — show when paid but no upcoming appointments */}
        {patient.intakeStatus && patient.intakeStatus !== 'draft' && (
          <div className="mb-6 bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="font-serif text-lg text-aubergine mb-1">
                Begin your health journey
              </h2>
              <p className="text-sm font-sans text-aubergine/50 leading-relaxed">
                Your intake is complete. Schedule your initial consultation with your provider to review your results and start your personalized care plan.
              </p>
            </div>
            <button
              onClick={() => router.push('/patient/schedule')}
              className="shrink-0 flex items-center gap-2 px-6 py-3 bg-violet text-white text-sm font-sans font-semibold rounded-pill hover:bg-violet/90 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Schedule Appointment
            </button>
          </div>
        )}

        {/* Membership notification */}
        {membershipParam === 'active' && (
          <div className="mb-6 px-4 py-3 rounded-brand bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 flex items-center gap-3">
            <svg className="w-5 h-5 text-[#4ECDC4] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-sans text-[#4ECDC4]">
              Your membership is now active! Welcome to ongoing care with Womenkind.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left column: status + membership */}
          <div className="md:col-span-1 space-y-6">
            {/* Intake status card */}
            <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
              <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-4">
                Intake Status
              </h3>

              {statusConfig ? (
                <>
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-sans ${statusConfig.bg} ${statusConfig.color}`}
                  >
                    {patient.intakeStatus === 'submitted' && (
                      <span className="w-2 h-2 rounded-full bg-violet animate-pulse" />
                    )}
                    {statusConfig.label}
                  </div>

                  <div className="mt-5 space-y-3">
                    {/* Status timeline */}
                    {[
                      {
                        label: 'Intake submitted',
                        date: patient.intakeSubmittedAt,
                        done: !!patient.intakeSubmittedAt,
                      },
                      {
                        label: 'Provider review',
                        date: patient.intakeReviewedAt,
                        done: !!patient.intakeReviewedAt,
                        active:
                          patient.intakeStatus === 'submitted',
                      },
                      {
                        label: 'Care plan ready',
                        date: null,
                        done: patient.intakeStatus === 'care_plan_sent',
                        active:
                          patient.intakeStatus === 'reviewed',
                      },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 mt-0.5 rounded-full flex items-center justify-center shrink-0 ${
                            step.done
                              ? 'bg-[#4ECDC4]/20'
                              : step.active
                              ? 'bg-violet/20'
                              : 'bg-human'
                          }`}
                        >
                          {step.done ? (
                            <svg
                              className="w-3 h-3 text-[#4ECDC4]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : step.active ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-aubergine/15" />
                          )}
                        </div>
                        <div>
                          <p
                            className={`text-sm font-sans ${
                              step.done
                                ? 'text-aubergine/70'
                                : step.active
                                ? 'text-violet'
                                : 'text-aubergine/30'
                            }`}
                          >
                            {step.label}
                          </p>
                          {step.date && (
                            <p className="text-xs font-sans text-aubergine/30 mt-0.5">
                              {new Date(step.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm font-sans text-aubergine/40 mb-4">
                    You haven't started your intake yet.
                  </p>
                  <a
                    href="/intake"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-sans text-sm font-semibold
                               bg-violet text-white hover:bg-violet-dark shadow-sm
                               transition-all duration-300"
                  >
                    Begin Intake
                  </a>
                </div>
              )}
            </div>

            {/* Membership card */}
            <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
              <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-4">
                Membership
              </h3>

              {patient.membershipStatus === 'active' ? (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-[#4ECDC4]/5 border-[#4ECDC4]/20 text-sm font-sans text-[#4ECDC4]">
                    Active Member
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm font-sans">
                      <span className="text-aubergine/40">Plan</span>
                      <span className="text-aubergine/70">$200/month</span>
                    </div>
                    {patient.membershipRenewal && (
                      <div className="flex justify-between text-sm font-sans">
                        <span className="text-aubergine/40">Next renewal</span>
                        <span className="text-aubergine/70">
                          {new Date(patient.membershipRenewal).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-sans text-aubergine/25 mt-4">
                    Includes follow-ups, prescriptions, progress tracking, and care presentations.
                  </p>
                </>
              ) : patient.membershipStatus === 'past_due' ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-amber-50 border-amber-200 text-sm font-sans text-amber-600">
                  Payment Past Due
                </div>
              ) : (
                <>
                  <p className="text-sm font-sans text-aubergine/60 mb-2">
                    Continue with membership
                  </p>
                  <p className="text-xs font-sans text-aubergine/35 mb-4 leading-relaxed">
                    Get ongoing care for $200/month — follow-up visits, progress tracking, prescription management, and personalized care presentations.
                  </p>
                  <button
                    onClick={handleMembershipEnroll}
                    disabled={membershipLoading}
                    className="w-full py-2.5 rounded-full font-sans text-sm font-semibold
                               bg-violet text-white hover:bg-violet/90
                               disabled:opacity-50 transition-all duration-300"
                  >
                    {membershipLoading ? 'Loading...' : 'Enroll — $200/month'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right column: care presentation + intake summary */}
          <div className="md:col-span-2 space-y-6">
            {/* Care Presentation — hero card at top of right column */}
            {patient.presentationId && (
              <div
                className="relative rounded-[20px] overflow-hidden group"
                style={{ minHeight: '240px' }}
              >
                {/* Background image */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                  style={{ backgroundImage: 'url(/care-presentation-bg.png)' }}
                />
                {/* Dark gradient overlay — stronger on the left for text readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-aubergine/85 via-aubergine/60 to-transparent" />
                {/* Content */}
                <div className="relative z-10 flex flex-col justify-end h-full p-8 md:p-10" style={{ minHeight: '240px' }}>
                  <div className="max-w-[340px]">
                    <h3 className="font-serif text-2xl md:text-[28px] text-white leading-tight mb-3 tracking-tight">
                      Your Future Health Blueprint is Ready
                    </h3>
                    <p className="text-sm font-sans text-white/70 leading-relaxed mb-6">
                      Dr. Urban has put together a personalized blueprint based on your one-on-one.
                    </p>
                    <button
                      onClick={() => router.push(`/presentation/${patient.presentationId}`)}
                      className="inline-flex items-center gap-3 pl-6 pr-1.5 py-1.5 rounded-full font-sans text-sm font-semibold
                                 bg-violet text-white hover:bg-violet/90
                                 transition-all duration-300"
                    >
                      View Your Future Health Blueprint
                      <span className="w-9 h-9 rounded-full bg-aubergine flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {patient.intakeSummary ? (
              <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8">
                <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-6">
                  Your Intake Summary
                </h3>

                {/* Top concern */}
                <div className="mb-6 p-4 rounded-brand bg-cream border border-aubergine/5">
                  <p className="text-xs font-sans font-semibold text-aubergine/30 mb-1.5">
                    Primary concern
                  </p>
                  <p className="text-sm font-sans text-aubergine/70 italic">
                    "{patient.intakeSummary.topConcern}"
                  </p>
                </div>

                {/* Metadata badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 rounded-full bg-violet/5 border border-violet/10 text-xs font-sans text-violet">
                    {patient.intakeSummary.menopausalStage}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-sans ${
                      SEVERITY_COLORS[patient.intakeSummary.symptomBurden] || SEVERITY_COLORS.moderate
                    }`}
                  >
                    Symptom burden: {patient.intakeSummary.symptomBurden.charAt(0).toUpperCase() + patient.intakeSummary.symptomBurden.slice(1)}
                  </span>
                </div>

                {/* Symptom domains */}
                <div className="space-y-3 mt-8">
                  <p className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider">
                    Symptom domains assessed
                  </p>
                  {patient.intakeSummary.domains.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5 border-b border-aubergine/5 last:border-0"
                    >
                      <span className="text-sm font-sans text-aubergine/70">{d.domain}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-sans ${
                          SEVERITY_COLORS[d.severity] || SEVERITY_COLORS.mild
                        }`}
                      >
                        {d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Note */}
                <div className="mt-6 p-4 rounded-brand bg-violet/5 border border-violet/10">
                  <p className="text-xs font-sans text-violet/70 leading-relaxed">
                    This is a summary of your intake responses — not a diagnosis. Your provider will
                    review your full clinical brief and discuss findings during your consultation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet/5 mb-4">
                  <svg
                    className="w-8 h-8 text-violet/30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                    />
                  </svg>
                </div>
                <h3 className="font-serif text-lg text-aubergine mb-2">
                  No intake summary yet
                </h3>
                <p className="text-sm font-sans text-aubergine/40 max-w-sm mx-auto">
                  Once you complete your intake and it's been processed, your summary will appear here.
                </p>
              </div>
            )}

            {/* Upcoming Appointments */}
            <UpcomingAppointments patientId={patient.patientId} />

          </div>
        </div>
      </div>
    </div>
  )
}
