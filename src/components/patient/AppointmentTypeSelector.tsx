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
    const skeletonCount = onlyInitial ? 1 : excludeNames?.length ? 2 : 3
    return (
      <div className={`grid grid-cols-1 gap-4 ${skeletonCount >= 3 ? 'md:grid-cols-3' : skeletonCount === 2 ? 'md:grid-cols-2' : ''}`}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i} className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 animate-pulse h-44" />
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
          className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 text-left hover:border-violet/30 hover:shadow-lg hover:shadow-violet/5 transition-all group border border-aubergine/15"
        >
          {/* Duration */}
          <div className="flex items-center justify-end mb-3">
            <span className="text-xs font-sans text-aubergine/40 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {type.duration_minutes} min
            </span>
          </div>

          {/* Name */}
          <h3 className="text-base font-sans font-semibold text-aubergine mb-1.5 group-hover:text-violet transition-colors">
            {type.name}
          </h3>

          {/* Description */}
          {type.description && (
            <p className="text-xs font-sans text-aubergine/50 mb-4 line-clamp-2">{type.description}</p>
          )}

          {/* Membership badge — members only, no price shown for non-members */}
          {isMember && (
            <div className="mt-auto">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-pill text-xs font-sans font-medium text-emerald-600">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
