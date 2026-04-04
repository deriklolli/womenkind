'use client'

import { useState, useEffect } from 'react'

interface AppointmentType {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  color: string
  is_active: boolean
  sort_order: number
}

interface Props {
  providerId: string
}

const COLORS = ['#944fed', '#4ECDC4', '#d85623', '#FF6B6B', '#45B7D1', '#96CEB4']
const DURATIONS = [15, 30, 45, 60, 90]

export default function AppointmentTypesManager({ providerId }: Props) {
  const [types, setTypes] = useState<AppointmentType[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<AppointmentType> | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTypes()
  }, [providerId])

  const fetchTypes = async () => {
    try {
      const res = await fetch(`/api/scheduling/appointment-types?providerId=${providerId}`)
      const data = await res.json()
      setTypes(data.appointmentTypes || [])
    } catch (err) {
      console.error('Failed to fetch appointment types:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!editing?.name || !editing?.duration_minutes) return
    setSaving(true)
    try {
      const res = await fetch('/api/scheduling/appointment-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id || undefined,
          providerId,
          name: editing.name,
          description: editing.description,
          durationMinutes: editing.duration_minutes,
          priceCents: editing.price_cents ?? 0,
          color: editing.color || '#944fed',
          sortOrder: editing.sort_order ?? types.length,
        }),
      })
      if (res.ok) {
        setEditing(null)
        fetchTypes()
      }
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Included with membership'
    return `$${(cents / 100).toFixed(0)}`
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
      {/* Type cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {types.map(type => (
          <div
            key={type.id}
            className="bg-white rounded-card border border-transparent hover:border-violet/10 p-5 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: type.color }}
                />
                <h3 className="font-sans font-semibold text-aubergine text-sm">{type.name}</h3>
              </div>
              <button
                onClick={() => setEditing(type)}
                className="text-xs font-sans text-aubergine/40 hover:text-violet transition-colors"
              >
                Edit
              </button>
            </div>
            {type.description && (
              <p className="text-xs font-sans text-aubergine/50 mb-3 line-clamp-2">{type.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs font-sans">
              <span className="flex items-center gap-1 text-aubergine/60">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {type.duration_minutes} min
              </span>
              <span className="flex items-center gap-1 text-aubergine/60">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatPrice(type.price_cents)}
              </span>
            </div>
          </div>
        ))}

        {/* Add new card */}
        <button
          onClick={() => setEditing({ name: '', duration_minutes: 30, price_cents: 0, color: '#944fed', description: '' })}
          className="bg-white/50 border-2 border-dashed border-aubergine/15 rounded-card p-5 flex flex-col items-center justify-center gap-2 hover:border-violet/40 hover:bg-violet/5 transition-all min-h-[140px]"
        >
          <svg className="w-8 h-8 text-aubergine/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-sm font-sans font-medium text-aubergine/40">Add Appointment Type</span>
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-aubergine/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-card shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-sans font-bold text-aubergine mb-5">
              {editing.id ? 'Edit' : 'New'} Appointment Type
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Name</label>
                <input
                  type="text"
                  value={editing.name || ''}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g., Initial Consultation"
                  className="w-full px-3 py-2 text-sm font-sans border border-aubergine/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet text-aubergine"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Description</label>
                <textarea
                  value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Brief description of what this appointment covers..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm font-sans border border-aubergine/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet text-aubergine resize-none"
                />
              </div>

              {/* Duration + Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Duration</label>
                  <select
                    value={editing.duration_minutes || 30}
                    onChange={e => setEditing({ ...editing, duration_minutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-sans border border-aubergine/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet text-aubergine bg-white"
                  >
                    {DURATIONS.map(d => (
                      <option key={d} value={d}>{d} minutes</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Price (non-members)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-aubergine/40">$</span>
                    <input
                      type="number"
                      value={(editing.price_cents || 0) / 100}
                      onChange={e => setEditing({ ...editing, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full pl-7 pr-3 py-2 text-sm font-sans border border-aubergine/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet text-aubergine"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-sans font-medium text-aubergine/60 mb-1">Color</label>
                <div className="flex gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditing({ ...editing, color })}
                      className={`w-8 h-8 rounded-full transition-all ${
                        editing.color === color ? 'ring-2 ring-offset-2 ring-violet scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 px-4 py-2.5 text-sm font-sans font-medium text-aubergine/60 bg-aubergine/5 rounded-xl hover:bg-aubergine/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.name}
                className="flex-1 px-4 py-2.5 text-sm font-sans font-medium text-white bg-violet rounded-xl hover:bg-violet/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing.id ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
