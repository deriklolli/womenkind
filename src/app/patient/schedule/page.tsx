'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-browser'
import AppointmentTypeSelector from '@/components/patient/AppointmentTypeSelector'
import TimeSlotPicker from '@/components/patient/TimeSlotPicker'
import BookingConfirmation from '@/components/patient/BookingConfirmation'
import InPersonRequestForm from '@/components/patient/InPersonRequestForm'
import type { NearbyClinic } from '@/app/api/clinics/nearby/route'

type BookingStep =
  | 'enter-zip'        // no location on file — prompt for zip
  | 'visit-type'       // nearby clinic found — choose video vs in-person
  | 'select-type'      // video flow: pick appointment type
  | 'pick-time'        // video flow: pick time slot
  | 'confirm'          // video flow: review & book
  | 'success'          // video flow: booked
  | 'inperson-form'    // in-person flow: request form
  | 'inperson-success' // in-person flow: submitted

const DEMO_PATIENT_ID = 'c0000000-0000-0000-0000-000000000001'

interface AppointmentType {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  color: string
}

interface TimeSlot {
  start: string
  end: string
}

interface BookedAppointment {
  id: string
  starts_at: string
  ends_at: string
  status: string
  video_room_url?: string | null
  appointment_types: { name: string; duration_minutes: number }
}

