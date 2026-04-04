'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-browser'
import AppointmentTypeSelector from '@/components/patient/AppointmentTypeSelector'
import TimeSlotPicker from '@/components/patient/TimeSlotPicker'
import BookingConfirmation from '@/components/patient/BookingConfirmation'

type BookingStep = 'select-type' | 'pick-time' | 'confirm' | 'success'

const DEMO_PROVIDER_ID = 'b0000000-0000-0000-0000-000000000001'
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
  appointment_types: { name: string; duration_minutes: number }
}

export default function PatientSchedulePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<BookingStep>('select-type')
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [patientId, setPatientId] = useState(DEMO_PATIENT_ID)
  const [providerId] = useState(DEMO_PROVIDER_ID)

  // Booking state
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [patientNotes, setPatientNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookedAppointment, setBookedAppointment] = useState<BookedAppointment | null>(null)

  // Check if we're returning from a successful payment
  const bookedId = searchParams.get('booked')
  const canceled = searchParams.get('canceled')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (bookedId) {
      setStep('success')
      // Fetch the booked appointment details
      fetchBookedAppointment(bookedId)
    }
  }, [bookedId])

  const checkAuth = async () => {
    // Demo mode check
    const demo = localStorage.getItem('womenkind_demo_patient')
    if (demo) {
      const demoData = JSON.parse(demo)
      setPatientId(demoData.patientId || DEMO_PATIENT_ID)
      setIsMember(true) // Demo patient Sarah is a member
      setLoading(false)
      return
    }

    // Real auth
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/patient/login')
      return
    }

    // Get patient ID and membership status
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', session.user.id)
      .single()

    if (patient) {
      setPatientId(patient.id)

      const { data: membership } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('patient_id', patient.id)
        .eq('plan_type', 'membership')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      setIsMember(!!membership)
    }
    setLoading(false)
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
      <div className="min-h-screen bg-human flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-human">
      {/* Header */}
      <nav className="bg-aubergine text-white">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/patient/dashboard')} className="flex items-center">
            <Image
              src="/womenkind-logo.png"
              alt="Womenkind"
              width={140}
              height={32}
              className="h-6 w-auto"
              priority
            />
          </button>
          <button
            onClick={() => router.push('/patient/dashboard')}
            className="text-xs font-sans text-white/50 hover:text-white transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Progress bar */}
        {step !== 'success' && (
          <div className="flex items-center gap-2 mb-8">
            {['select-type', 'pick-time', 'confirm'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-sans font-bold transition-all ${
                  step === s
                    ? 'bg-violet text-white'
                    : ['select-type', 'pick-time', 'confirm'].indexOf(step) > i
                      ? 'bg-violet/20 text-violet'
                      : 'bg-aubergine/10 text-aubergine/30'
                }`}>
                  {['select-type', 'pick-time', 'confirm'].indexOf(step) > i ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                {i < 2 && <div className={`w-16 h-0.5 rounded-full ${
                  ['select-type', 'pick-time', 'confirm'].indexOf(step) > i ? 'bg-violet/30' : 'bg-aubergine/10'
                }`} />}
              </div>
            ))}
          </div>
        )}

        {/* Back button */}
        {(step === 'pick-time' || step === 'confirm') && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm font-sans text-aubergine/50 hover:text-aubergine mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {/* Step content */}
        {step === 'select-type' && (
          <div>
            <h1 className="text-2xl font-sans font-bold text-aubergine mb-2">Book an Appointment</h1>
            <p className="text-sm font-sans text-aubergine/50 mb-6">Select the type of appointment you&apos;d like to schedule with Dr. Urban.</p>
            <AppointmentTypeSelector
              providerId={providerId}
              isMember={isMember}
              onSelect={handleSelectType}
            />
          </div>
        )}

        {step === 'pick-time' && selectedType && (
          <div>
            <h1 className="text-2xl font-sans font-bold text-aubergine mb-2">Choose a Time</h1>
            <p className="text-sm font-sans text-aubergine/50 mb-6">
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
            <h1 className="text-2xl font-sans font-bold text-aubergine mb-2">Appointment Confirmed</h1>
            <p className="text-sm font-sans text-aubergine/50 mb-6">
              You&apos;re all set! We&apos;ll send you a reminder before your appointment.
            </p>

            {bookedAppointment && (
              <div className="bg-white rounded-2xl border border-aubergine/10 p-6 max-w-sm mx-auto mb-6">
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
              </div>
            )}

            <button
              onClick={() => router.push('/patient/dashboard')}
              className="px-6 py-2.5 text-sm font-sans font-medium text-white bg-violet rounded-xl hover:bg-violet/90 transition-colors"
            >
              Return to Dashboard
            </button>
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
