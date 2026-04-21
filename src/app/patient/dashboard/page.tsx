'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-browser'
import QuickActions, { SecondaryActions, type DashboardView } from '@/components/patient/QuickActions'
import AppointmentTypeSelector from '@/components/patient/AppointmentTypeSelector'
import PrescriptionRefillReminders from '@/components/patient/PrescriptionRefillReminders'
import PrescriptionList from '@/components/patient/PrescriptionList'
import TimeSlotPicker from '@/components/patient/TimeSlotPicker'
import BookingConfirmation from '@/components/patient/BookingConfirmation'
import PatientMessages from '@/components/patient/PatientMessages'
import WearableTrends from '@/components/patient/WearableTrends'
import PatientLabResults from '@/components/patient/PatientLabResults'
import HealthBlueprintList from '@/components/patient/HealthBlueprintList'
import NotificationBell from '@/components/patient/NotificationBell'
import DashboardAlerts from '@/components/patient/DashboardAlerts'

type IntakeStatus = 'draft' | 'submitted' | 'reviewed' | 'care_plan_sent'
type MembershipStatus = 'active' | 'canceled' | 'past_due' | 'none'

interface PatientData {
  patientId: string
  providerId: string | null
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
  presentationStatus: 'sent' | 'viewed' | null
  intakeId: string | null
}

// Dashboard phases based on patient journey
// 1. intake_done — intake submitted, no appointment yet → "Schedule" banner + intake status left
// 2. appointment_booked — has upcoming appointment → "Upcoming Appointment" banner + intake status left
// 3. care_plan_ready — presentation sent but not viewed → "Health Blueprint" banner + intake status (care plan ready) left
// 4. care_plan_viewed — presentation viewed → no banner, QuickActions left
type DashboardPhase = 'intake_done' | 'appointment_booked' | 'care_plan_ready' | 'care_plan_viewed'