export default function PatientSchedulePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<BookingStep>('select-type') // overwritten in checkAuth
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [patientId, setPatientId] = useState(DEMO_PATIENT_ID)
  const [providerId, setProviderId] = useState('')
  const [patientName, setPatientName] = useState('Sarah Mitchell')
  const [patientEmail, setPatientEmail] = useState('dlolli@gmail.com')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Booking state
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [patientNotes, setPatientNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookedAppointment, setBookedAppointment] = useState<BookedAppointment | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [canceling, setCanceling] = useState(false)

  // In-person / proximity state
  const [nearbyClinic, setNearbyClinic] = useState<NearbyClinic | null>(null)
  const [zipInput, setZipInput] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [zipError, setZipError] = useState<string | null>(null)

  // Check if we're returning from a successful payment
  const bookedId = searchParams.get('booked')
  const canceled = searchParams.get('canceled')

  useEffect(() => {
    checkAuth()
  }, [])

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

  useEffect(() => {
    if (bookedId) {
      setStep('success')
      // Fetch the booked appointment details
      fetchBookedAppointment(bookedId)
    }
  }, [bookedId])

  const checkAuth = async () => {
    // Check real auth first (takes priority over demo mode)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // Fall back to demo mode if no real session
      const demo = localStorage.getItem('womenkind_demo_patient')
      if (demo) {
        const demoData = JSON.parse(demo)
        setPatientId(demoData.patientId || DEMO_PATIENT_ID)
        setPatientName('Sarah Mitchell')
        setPatientEmail('dlolli@gmail.com')
        setIsMember(true) // Demo patient Sarah is a member
        // Demo mode skips proximity check — go straight to video booking
        setStep('select-type')
        setLoading(false)
        return
      }
      router.push('/patient/login')
      return
    }

    // Fetch patient data from RDS via API (all app tables are in RDS, not Supabase)
    const meRes = await fetch('/api/patient/me')
    if (!meRes.ok) {
      // Not a patient account or error — fall back to select-type
      setStep('select-type')
      setLoading(false)
      return
    }

    const me = await meRes.json()
    setPatientName(me.name || 'Patient')
    setPatientEmail(me.email || session.user.email || '')
    setPatientId(me.patientId)
    setProviderId(me.providerId || '')
    setIsMember(me.isMember ?? false)

    // Proximity check — determine whether to offer in-person option
    await checkNearbyClinic(me.patientId)
    setLoading(false)
  }

  const checkNearbyClinic = async (pid: string) => {
    try {
      const res = await fetch(`/api/clinics/nearby?patientId=${pid}`)
      const data = await res.json()

      if (!data.hasLocation) {
        // Patient has no stored coordinates yet — ask for their zip first
        setStep('enter-zip')
        return
      }

      if (data.clinics && data.clinics.length > 0) {
        setNearbyClinic(data.clinics[0]) // closest clinic
        setStep('visit-type')
      } else {
        // No clinics nearby — go straight to video booking
        setStep('select-type')
      }
    } catch {
      // On error, silently fall through to video booking
      setStep('select-type')
    }
  }

  const handleGeocode = async () => {
    const zip = zipInput.trim()
    if (!/^\d{5}$/.test(zip)) {
      setZipError('Please enter a valid 5-digit zip code.')
      return
    }
    setZipError(null)
    setGeocoding(true)
    try {
      const res = await fetch('/api/clinics/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, zip }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setZipError(data.error || 'Could not find that zip code. Please try again.')
        return
      }
      // Coordinates stored — now re-run the proximity check
      await checkNearbyClinic(patientId)
    } catch {
      setZipError('Something went wrong. Please try again.')
    } finally {
      setGeocoding(false)
    }
  }

  const fetchBookedAppointment = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduling/appointments?patientId=${patientId}`)
      const data = await res.json()
      const apt = data.appointments?.find((a: any) => a.id === id)
      if (apt) setBookedAppointment(apt)
    } catch (err) {
      console.error('Failed to fetch booked appointment:', err)
    }
  }

  const handleSelectType = (type: AppointmentType) => {
    setSelectedType(type)
    setStep('pick-time')
  }

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot)
    setStep('confirm')
  }

  const handleBook = async () => {
    if (!selectedType || !selectedSlot) return
    setBooking(true)

    try {
      const res = await fetch('/api/scheduling/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          providerId,
          appointmentTypeId: selectedType.id,
          startsAt: selectedSlot.start,
          patientNotes: patientNotes || undefined,
        }),
      })

      const data = await res.json()

      if (data.status === 'confirmed') {
        // Member — booked directly
        setBookedAppointment({
          id: data.appointment.id,
          starts_at: data.appointment.starts_at,
          ends_at: data.appointment.ends_at,
          status: 'confirmed',
          video_room_url: data.appointment.video_room_url,
          appointment_types: {
            name: selectedType.name,
            duration_minutes: selectedType.duration_minutes,
          },
        })
        setStep('success')
      } else if (data.checkoutUrl) {
        // Non-member — redirect to Stripe
        window.location.href = data.checkoutUrl
      } else {
        console.error('Unexpected booking response:', data)
      }
    } catch (err) {
      console.error('Booking error:', err)
    } finally {
      setBooking(false)
    }
  }

  const handleCancelAppointment = async () => {
    if (!bookedAppointment) return
    setCanceling(true)
    try {
      const res = await fetch('/api/scheduling/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: bookedAppointment.id, canceledBy: 'patient' }),
      })
      if (res.ok) {
        setBookedAppointment({ ...bookedAppointment, status: 'canceled' })
        setCancelConfirm(false)
      }
    } catch (err) {
      console.error('Cancel failed:', err)
    } finally {
      setCanceling(false)
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('womenkind_demo_patient')
    await supabase.auth.signOut()
    router.push('/patient/login')
  }

  const handleBack = () => {
    if (step === 'pick-time') {
      setStep('select-type')
      setSelectedType(null)
    } else if (step === 'confirm') {
      setStep('pick-time')
      setSelectedSlot(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <nav className="bg-white border-b border-aubergine/5">
        <div className="max-w-5xl mx-auto px-6 py-[3px] flex items-center justify-between">
          <button onClick={() => router.push('/patient/dashboard')} className="flex items-center">
            <Image
              src="/womenkind-logo-dark.png"
              alt="Womenkind"
              width={400}
              height={90}
              className="h-16 w-auto -ml-2"
              priority
            />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 text-sm font-sans text-aubergine/60 hover:text-aubergine transition-colors rounded-pill px-3 py-1.5 hover:bg-aubergine/5"
            >
              <div className="w-7 h-7 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-violet">
                  {patientName.charAt(0).toUpperCase()}
                </span>
              </div>
              {patientName}
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
                  <p className="text-sm font-sans font-medium text-aubergine">{patientName}</p>
                  <p className="text-xs font-sans text-aubergine/40 mt-0.5">{patientEmail}</p>
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

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Progress bar — only shown for the video booking flow */}
        {(['select-type', 'pick-time', 'confirm'] as BookingStep[]).includes(step) && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {(['select-type', 'pick-time', 'confirm'] as const).map((s, i) => {
              const steps: BookingStep[] = ['select-type', 'pick-time', 'confirm']
              const currentIdx = steps.indexOf(step)
              const isCompleted = currentIdx > i
              const isCurrent = step === s
              const canClick = isCompleted

              return (
                <div key={s} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!canClick) return
                      if (s === 'select-type') {
                        setSelectedType(null)
                        setSelectedSlot(null)
                      } else if (s === 'pick-time') {
                        setSelectedSlot(null)
                      }
                      setStep(s)
                    }}
                    disabled={!canClick}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-sans font-bold transition-all ${
                      isCurrent
                        ? 'bg-violet text-white'
                        : isCompleted
                          ? 'bg-violet/20 text-violet hover:bg-violet/30 cursor-pointer'
                          : 'bg-aubergine/10 text-aubergine/30'
                    } ${canClick ? '' : 'cursor-default'}`}
                  >
                    {isCompleted ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i + 1}
                  </button>
                  {i < 2 && <div className={`w-16 h-0.5 rounded-full ${
                    currentIdx > i ? 'bg-violet/30' : 'bg-aubergine/10'
                  }`} />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Enter zip ──────────────────────────────────────────────────── */}
        {step === 'enter-zip' && (
          <div className="max-w-sm mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet/8 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2">
              Check for in-person visits
            </h1>
            <p className="text-sm font-sans text-aubergine/40 mb-8 leading-relaxed">
              Enter your zip code and we'll check if an in-person visit at a Womenkind clinic is available near you.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zipInput}
                onChange={e => { setZipInput(e.target.value.replace(/\D/g, '')); setZipError(null) }}
                onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                placeholder="Zip code"
                className="flex-1 px-4 py-3 text-sm font-sans text-aubergine bg-white border border-aubergine/15 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-2 focus:ring-violet/10 placeholder:text-aubergine/25 transition text-center tracking-widest"
              />
              <button
                onClick={handleGeocode}
                disabled={geocoding || zipInput.length !== 5}
                className="px-5 py-3 bg-violet text-white text-sm font-sans font-semibold rounded-brand hover:bg-violet/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {geocoding ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Check'}
              </button>
            </div>
            {zipError && (
              <p className="text-xs font-sans text-red-500 mt-2">{zipError}</p>
            )}
            <button
              onClick={() => setStep('select-type')}
              className="mt-5 text-xs font-sans text-aubergine/35 hover:text-aubergine/60 transition-colors underline underline-offset-2"
            >
              Skip — I only want a video visit
            </button>
          </div>
        )}

        {/* ── Visit type selector ─────────────────────────────────────────── */}
        {step === 'visit-type' && nearbyClinic && (
          <div>
            <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2 text-center">
              How would you like to meet?
            </h1>
            <p className="text-sm font-sans text-aubergine/40 mb-11 text-center">
              A Womenkind clinic is near you. Choose whichever works best.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              {/* Video visit card */}
              <button
                onClick={() => setStep('select-type')}
                className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 text-left hover:border-violet/30 hover:shadow-lg hover:shadow-violet/5 transition-all group border border-aubergine/15"
              >
                <div className="flex items-center justify-end mb-3">
                  <span className="text-xs font-sans text-aubergine/40 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Video
                  </span>
                </div>
                <h3 className="text-base font-sans font-semibold text-aubergine mb-1.5 group-hover:text-violet transition-colors">
                  Video Visit
                </h3>
                <p className="text-xs font-sans text-aubergine/50 mb-4 line-clamp-2">
                  Meet with Dr. Urban from home. Choose your appointment type and book a time that works for you.
                </p>
                <div className="mt-auto">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet/8 border border-violet/15 rounded-pill text-xs font-sans font-medium text-violet">
                    Book instantly
                  </span>
                </div>
              </button>

              {/* In-person visit card */}
              <button
                onClick={() => setStep('inperson-form')}
                className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 text-left hover:border-violet/30 hover:shadow-lg hover:shadow-violet/5 transition-all group border border-aubergine/15"
              >
                <div className="flex items-center justify-end mb-3">
                  <span className="text-xs font-sans text-aubergine/40 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {nearbyClinic.distance_miles < 1
                      ? '< 1 mile'
                      : `${Math.round(nearbyClinic.distance_miles)} miles`}
                  </span>
                </div>
                <h3 className="text-base font-sans font-semibold text-aubergine mb-1.5 group-hover:text-violet transition-colors">
                  In Person Visit
                </h3>
                <p className="text-xs font-sans text-aubergine/50 mb-1">
                  We&apos;ll confirm a time within 24 hours.
                </p>
                <p className="text-xs font-sans text-aubergine/35 mb-4">
                  Address: {nearbyClinic.name}, {nearbyClinic.address}, {nearbyClinic.city}, {nearbyClinic.state} {nearbyClinic.zip}
                </p>
                <div className="mt-auto">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-pill text-xs font-sans font-medium text-emerald-600">
                    Request appointment
                  </span>
                </div>
              </button>

            </div>
          </div>
        )}

        {/* ── In-person request form ──────────────────────────────────────── */}
        {step === 'inperson-form' && nearbyClinic && (
          <InPersonRequestForm
            patientId={patientId}
            clinic={nearbyClinic}
            onSuccess={() => setStep('inperson-success')}
            onBack={() => setStep('visit-type')}
          />
        )}

        {/* ── In-person success ───────────────────────────────────────────── */}
        {step === 'inperson-success' && (
          <div className="text-center py-12 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2">
              Request received
            </h1>
            <p className="text-sm font-sans text-aubergine/50 leading-relaxed mb-8">
              We'll reach out within 24 hours to confirm your in-person appointment at{' '}
              {nearbyClinic?.name || 'the clinic'}.
            </p>
            <button
              onClick={() => router.push('/patient/dashboard')}
              className="px-6 py-2.5 text-sm font-sans font-semibold text-white bg-violet rounded-pill hover:bg-violet/90 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {/* ── Video booking flow ──────────────────────────────────────────── */}
        {/* Step content */}
        {step === 'select-type' && (
          <div>
            <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2 text-center">Book an Appointment</h1>
            <p className="text-sm font-sans text-aubergine/40 mb-11 text-center">Select the type of appointment you&apos;d like to schedule with Dr. Urban.</p>
            <AppointmentTypeSelector
              providerId={providerId}
              isMember={isMember}
              onSelect={handleSelectType}
            />
          </div>
        )}

        {step === 'pick-time' && selectedType && (
          <div>
            <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2 text-center">Choose a Time</h1>
            <p className="text-sm font-sans text-aubergine/40 mb-6 text-center">
              Select a date and time for your {selectedType.name.toLowerCase()} ({selectedType.duration_minutes} min).
            </p>
            <TimeSlotPicker
              providerId={providerId}
              appointmentTypeId={selectedType.id}
              durationMinutes={selectedType.duration_minutes}
              onSelect={handleSelectSlot}
            />
          </div>
        )}

        {step === 'confirm' && selectedType && selectedSlot && (
          <BookingConfirmation
            appointmentType={selectedType}
            slot={selectedSlot}
            isMember={isMember}
            patientNotes={patientNotes}
            onNotesChange={setPatientNotes}
            onBook={handleBook}
            booking={booking}
          />
        )}

        {step === 'success' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-serif font-normal text-2xl md:text-3xl text-aubergine mb-2">Appointment Confirmed</h1>
            <p className="text-sm font-sans text-aubergine/40 mb-6">
              You&apos;re all set! We&apos;ll send you a reminder before your appointment.
            </p>

            {bookedAppointment && (
              <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 max-w-sm mx-auto mb-6">
                <p className="text-sm font-sans font-semibold text-aubergine mb-1">
                  {bookedAppointment.appointment_types?.name || 'Appointment'}
                </p>
                <p className="text-sm font-sans text-aubergine/60">
                  {new Date(bookedAppointment.starts_at).toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </p>
                <p className="text-sm font-sans text-violet font-medium">
                  {new Date(bookedAppointment.starts_at).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true
                  })}
                  {' – '}
                  {new Date(bookedAppointment.ends_at).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true
                  })}
                </p>
                <p className="text-xs font-sans text-aubergine/40 mt-2">with Dr. Joseph Urban Jr.</p>

                {/* Add to Calendar */}
                <div className="flex items-center justify-center gap-3 mt-5 pt-4 border-t border-aubergine/5">
                  <a
                    href={`/api/scheduling/calendar-export?appointmentId=${bookedAppointment.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-aubergine/60 bg-human/80 border border-aubergine/10 rounded-pill hover:border-violet/30 hover:text-violet transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Apple / Outlook
                  </a>
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent((bookedAppointment.appointment_types?.name || 'Appointment') + ' — Womenkind')}&dates=${new Date(bookedAppointment.starts_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${new Date(bookedAppointment.ends_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}&details=${encodeURIComponent('Appointment with Dr. Joseph Urban Jr.' + (bookedAppointment.video_room_url ? '\n\nJoin video call: ' + bookedAppointment.video_room_url : ''))}&location=${encodeURIComponent('Virtual (video call)')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-aubergine/60 bg-human/80 border border-aubergine/10 rounded-pill hover:border-violet/30 hover:text-violet transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Google Calendar
                  </a>
                </div>
              </div>
            )}

            {bookedAppointment?.status !== 'canceled' ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => router.push('/patient/dashboard')}
                  className="px-6 py-2.5 text-sm font-sans font-medium text-white bg-violet rounded-pill hover:bg-violet/90 transition-colors"
                >
                  Return to Dashboard
                </button>
                {!cancelConfirm ? (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="text-xs font-sans text-aubergine/40 hover:text-red-500 transition-colors underline underline-offset-2"
                  >
                    Cancel this appointment
                  </button>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-sans text-aubergine/50">Are you sure?</span>
                    <button
                      onClick={handleCancelAppointment}
                      disabled={canceling}
                      className="px-3 py-1.5 text-xs font-sans font-semibold text-white bg-red-500 rounded-pill hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {canceling ? 'Canceling…' : 'Yes, cancel'}
                    </button>
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="px-3 py-1.5 text-xs font-sans font-semibold text-aubergine/50 bg-aubergine/5 border border-aubergine/10 rounded-pill hover:bg-aubergine/10 transition-colors"
                    >
                      Keep it
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-sans text-aubergine/50">Your appointment has been canceled.</p>
                <button
                  onClick={() => { setStep('select-type'); setBookedAppointment(null); setCancelConfirm(false) }}
                  className="px-6 py-2.5 text-sm font-sans font-medium text-white bg-violet rounded-pill hover:bg-violet/90 transition-colors"
                >
                  Book a New Appointment
                </button>
              </div>
            )}
          </div>
        )}

        {/* Canceled message */}
        {canceled && step === 'select-type' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm font-sans text-amber-700">
            Payment was canceled. You can try booking again when you&apos;re ready.
          </div>
        )}
      </div>
    </div>
  )
}
