'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import VisitPrepPanel from './VisitPrepPanel'

interface Appointment {
  id: string
  starts_at: string
  ends_at: string
  status: string
  is_paid: boolean
  amount_cents: number
  patient_notes: string | null
  provider_notes: string | null
  video_room_url: string | null
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
    subscriptions?: {
      status: string
      plan_type: string
    }[]
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
  const [visitPrepAptId, setVisitPrepAptId] = useState<string | null>(null)

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

  // Filter out past appointments
  const now = new Date()
  const upcoming = appointments.filter(apt => new Date(apt.ends_at) > now)

  // Group appointments by date
  const grouped = upcoming.reduce((acc, apt) => {
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
      ) : upcoming.length === 0 ? (
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
                  const isMember = apt.patients?.subscriptions?.some(
                    (s) => s.plan_type === 'membership' && s.status === 'active'
                  )

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
                              {isMember && (
                                <span className="px-2 py-0.5 text-[10px] font-sans font-medium rounded-pill border text-emerald-600 bg-emerald-50 border-emerald-200">
                                  Member
                                </span>
                              )}
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
                              onClick={() => setVisitPrepAptId(visitPrepAptId === apt.id ? null : apt.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold rounded-pill transition-colors mr-1 ${
                                visitPrepAptId === apt.id
                                  ? 'text-white bg-violet border border-violet'
                                  : 'text-violet bg-violet/5 border border-violet/15 hover:bg-violet/10'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                              </svg>
                              Visit Prep
                            </button>
                            {apt.video_room_url && (
                              <a
                                href={apt.video_room_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold text-white bg-violet rounded-pill hover:bg-violet/90 transition-colors mr-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                                Join Call
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Inline visit prep brief */}
                      {visitPrepAptId === apt.id && (
                        <VisitPrepPanel
                          appointmentId={apt.id}
                          onClose={() => setVisitPrepAptId(null)}
                        />
                      )}
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
