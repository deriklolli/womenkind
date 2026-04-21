'use client'

import { useState, useEffect } from 'react'

interface AppointmentType {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  color: string
}

interface Props {
  providerId: string
  isMember: boolean
  onSelect: (type: AppointmentType) => void
  excludeNames?: string[]
  onlyInitial?: boolean
}

function AppointmentTypeIcon({ name, className }: { name: string; className?: string }) {
  const lower = name.toLowerCase()

  // Initial Consultation — clipboard with a plus (new patient)
  if (lower.includes('initial')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  }

  // Touch Base Call — phone / quick chat
  if (lower.includes('touch') || lower.includes('call')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    )
  }

  // Follow Up Visit — arrow cycling back (returning patient)
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}

export default function AppointmentTypeSelector({ providerId, isMember, onSelect, excludeNames, onlyInitial }: Props) {
  const [types, setTypes] = useState<AppointmentType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await fetch(`/api/scheduling/appointment-types?providerId=${providerId}`)
        const data = await res.json()
        let all: AppointmentType[] = data.appointmentTypes || []
        if (onlyInitial) {
          all = all.filter(t => t.name.toLowerCase().includes('initial'))
        } else if (excludeNames?.length) {
          all = all.filter(t => !excludeNames.some(name => t.name.toLowerCase().includes(name.toLowerCase())))
        }
        setTypes(all)
      } catch (err) {
        console.error('Failed to fetch types:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTypes()
  }, [providerId])

  if (loading) {
    const skeletonCount = excludeNames?.length ? 2 : 3
    return (
      <div className={`grid grid-cols-1 gap-4 ${skeletonCount >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i} className="bg-white rounded-card border border-aubergine/10 shadow-sm shadow-aubergine/5 p-6 animate-pulse">
            <div className="flex justify-between items-start mb-5">
              <div className="w-10 h-10 rounded-brand bg-aubergine/8 shrink-0" />
              <div className="w-14 h-5 rounded-pill bg-aubergine/8" />
            </div>
            <div className="w-2/3 h-4 rounded bg-aubergine/8 mb-2" />
            <div className="w-full h-3 rounded bg-aubergine/6 mb-1" />
            <div className="w-4/5 h-3 rounded bg-aubergine/6 mb-5" />
            <div className="w-36 h-6 rounded-pill bg-aubergine/8" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-1 gap-4 ${types.length >= 3 ? 'md:grid-cols-3' : types.length === 2 ? 'md:grid-cols-2' : ''}`}>
      {types.map(type => (
        <button
          key={type.id}
          onClick={() => onSelect(type)}
          className="bg-white rounded-card border border-aubergine/10 shadow-sm shadow-aubergine/5 p-6 text-left hover:border-violet/30 hover:shadow-lg hover:shadow-violet/5 transition-all duration-200 group flex flex-col"
        >
          {/* Icon + Duration row */}
          <div className="flex items-start justify-between mb-5">
            <div className="w-10 h-10 rounded-brand bg-violet/8 flex items-center justify-center shrink-0">
              <AppointmentTypeIcon
                name={type.name}
                className="w-5 h-5 text-violet/70 group-hover:text-violet transition-colors duration-200"
              />
            </div>
            <span className="flex items-center gap-1 text-xs font-sans text-aubergine/40 mt-0.5">
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {type.duration_minutes} min
            </span>
          </div>

          {/* Name */}
          <h3 className="text-base font-sans font-semibold text-aubergine mb-1.5 group-hover:text-violet transition-colors duration-200">
            {type.name}
          </h3>

          {/* Description */}
          {type.description && (
            <p className="text-xs font-sans text-aubergine/50 leading-relaxed line-clamp-2 mb-4">{type.description}</p>
          )}

          {/* Membership badge — only shown for members */}
          {isMember && (
            <div className="mt-auto pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-pill text-xs font-sans font-medium text-emerald-600">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Included with membership
              </span>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
