'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProviderNav from '@/components/provider/ProviderNav'
import AppointmentTypesManager from '@/components/provider/AppointmentTypesManager'
import AvailabilityEditor from '@/components/provider/AvailabilityEditor'
import AppointmentsList from '@/components/provider/AppointmentsList'
import { getProviderSession } from '@/lib/getProviderSession'

type ScheduleTab = 'appointments' | 'types' | 'availability'

export default function ProviderSchedulePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ScheduleTab>('appointments')
  const [providerId, setProviderId] = useState<string>('')
  const [providerName, setProviderName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [gcalConnected, setGcalConnected] = useState(false)

  useEffect(() => {
    getProviderSession().then(session => {
      if (!session) {
        router.push('/provider/login')
        return
      }
      setProviderId(session.providerId)
      setProviderName(session.providerName)
      setLoading(false)
    })
  }, [])

  // Check Google Calendar connection status
  useEffect(() => {
    if (!providerId) return
    fetch(`/api/auth/google/status?providerId=${providerId}`)
      .then(res => res.json())
      .then(data => setGcalConnected(data.connected === true))
      .catch(() => setGcalConnected(false))
  }, [providerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <ProviderNav activeTab="schedule" />
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav activeTab="schedule" providerName={providerName} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif font-normal text-2xl text-aubergine tracking-tight">Schedule</h1>
            <p className="text-sm font-sans text-aubergine/50 mt-1">
              Manage appointments, availability, and appointment types
            </p>
          </div>

          {/* Google Calendar badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-pill text-xs font-sans font-medium ${
            gcalConnected
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-amber-50 text-amber-600 border border-amber-200'
          }`}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Google Calendar: {gcalConnected ? 'Connected' : 'Not Connected'}
            {gcalConnected && (
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-brand p-1 w-fit shadow-sm">
          {([
            { key: 'appointments', label: 'Appointments' },
            { key: 'types', label: 'Appointment Types' },
            { key: 'availability', label: 'Availability' },
          ] as { key: ScheduleTab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-brand text-sm font-sans font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-aubergine text-white shadow-sm'
                  : 'text-aubergine/50 hover:text-aubergine hover:bg-aubergine/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'appointments' && (
          <AppointmentsList providerId={providerId} />
        )}
        {activeTab === 'types' && (
          <AppointmentTypesManager providerId={providerId} />
        )}
        {activeTab === 'availability' && (
          <AvailabilityEditor providerId={providerId} />
        )}
      </div>
    </div>
  )
}