// Demo data for investor demo
const DEMO_PATIENT: PatientData = {
  patientId: 'c0000000-0000-0000-0000-000000000001',
  providerId: 'b0000000-0000-0000-0000-000000000001',
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
  presentationStatus: 'viewed',
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
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const handleCancel = async (appointmentId: string) => {
    setCancelingId(appointmentId)
    try {
      await fetch('/api/scheduling/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, canceledBy: 'patient' }),
      })
      setAppointments(prev => prev.filter(a => a.id !== appointmentId))
    } catch (err) {
      console.error('Failed to cancel appointment:', err)
    } finally {
      setCancelingId(null)
      setCancelConfirmId(null)
    }
  }

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

  // Don't render anything until loaded — avoids flash of spinner when no appointments exist
  if (loading || appointments.length === 0) return null

  return (
    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
      <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-4">
        Upcoming Appointments
      </h3>

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
                {cancelConfirmId === apt.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCancel(apt.id)}
                      disabled={cancelingId === apt.id}
                      className="px-2 py-1 text-[10px] font-sans font-semibold text-white bg-red-500 rounded-pill hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {cancelingId === apt.id ? 'Canceling...' : 'Yes, cancel'}
                    </button>
                    <button
                      onClick={() => setCancelConfirmId(null)}
                      className="px-2 py-1 text-[10px] font-sans font-medium text-aubergine/50 hover:text-aubergine transition-colors"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCancelConfirmId(apt.id)}
                    className="p-1.5 text-aubergine/20 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                    title="Cancel appointment"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
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
  const [appointments, setAppointments] = useState<any[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [activeView, setActiveView] = useState<DashboardView>('dashboard')

  const [cancelConfirmBanner, setCancelConfirmBanner] = useState(false)
  const [cancelingBanner, setCancelingBanner] = useState(false)
  const [cancelConfirmIdTab, setCancelConfirmIdTab] = useState<string | null>(null)
  const [cancelingIdTab, setCancelingIdTab] = useState<string | null>(null)
  const [checkedInAppointmentIds, setCheckedInAppointmentIds] = useState<Set<string> | null>(null)

  const handleCancelBannerAppointment = async () => {
    if (!appointments[0]) return
    setCancelingBanner(true)
    try {
      await fetch('/api/scheduling/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appointments[0].id, canceledBy: 'patient' }),
      })
      setAppointments([])
    } catch (err) {
      console.error('Failed to cancel appointment:', err)
    } finally {
      setCancelingBanner(false)
      setCancelConfirmBanner(false)
    }
  }

  const handleCancelTabAppointment = async (appointmentId: string) => {
    setCancelingIdTab(appointmentId)
    try {
      await fetch('/api/scheduling/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, canceledBy: 'patient' }),
      })
      setAppointments(prev => prev.filter(a => a.id !== appointmentId))
    } catch (err) {
      console.error('Failed to cancel appointment:', err)
    } finally {
      setCancelingIdTab(null)
      setCancelConfirmIdTab(null)
    }
  }

  // Inline scheduling state
  type BookingStep = 'select-type' | 'pick-time' | 'confirm' | 'success'
  const [bookingStep, setBookingStep] = useState<BookingStep>('select-type')
  const [selectedType, setSelectedType] = useState<any>(null)
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [patientNotes, setPatientNotes] = useState('')
  const [bookingInProgress, setBookingInProgress] = useState(false)

  const PROVIDER_ID = patient?.providerId || ''

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

  const refreshAppointments = async () => {
    if (!patient?.patientId) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/scheduling/appointments?patientId=${patient.patientId}&startDate=${today}`)
      const data = await res.json()
      setAppointments((data.appointments || []).filter((a: any) => a.status === 'confirmed').slice(0, 3))
    } catch (err) {
      console.error('Failed to refresh appointments:', err)
    }
  }

  const handleBookAppointment = async () => {
    if (!patient || !selectedType || !selectedSlot) return
    setBookingInProgress(true)
    try {
      const res = await fetch('/api/scheduling/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.patientId,
          providerId: PROVIDER_ID,
          appointmentTypeId: selectedType.id,
          startsAt: selectedSlot.start,
          endsAt: selectedSlot.end,
          patientNotes,
        }),
      })
      const data = await res.json()

      if (data.error) {
        console.error('Booking error:', data.error)
        setBookingInProgress(false)
        return
      }

      if (data.checkoutUrl) {
        // Non-member: redirect to Stripe
        window.location.href = data.checkoutUrl
        return
      }

      // Member: booking confirmed — show success immediately
      setBookingStep('success')
      setBookingInProgress(false)

      // Refresh appointments in the background
      await refreshAppointments()
    } catch (err) {
      console.error('Booking failed:', err)
      setBookingInProgress(false)
    }
  }

  const resetBookingFlow = () => {
    setBookingStep('select-type')
    setSelectedType(null)
    setSelectedSlot(null)
    setPatientNotes('')
    setBookingInProgress(false)
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

  // Fetch appointments at dashboard level for banner logic
  useEffect(() => {
    if (!patient?.patientId) { setAppointmentsLoading(false); return }
    const fetchAppointments = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const res = await fetch(`/api/scheduling/appointments?patientId=${patient.patientId}&startDate=${today}`)
        const data = await res.json()
        setAppointments((data.appointments || []).filter((a: any) => a.status === 'confirmed').slice(0, 3))
      } catch (err) {
        console.error('Failed to fetch appointments:', err)
      } finally {
        setAppointmentsLoading(false)
      }
    }
    fetchAppointments()
  }, [patient?.patientId])

  // Check which upcoming appointments already have a check-in
  useEffect(() => {
    if (appointments.length === 0) return
    const fetchCheckIns = async () => {
      const results = await Promise.all(
        appointments.map((apt) =>
          fetch(`/api/checkin?appointmentId=${apt.id}`)
            .then((r) => r.json())
            .then((d) => ({ id: apt.id, checkedIn: !!d.checkedIn }))
            .catch(() => ({ id: apt.id, checkedIn: false }))
        )
      )
      const checkedIn = new Set(results.filter((r) => r.checkedIn).map((r) => r.id))
      setCheckedInAppointmentIds(checkedIn)
    }
    fetchCheckIns()
  }, [appointments])

  // Derive dashboard phase from patient journey state
  const dashboardPhase: DashboardPhase = (() => {
    if (!patient) return 'intake_done'
    if (patient.presentationStatus === 'viewed') return 'care_plan_viewed'
    if (patient.presentationId) return 'care_plan_ready'
    if (appointments.length > 0) return 'appointment_booked'
    return 'intake_done'
  })()

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
    try {
      // Check Supabase auth session (Auth only — no app table queries)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      // Real session always takes priority — clear any stale demo key
      if (session) {
        localStorage.removeItem('womenkind_demo_patient')
      }

      // Only use demo mode when there is no real session
      if (!session) {
        const demo = localStorage.getItem('womenkind_demo_patient')
        if (demo) {
          setPatient(DEMO_PATIENT)
          setLoading(false)
          return
        }
        router.replace('/patient/login')
        return
      }

      // Fetch all patient data from RDS via API (all app tables live in RDS, not Supabase)
      const meRes = await fetch('/api/patient/me')

      if (!meRes.ok) {
        if (meRes.status === 403) {
          // Logged in but not a patient — redirect to intake
          router.replace('/intake')
          return
        }
        throw new Error(`/api/patient/me returned ${meRes.status}`)
      }

      const me = await meRes.json()

      // Gate: no submitted intake → send to intake flow
      if (!me.intakeStatus || me.intakeStatus === 'draft') {
        router.replace('/intake')
        return
      }

      setPatient({
        patientId: me.patientId,
        providerId: me.providerId ?? null,
        name: me.name,
        email: me.email,
        intakeStatus: me.intakeStatus,
        intakeSubmittedAt: me.intakeSubmittedAt,
        intakeReviewedAt: me.intakeReviewedAt,
        membershipStatus: me.membershipStatus ?? 'none',
        membershipRenewal: me.membershipRenewal,
        intakeSummary: me.intakeSummary,
        presentationId: me.presentationId,
        presentationStatus: me.presentationStatus,
        intakeId: me.intakeId,
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
          <div className="flex items-center gap-1">
            <NotificationBell patientId={patient.patientId} onNavigate={(view) => setActiveView(view)} />
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
                    onClick={() => { setMenuOpen(false); router.push('/patient/settings') }}
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

      <div
        className={`max-w-5xl mx-auto px-6 py-10 transition-all duration-700 ease-out
          ${fadeIn ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
      >
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2">
            Welcome back, {patient.name.split(' ')[0]}
          </h1>
          <p className="text-sm font-sans text-aubergine/40">
            Here's the latest on your care journey.
          </p>
        </div>

        {/* Smart banner — adapts to dashboard phase */}
        {dashboardPhase === 'intake_done' && (
          <div className="mb-6 bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="font-serif font-normal text-lg text-aubergine mb-1">
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

        {dashboardPhase === 'appointment_booked' && appointments[0] && (
          <div className="mb-6 bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="font-serif font-normal text-lg text-aubergine mb-1">
                Your appointment is scheduled
              </h2>
              <p className="text-sm font-sans text-aubergine/50 leading-relaxed">
                {appointments[0].appointment_types?.name || 'Consultation'} on{' '}
                {new Date(appointments[0].starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {' at '}
                {new Date(appointments[0].starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {cancelConfirmBanner ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-sans text-aubergine/50">Cancel this appointment?</span>
                  <button
                    onClick={handleCancelBannerAppointment}
                    disabled={cancelingBanner}
                    className="px-4 py-2 text-sm font-sans font-semibold text-white bg-red-500 rounded-pill hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {cancelingBanner ? 'Canceling...' : 'Yes, cancel'}
                  </button>
                  <button
                    onClick={() => setCancelConfirmBanner(false)}
                    className="px-4 py-2 text-sm font-sans font-medium text-aubergine/50 border border-aubergine/10 rounded-pill hover:bg-aubergine/5 transition-colors"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <>
                  <a
                    href={`/api/scheduling/calendar-export?appointmentId=${appointments[0].id}`}
                    className="flex items-center gap-2 px-4 py-3 border border-aubergine/10 text-sm font-sans font-medium text-aubergine/60 rounded-pill hover:bg-aubergine/5 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Add to Calendar
                  </a>
                  <button
                    onClick={() => setCancelConfirmBanner(true)}
                    className="flex items-center gap-2 px-4 py-3 border border-aubergine/10 text-sm font-sans font-medium text-aubergine/40 rounded-pill hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                  >
                    Cancel Appointment
                  </button>
                  {appointments[0].video_room_url && (
                    <a
                      href={appointments[0].video_room_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-6 py-3 bg-violet text-white text-sm font-sans font-semibold rounded-pill hover:bg-violet/90 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      Join Call
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Check-in prompt — show when there's an upcoming appointment without a check-in */}
        {appointments.length > 0 && checkedInAppointmentIds !== null && !checkedInAppointmentIds.has(appointments[0].id) && (
          <div className="mb-6 bg-white rounded-card shadow-sm shadow-aubergine/5 p-5 flex items-center gap-4 border-l-4 border-violet">
            <div className="w-9 h-9 rounded-full bg-violet/10 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-violet" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans text-sm font-semibold text-aubergine">Complete your pre-visit check-in</p>
              <p className="font-sans text-xs text-aubergine/50 mt-0.5">
                Takes 2 minutes. Helps your provider prepare for your visit.
              </p>
            </div>
            <button
              onClick={() => router.push(`/patient/checkin/${appointments[0].id}`)}
              className="shrink-0 font-sans font-semibold text-sm text-white bg-aubergine rounded-brand px-5 py-2.5 hover:bg-aubergine/90 transition-colors"
            >
              Start check-in
            </button>
          </div>
        )}

        {dashboardPhase === 'care_plan_ready' && patient.presentationId && (
          <div
            className="mb-6 relative rounded-[20px] overflow-hidden group cursor-pointer"
            style={{ minHeight: '200px' }}
            onClick={async () => {
              window.open(`/presentation/${patient.presentationId}`, '_blank')
              setPatient(prev => prev ? { ...prev, presentationStatus: 'viewed' } : prev)
              // Persist via API (service role) — patients cannot update care_presentations via RLS
              await fetch('/api/presentations/viewed', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presentationId: patient.presentationId }),
              })
            }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: 'url(/care-presentation-bg.png)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-aubergine/85 via-aubergine/60 to-transparent" />
            <div className="relative z-10 flex flex-col justify-end h-full p-8 md:p-10" style={{ minHeight: '200px' }}>
              <div className="max-w-[400px]">
                <h2 className="font-serif font-normal text-2xl md:text-[28px] text-white leading-tight mb-3 tracking-tight">
                  Your Future Health Blueprint is Ready
                </h2>
                <p className="text-sm font-sans text-white/70 leading-relaxed mb-5">
                  Dr. Urban has put together a personalized blueprint based on your consultation.
                </p>
                <span
                  className="inline-flex items-center gap-3 pl-6 pr-1.5 py-1.5 rounded-full font-sans text-sm font-semibold
                             bg-violet text-white group-hover:bg-violet/90 transition-all duration-300"
                >
                  View Your Health Blueprint
                  <span className="w-9 h-9 rounded-full bg-aubergine flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </span>
              </div>
            </div>
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
          {/* Left column: status/actions + membership */}
          <div className="md:col-span-1 space-y-6">
            {/* Phase 1-3: Intake status tracker */}
            {dashboardPhase !== 'care_plan_viewed' && (
              <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
                <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-4">
                  Intake Status
                </h3>

                {statusConfig ? (
                  <>
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-sans ${
                        dashboardPhase === 'care_plan_ready'
                          ? STATUS_CONFIG.care_plan_sent.bg + ' ' + STATUS_CONFIG.care_plan_sent.color
                          : statusConfig.bg + ' ' + statusConfig.color
                      }`}
                    >
                      {patient.intakeStatus === 'submitted' && (
                        <span className="w-2 h-2 rounded-full bg-violet animate-pulse" />
                      )}
                      {dashboardPhase === 'care_plan_ready' ? 'Care Plan Ready' : statusConfig.label}
                    </div>

                    <div className="mt-5 space-y-3">
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
                          active: patient.intakeStatus === 'submitted',
                        },
                        {
                          label: 'Care plan ready',
                          date: null,
                          done: dashboardPhase === 'care_plan_ready' || patient.intakeStatus === 'care_plan_sent',
                          active: patient.intakeStatus === 'reviewed' && !patient.presentationId,
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
                              <svg className="w-3 h-3 text-[#4ECDC4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
                                step.done ? 'text-aubergine/70' : step.active ? 'text-violet' : 'text-aubergine/30'
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
                      You haven&apos;t started your intake yet.
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
            )}

            {/* Phase 4: Quick Actions replaces intake status */}
            {dashboardPhase === 'care_plan_viewed' && (
              <QuickActions
                presentationId={patient.presentationId}
                activeView={activeView}
                onSelectView={(view) => {
                  if (activeView === 'schedule' && view !== 'schedule') {
                    resetBookingFlow()
                  }
                  setActiveView(view)
                }}
              />
            )}

            {/* Phase 4: Secondary actions (blueprint, intake summary, billing) */}
            {dashboardPhase === 'care_plan_viewed' && (
              <SecondaryActions
                presentationId={patient.presentationId}
                activeView={activeView}
                onSelectView={(view) => {
                  if (activeView === 'schedule' && view !== 'schedule') {
                    resetBookingFlow()
                  }
                  setActiveView(view)
                }}
              />
            )}

          </div>

          {/* Right column: view-switchable content */}
          <div className="md:col-span-2 space-y-6">

            {/* Dashboard view — upcoming appointment + intake summary */}
            {(activeView === 'dashboard' || dashboardPhase !== 'care_plan_viewed') && (
              <>
                {/* Upcoming appointment — always at top of dashboard */}
                {dashboardPhase !== 'appointment_booked' && (
                  <UpcomingAppointments key={appointments.length} patientId={patient.patientId} />
                )}

                {/* New lab results / health blueprint alerts */}
                <DashboardAlerts patientId={patient.patientId} onNavigate={(view) => setActiveView(view)} />

                {/* Prescription refill reminders */}
                <PrescriptionRefillReminders
                  patientId={patient.patientId}
                  onRequestRefill={() => setActiveView('refill')}
                />

                {patient.intakeSummary ? (
                  <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8">
                    <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-6">
                      Your Intake Summary
                    </h3>

                    <div className="mb-6 p-4 rounded-brand bg-cream border border-aubergine/5">
                      <p className="text-xs font-sans font-semibold text-aubergine/30 mb-1.5">
                        Primary concern
                      </p>
                      <p className="text-sm font-sans text-aubergine/70 italic">
                        &ldquo;{patient.intakeSummary.topConcern}&rdquo;
                      </p>
                    </div>

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
                      <svg className="w-8 h-8 text-violet/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                    </div>
                    <h3 className="font-sans font-semibold text-lg text-aubergine mb-2">No intake summary yet</h3>
                    <p className="text-sm font-sans text-aubergine/40 max-w-sm mx-auto">
                      Once you complete your intake and it&apos;s been processed, your summary will appear here.
                    </p>
                  </div>
                )}

              </>
            )}

            {/* Schedule view — inline 3-step booking flow */}
            {activeView === 'schedule' && dashboardPhase === 'care_plan_viewed' && (
              <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8">
                {/* Header */}
                <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider">
                  Schedule Appointment
                </h3>

                {/* Clickable step indicators */}
                {bookingStep !== 'success' && (
                  <div className="flex items-center justify-center gap-2 mt-7 mb-6">
                    {['Appointment type', 'Date & time', 'Confirm'].map((label, i) => {
                      const steps: BookingStep[] = ['select-type', 'pick-time', 'confirm']
                      const stepIndex = steps.indexOf(bookingStep)
                      const isActive = i === stepIndex
                      const isDone = i < stepIndex
                      const isClickable = isDone

                      const handleStepClick = () => {
                        if (!isClickable) return
                        if (i === 0) {
                          setSelectedType(null)
                          setSelectedSlot(null)
                          setBookingStep('select-type')
                        } else if (i === 1) {
                          setSelectedSlot(null)
                          setBookingStep('pick-time')
                        }
                      }

                      return (
                        <div key={label} className="flex items-center gap-2">
                          {i > 0 && (
                            <div className={`w-6 h-px ${isDone ? 'bg-[#4ECDC4]/40' : 'bg-aubergine/10'}`} />
                          )}
                          <button
                            type="button"
                            disabled={!isClickable}
                            onClick={handleStepClick}
                            className={`flex items-center gap-1.5 ${isClickable ? 'cursor-pointer hover:opacity-70' : 'cursor-default'} transition-opacity`}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans font-medium
                              ${isDone ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]' : isActive ? 'bg-violet/10 text-violet' : 'bg-aubergine/5 text-aubergine/25'}`}>
                              {isDone ? (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                i + 1
                              )}
                            </div>
                            <span className={`text-xs font-sans ${isActive ? 'text-aubergine/60' : isDone ? 'text-[#4ECDC4]/70' : 'text-aubergine/25'}`}>
                              {label}
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Step 1: Select appointment type */}
                {bookingStep === 'select-type' && (
                  <AppointmentTypeSelector
                    providerId={PROVIDER_ID}
                    isMember={patient.membershipStatus === 'active'}
                    excludeNames={['initial consultation']}
                    onSelect={(type) => {
                      setSelectedType(type)
                      setBookingStep('pick-time')
                    }}
                  />
                )}

                {/* Step 2: Pick date & time */}
                {bookingStep === 'pick-time' && selectedType && (
                  <div>
                    <div className="mb-4">
                      <p className="text-sm font-sans text-aubergine/60">
                        {selectedType.name}
                        <span className="text-aubergine/30 mx-1.5">&middot;</span>
                        <span className="text-aubergine/40">{selectedType.duration_minutes} min</span>
                      </p>
                    </div>
                    <TimeSlotPicker
                      providerId={PROVIDER_ID}
                      appointmentTypeId={selectedType.id}
                      durationMinutes={selectedType.duration_minutes}
                      onSelect={(slot) => {
                        setSelectedSlot(slot)
                        setBookingStep('confirm')
                      }}
                    />
                  </div>
                )}

                {/* Step 3: Confirm booking */}
                {bookingStep === 'confirm' && selectedType && selectedSlot && (
                  <BookingConfirmation
                    appointmentType={selectedType}
                    slot={selectedSlot}
                    isMember={patient.membershipStatus === 'active'}
                    patientNotes={patientNotes}
                    onNotesChange={setPatientNotes}
                    onBook={handleBookAppointment}
                    booking={bookingInProgress}
                  />
                )}

                {/* Success state */}
                {bookingStep === 'success' && (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#4ECDC4]/10 mb-4">
                      <svg className="w-8 h-8 text-[#4ECDC4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="font-sans font-semibold text-xl text-aubergine mb-2">
                      Appointment booked
                    </h3>
                    <p className="text-sm font-sans text-aubergine/50 mb-6 max-w-sm mx-auto">
                      You&apos;ll receive a confirmation email with details and a link to join your video visit.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => {
                          resetBookingFlow()
                          setActiveView('dashboard')
                        }}
                        className="px-5 py-2.5 text-sm font-sans font-medium text-aubergine/60 border border-aubergine/10 rounded-pill hover:bg-aubergine/5 transition-all"
                      >
                        Back to Dashboard
                      </button>
                      <button
                        onClick={resetBookingFlow}
                        className="px-5 py-2.5 text-sm font-sans font-medium text-violet border border-violet/20 rounded-pill hover:bg-violet/5 transition-all"
                      >
                        Book Another
                      </button>
                    </div>
                  </div>
                )}

                {/* Show upcoming appointments below the flow */}
                {bookingStep !== 'success' && appointments.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-aubergine/5">
                    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6">
                      <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-4">
                        Upcoming Appointments
                      </h3>
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
                              {cancelConfirmIdTab === apt.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleCancelTabAppointment(apt.id)}
                                    disabled={cancelingIdTab === apt.id}
                                    className="px-2 py-1 text-[10px] font-sans font-semibold text-white bg-red-500 rounded-pill hover:bg-red-600 transition-colors disabled:opacity-50"
                                  >
                                    {cancelingIdTab === apt.id ? 'Canceling...' : 'Yes, cancel'}
                                  </button>
                                  <button
                                    onClick={() => setCancelConfirmIdTab(null)}
                                    className="px-2 py-1 text-[10px] font-sans font-medium text-aubergine/50 hover:text-aubergine transition-colors"
                                  >
                                    Keep
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setCancelConfirmIdTab(apt.id)}
                                  className="p-1.5 text-aubergine/20 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Cancel appointment"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rx Refill view */}
            {activeView === 'refill' && dashboardPhase === 'care_plan_viewed' && (
              <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8">
                <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-2">
                  Your Prescriptions
                </h3>
                <p className="text-sm font-sans text-aubergine/40 mb-6">
                  Submit a refill request and Dr. Urban&apos;s team will review it within 1-2 business days.
                </p>
                <PrescriptionList patientId={patient.patientId} providerId={patient.providerId ?? ''} />
              </div>
            )}

            {/* Message view */}
            {activeView === 'message' && dashboardPhase === 'care_plan_viewed' && (
              <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8">
                <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-2">
                  Message Dr. Urban
                </h3>
                <p className="text-sm font-sans text-aubergine/40 mb-6">
                  Send a secure message to Dr. Urban&apos;s care team. You&apos;ll receive a response within 1-2 business days.
                </p>
                <PatientMessages patientId={patient.patientId} providerId={patient.providerId ?? ''} />
              </div>
            )}

            {/* Wearables / Health Trends view */}
            {activeView === 'wearables' && dashboardPhase === 'care_plan_viewed' && (
              <WearableTrends patientId={patient.patientId} onGoToSettings={() => router.push('/patient/settings')} />
            )}

            {/* Health Blueprint view */}
            {activeView === 'blueprint' && dashboardPhase === 'care_plan_viewed' && (
              <HealthBlueprintList patientId={patient.patientId} />
            )}

            {/* Lab Results view */}
            {activeView === 'lab-results' && dashboardPhase === 'care_plan_viewed' && (
              <PatientLabResults patientId={patient.patientId} />
            )}

            {/* Intake Summary view */}
            {activeView === 'intake-summary' && dashboardPhase === 'care_plan_viewed' && (
              patient.intakeSummary ? (
                <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8">
                  <h3 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider mb-6">
                    Your Intake Summary
                  </h3>

                  <div className="mb-6 p-4 rounded-brand bg-cream border border-aubergine/5">
                    <p className="text-xs font-sans font-semibold text-aubergine/30 mb-1.5">
                      Primary concern
                    </p>
                    <p className="text-sm font-sans text-aubergine/70 italic">
                      &ldquo;{patient.intakeSummary.topConcern}&rdquo;
                    </p>
                  </div>

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

                  <div className="mt-6 p-4 rounded-brand bg-violet/5 border border-violet/10">
                    <p className="text-xs font-sans text-violet/70 leading-relaxed">
                      This is a summary of your intake responses — not a diagnosis. Your provider will
                      review your full clinical brief and discuss findings during your consultation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-8 text-center">
                  <h3 className="font-sans font-semibold text-lg text-aubergine mb-2">No intake summary yet</h3>
                  <p className="text-sm font-sans text-aubergine/40 max-w-sm mx-auto">
                    Once you complete your intake and it&apos;s been processed, your summary will appear here.
                  </p>
                </div>
              )
            )}


          </div>
        </div>
      </div>
    </div>
  )
}
