'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Appointment {
  id: string
  starts_at: string
  ends_at: string
  status: string
  is_paid: boolean
  amount_cents: number
  patient_notes: string | null
  provider_notes: string | null
  appointment_types: {
    name: string
    duration_minutes: number
    price_cents: number
    color: string
  }
  patients: {
    id: string
    profiles: {
      first_name: string | null
      last_name: string | null
      email: string | null
    }
  }
}

interface Props {
  providerId: string
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  pending_payment: { label: 'Pending Payment', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  completed: { label: 'Completed', color: 'text-violet', bg: 'bg-violet/5 border-violet/20' },
  canceled: { label: 'Canceled', color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
  no_show: { label: 'No Show', color: 'text-aubergine/40', bg: 'bg-gray-50 border-gray-200' },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const today = new Date()
  return d.toDateString() === today.toDateString()
}

export default function AppointmentsList({ providerId }: Props) {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAppointments()
  }, [providerId])

  const fetchAppointments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ providerId })
      const res = await fetch(`/api/scheduling/appointments?${params}`)
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch (err) {
      console.error('Failed to fetch appointments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkComplete = async (appointmentId: string) => {
    try {
      const res = await fetch('/api/scheduling/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, status: 'completed' }),
      })
      if (res.ok) fetchAppointments()
    } catch (err) {
      console.error('Failed to mark complete:', err)
    }
  }

  const handleCancel = async (appointmentId: string) => {
    try {
      const res = await fetch('/api/scheduling/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      if (res.ok) fetchAppointments()
    } catch (err) {
      console.error('Failed to cancel:', err)
    }
  }

  // Group appointments by date
  const grouped = appointments.reduce((acc, apt) => {
    const dateKey = formatDate(apt.starts_at)
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(apt)
    return acc
  }, {} as Record<string, Appointment[]>)

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-card border border-aubergine/10 p-12 text-center shadow-sm">
          <svg className="w-12 h-12 text-aubergine/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-sans text-aubergine/40">No appointments found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayAppointments]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xs font-sans font-semibold text-aubergine/60 uppercase tracking-wider">
                  {isToday(dayAppointments[0].starts_at) ? 'Today' : date}
                </h3>
                <div className="flex-1 h-px bg-aubergine/8" />
                <span className="text-xs font-sans text-aubergine/30">{dayAppointments.length} appointment{dayAppointments.length > 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-2">
                {dayAppointments.map(apt => {
                  const statusStyle = STATUS_STYLES[apt.status] || STATUS_STYLES.confirmed
                  const patientName = apt.patients?.profiles
                    ? `${apt.patients.profiles.first_name || ''} ${apt.patients.profiles.last_name || ''}`.trim()
                    : 'Patient'

                  return (
                    <div
                      key={apt.id}
                      className="bg-white rounded-card border border-transparent hover:border-violet/10 p-4 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {/* Time block */}
                          <div className="text-center min-w-[56px]">
                            <p className="text-sm font-sans font-bold text-aubergine">{formatTime(apt.starts_at)}</p>
                            <p className="text-[10px] font-sans text-aubergine/30">{formatTime(apt.ends_at)}</p>
                          </div>

                          {/* Color bar */}
                          <div
                            className="w-1 h-12 rounded-full flex-shrink-0"
                            style={{ backgroundColor: apt.appointment_types?.color || '#944fed' }}
                          />

                          {/* Details */}
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/provider/patient/${apt.patients?.id}`)}
                                className="text-sm font-sans font-semibold text-aubergine hover:text-violet transition-colors"
                              >
                                {patientName}
                              </button>
                              <span className={`px-2 py-0.5 text-[10px] font-sans font-medium rounded-pill border ${statusStyle.bg} ${statusStyle.color}`}>
                                {statusStyle.label}
                              </span>
                            </div>
                            <p className="text-xs font-sans text-aubergine/50 mt-0.5">
                              {apt.appointment_types?.name} · {apt.appointment_types?.duration_minutes} min
                            </p>
                            {apt.patient_notes && (
                              <p className="text-xs font-sans text-aubergine/40 mt-1 line-clamp-1 italic">
                                &ldquo;{apt.patient_notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {apt.status === 'confirmed' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMarkComplete(apt.id)}
                              className="p-1.5 text-emerald-500/60 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Mark as completed"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleCancel(apt.id)}
                              className="p-1.5 text-red-400/60 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancel appointment"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
