'use client'

import { useState, useEffect } from 'react'

interface TimeSlot {
  start: string
  end: string
}

interface Props {
  providerId: string
  appointmentTypeId: string
  durationMinutes: number
  onSelect: (slot: TimeSlot) => void
}

function getWeekdaysFromToday(count: number): { date: string; label: string; dayName: string; isToday: boolean }[] {
  const days = []
  const today = new Date()
  let i = 0

  while (days.length < count) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) {
      days.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: i === 0,
      })
    }
    i++
  }
  return days
}

function formatSlotTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Denver',
  })
}

export default function TimeSlotPicker({ providerId, appointmentTypeId, durationMinutes, onSelect }: Props) {
  const [days] = useState(() => getWeekdaysFromToday(15))
  const [selectedDate, setSelectedDate] = useState(() => getWeekdaysFromToday(15)[0]?.date || '')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const visibleDays = days.slice(weekOffset * 5, weekOffset * 5 + 5)

  useEffect(() => {
    if (!selectedDate) return
    fetchSlots(selectedDate)
  }, [selectedDate, appointmentTypeId])

  const fetchSlots = async (date: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        providerId,
        date,
        appointmentTypeId,
      })
      const res = await fetch(`/api/scheduling/availability?${params}`)
      const data = await res.json()
      setSlots(data.slots || [])
    } catch (err) {
      console.error('Failed to fetch slots:', err)
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  // Group slots into morning / afternoon
  const morningSlots = slots.filter(s => new Date(s.start).getHours() < 12)
  const afternoonSlots = slots.filter(s => new Date(s.start).getHours() >= 12)

  return (
    <div>
      {/* Date selector */}
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
            disabled={weekOffset === 0}
            className="p-1 text-aubergine/40 hover:text-aubergine disabled:opacity-30 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-sans font-medium text-aubergine/50">
            {visibleDays[0]?.label} – {visibleDays[visibleDays.length - 1]?.label}
          </span>
          <button
            onClick={() => setWeekOffset(Math.min(2, weekOffset + 1))}
            disabled={weekOffset >= 2}
            className="p-1 text-aubergine/40 hover:text-aubergine disabled:opacity-30 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {visibleDays.map(day => (
            <button
              key={day.date}
              onClick={() => setSelectedDate(day.date)}
              className={`py-2.5 rounded-xl text-center transition-all ${
                selectedDate === day.date
                  ? 'bg-violet text-white'
                  : 'hover:bg-violet/5 text-aubergine/70'
              }`}
            >
              <p className={`text-[10px] font-sans uppercase ${
                selectedDate === day.date ? 'text-white/70' : 'text-aubergine/35'
              }`}>
                {day.dayName}
              </p>
              <p className={`text-sm font-sans font-semibold ${
                selectedDate === day.date ? 'text-white' : ''
              }`}>
                {day.label.split(' ')[1]}
              </p>
              {day.isToday && (
                <div className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${
                  selectedDate === day.date ? 'bg-white' : 'bg-violet'
                }`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Time slots */}
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-5">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 text-aubergine/15 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-sans text-aubergine/40">No available times on this date</p>
            <p className="text-xs font-sans text-aubergine/25 mt-1">Try selecting a different day</p>
          </div>
        ) : (
          <div className="space-y-5">
            {morningSlots.length > 0 && (
              <div>
                <p className="text-xs font-sans font-medium text-aubergine/40 mb-2 uppercase tracking-wider">Morning</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {morningSlots.map(slot => (
                    <button
                      key={slot.start}
                      onClick={() => onSelect(slot)}
                      className="px-3 py-2.5 text-sm font-sans font-medium text-aubergine border border-aubergine/15 rounded-xl hover:border-violet hover:text-violet hover:bg-violet/5 transition-all"
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {afternoonSlots.length > 0 && (
              <div>
                <p className="text-xs font-sans font-medium text-aubergine/40 mb-2 uppercase tracking-wider">Afternoon</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {afternoonSlots.map(slot => (
                    <button
                      key={slot.start}
                      onClick={() => onSelect(slot)}
                      className="px-3 py-2.5 text-sm font-sans font-medium text-aubergine border border-aubergine/15 rounded-xl hover:border-violet hover:text-violet hover:bg-violet/5 transition-all"
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
