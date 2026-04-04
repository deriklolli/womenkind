'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface AvailabilitySlot {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

interface Props {
  providerId: string
}

const DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 20; h++) {
  for (const m of ['00', '30']) {
    const hour = h.toString().padStart(2, '0')
    TIME_OPTIONS.push(`${hour}:${m}`)
  }
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function AvailabilityEditor({ providerId }: Props) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    fetchAvailability()
  }, [providerId])

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_availability')
        .select('*')
        .eq('provider_id', providerId)
        .order('day_of_week')

      if (error) throw error
      setSlots(data || [])
    } catch (err) {
      console.error('Failed to fetch availability:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleDay = async (dayOfWeek: number) => {
    const existing = slots.find(s => s.day_of_week === dayOfWeek)
    setSaving(dayOfWeek)

    try {
      if (existing) {
        // Toggle is_active
        const { error } = await supabase
          .from('provider_availability')
          .update({ is_active: !existing.is_active })
          .eq('id', existing.id)

        if (error) throw error
      } else {
        // Create new slot with default hours
        const { error } = await supabase
          .from('provider_availability')
          .insert({
            provider_id: providerId,
            day_of_week: dayOfWeek,
            start_time: '09:00',
            end_time: '17:00',
            is_active: true,
          })

        if (error) throw error
      }
      fetchAvailability()
    } catch (err) {
      console.error('Failed to toggle day:', err)
    } finally {
      setSaving(null)
    }
  }

  const updateTime = async (slotId: string, field: 'start_time' | 'end_time', value: string) => {
    try {
      const { error } = await supabase
        .from('provider_availability')
        .update({ [field]: value })
        .eq('id', slotId)

      if (error) throw error
      fetchAvailability()
    } catch (err) {
      console.error('Failed to update time:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="bg-white rounded-card border border-aubergine/10 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-aubergine/5">
          <h3 className="text-sm font-sans font-semibold text-aubergine">Weekly Hours</h3>
          <p className="text-xs font-sans text-aubergine/40 mt-0.5">
            Set your recurring weekly availability. Patients can only book during these windows.
          </p>
        </div>

        <div className="divide-y divide-aubergine/5">
          {DAYS.map(day => {
            const slot = slots.find(s => s.day_of_week === day.value)
            const isActive = slot?.is_active ?? false

            return (
              <div key={day.value} className="px-5 py-3.5 flex items-center gap-4">
                {/* Toggle */}
                <button
                  onClick={() => toggleDay(day.value)}
                  disabled={saving === day.value}
                  className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${
                    isActive ? 'bg-violet' : 'bg-aubergine/15'
                  }`}
                  style={{ width: 40, height: 22 }}
                >
                  <div
                    className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${
                      isActive ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                    style={{ width: 18, height: 18, transform: `translateX(${isActive ? 20 : 2}px)` }}
                  />
                </button>

                {/* Day name */}
                <span className={`w-24 text-sm font-sans font-medium ${
                  isActive ? 'text-aubergine' : 'text-aubergine/30'
                }`}>
                  {day.label}
                </span>

                {/* Time range */}
                {isActive && slot ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={slot.start_time?.slice(0, 5)}
                      onChange={e => updateTime(slot.id, 'start_time', e.target.value)}
                      className="px-2 py-1.5 text-xs font-sans border border-aubergine/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet/30 text-aubergine bg-white"
                    >
                      {TIME_OPTIONS.map(t => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </select>
                    <span className="text-xs text-aubergine/30">to</span>
                    <select
                      value={slot.end_time?.slice(0, 5)}
                      onChange={e => updateTime(slot.id, 'end_time', e.target.value)}
                      className="px-2 py-1.5 text-xs font-sans border border-aubergine/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet/30 text-aubergine bg-white"
                    >
                      {TIME_OPTIONS.map(t => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-xs font-sans text-aubergine/25">Unavailable</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Info note */}
      <div className="mt-4 bg-violet/5 border border-violet/15 rounded-card px-4 py-3 flex items-start gap-3">
        <svg className="w-4 h-4 text-violet/60 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs font-sans text-aubergine/60">
          Your Google Calendar is synced — any events on your calendar will automatically block those times from patient booking. You can also block specific dates from the appointment view.
        </p>
      </div>
    </div>
  )
}
