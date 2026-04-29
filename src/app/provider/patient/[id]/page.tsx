'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import ProviderNav from '@/components/provider/ProviderNav'
import PatientOverview from '@/components/provider/PatientOverview'
import VisitTimeline from '@/components/provider/VisitTimeline'
import PrescriptionsPanel from '@/components/provider/PrescriptionsPanel'
import LabOrdersPanel from '@/components/provider/LabOrdersPanel'
import NotesPanel from '@/components/provider/NotesPanel'
import PatientMessagesPanel from '@/components/provider/PatientMessagesPanel'
import PatientBiometrics from '@/components/provider/PatientBiometrics'
import { useChatContext } from '@/lib/chat-context'
import { useRecording } from '@/lib/recording-context'
import { getProviderSession } from '@/lib/getProviderSession'
import { devFixtures } from '@/lib/dev-fixtures'
import ClinicalBriefView from '@/components/provider/ClinicalBriefView'
import ChatWidget from '@/components/provider/ChatWidget'

interface PatientProfile {
  id: string
  profile_id: string
  date_of_birth: string | null
  phone: string | null
  state: string | null
  profiles: {
    first_name: string | null
    last_name: string | null
    email: string | null
  }
}

interface Intake {
  id: string
  status: string
  answers: Record<string, any>
  ai_brief: any
  wmi_scores?: any
  provider_notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
}

interface Visit {
  id: string
  intake_id: string | null
  visit_type: string
  visit_date: string
  symptom_scores: Record<string, number>
  provider_notes: string | null
  treatment_updates: string | null
}

interface Subscription {
  id: string
  status: string
  plan_type: string
  current_period_end: string | null
}

interface Prescription {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  quantity_dispensed: number | null
  refills: number
  status: string
  prescribed_at: string | null
  created_at: string
}

interface LabOrder {
  id: string
  lab_partner: string
  tests: { code: string; name: string }[]
  clinical_indication: string
  status: string
  results: any | null
  ordered_at: string | null
  created_at: string
}

interface ProviderNote {
  id: string
  content: string
  note_type: string
  created_at: string
  updated_at: string
}

type ProfileTab = 'overview' | 'intake' | 'timeline' | 'prescriptions' | 'labs' | 'notes' | 'messages' | 'biometrics'


export default function PatientProfilePage() {
  const router = useRouter()
  const params = useParams()
  const patientId = params.id as string

  const [patient, setPatient] = useState<PatientProfile | null>(null)
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [providerVisits, setProviderVisits] = useState<Visit[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [labOrders, setLabOrders] = useState<LabOrder[]>([])
  const [providerNotes, setProviderNotes] = useState<ProviderNote[]>([])
  const [messageThreadCount, setMessageThreadCount] = useState(0)
  const [encounterNotesCount, setEncounterNotesCount] = useState(0)
  const [latestEncounterNote, setLatestEncounterNote] = useState<{ assessment: string | null; plan: string | null } | null>(null)
  const [liveWmi, setLiveWmi] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as ProfileTab) || 'overview'
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab)
  const [providerId, setProviderId] = useState<string>('')
  const [notesRefreshing, setNotesRefreshing] = useState(false)

  const { setPageContext, pageContext } = useChatContext()
  const { state: recordingState, startRecording, stopRecording } = useRecording()

  useEffect(() => {
    resolveProviderId()
  }, [])

  // When a recording finishes uploading, re-fetch the encounter notes count
  useEffect(() => {
    if (recordingState === 'uploading') {
      setNotesRefreshing(true)
    }
    if (recordingState === 'done') {
      fetch(`/api/provider/patients/${patientId}`)
        .then((r) => r.json())
        .then((data) => {
          setEncounterNotesCount(data.encounterNotesCount ?? 0)
          setNotesRefreshing(false)
        })
        .catch(() => setNotesRefreshing(false))
    }
  }, [recordingState, patientId])

  useEffect(() => {
    loadPatientData()
  }, [patientId])

  const resolveProviderId = async () => {
    const session = await getProviderSession()
    if (session?.providerId) setProviderId(session.providerId)
  }

  const loadPatientData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/provider/patients/${patientId}`)
      if (!res.ok) throw new Error(`Failed to load patient: ${res.status}`)
      const data = await res.json()

      const patientData = data.patient as PatientProfile
      setPatient(patientData)
      setIntakes(data.intakes || [])
      setVisits(data.visits || [])
      setProviderVisits(data.providerVisits || data.visits || [])
      setSubscriptions(data.subscriptions || [])
      setPrescriptions(data.prescriptions || [])
      setLabOrders(data.labOrders || [])
      setProviderNotes(data.providerNotes || [])
      setEncounterNotesCount(data.encounterNotesCount ?? 0)
      setLatestEncounterNote(data.latestEncounterNote ?? null)
      setLiveWmi(data.liveWmi ?? null)

      // Fetch message thread count
      try {
        const msgRes = await fetch(`/api/messages?patientId=${patientId}`)
        const msgData = await msgRes.json()
        setMessageThreadCount((msgData.threads || []).length)
      } catch {}

      // Set chat context for AI assistant
      const latestIntake = (data.intakes || [])[0]
      setPageContext({
        page: 'patient-profile',
        patientId,
        patientName: `${patientData.profiles?.first_name || ''} ${patientData.profiles?.last_name || ''}`.trim(),
        intakeId: latestIntake?.id,
        intakeStatus: latestIntake?.status,
      })
    } catch (err) {
      if (process.env.NODE_ENV === 'development' && devFixtures.patientProfile[patientId]) {
        const fx = devFixtures.patientProfile[patientId]
        setPatient(fx.patient as PatientProfile)
        setIntakes(fx.intakes as Intake[])
        setVisits(fx.visits as Visit[])
        setSubscriptions(fx.subscriptions as Subscription[])
        setPrescriptions(fx.prescriptions as Prescription[])
        setLabOrders(fx.labOrders as LabOrder[])
        setProviderNotes(fx.providerNotes as ProviderNote[])
        setEncounterNotesCount(fx.encounterNotesCount ?? 0)
        setLatestEncounterNote(fx.latestEncounterNote ?? null)
        const latestIntake = (fx.intakes || [])[0]
        setPageContext({
          page: 'patient-profile',
          patientId,
          patientName: `${fx.patient.profiles?.first_name || ''} ${fx.patient.profiles?.last_name || ''}`.trim(),
          intakeId: latestIntake?.id,
          intakeStatus: latestIntake?.status,
        })
      } else {
        console.error('Failed to load patient:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const reloadPrescriptions = async () => {
    const res = await fetch(`/api/provider/patients/${patientId}`)
    if (res.ok) {
      const data = await res.json()
      setPrescriptions(data.prescriptions || [])
    }
  }

  const reloadProviderNotes = async () => {
    const res = await fetch(`/api/provider/patients/${patientId}`)
    if (res.ok) {
      const data = await res.json()
      setProviderNotes(data.providerNotes || [])
    }
  }

  const reloadLabOrders = async () => {
    const res = await fetch(`/api/provider/patients/${patientId}`)
    if (res.ok) {
      const data = await res.json()
      setLabOrders(data.labOrders || [])
    }
  }

  const getAge = () => {
    if (!patient?.date_of_birth) return null
    const birth = new Date(patient.date_of_birth)
    const now = new Date()
    return Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  }

  const getLatestIntake = () => intakes[0] || null
  const getMenopausalStage = () => getLatestIntake()?.ai_brief?.metadata?.menopausal_stage || null
  const getSymptomBurden = () => getLatestIntake()?.ai_brief?.metadata?.symptom_burden || null

  const getActiveMembership = () =>
    subscriptions.find((s) => s.plan_type === 'membership' && s.status === 'active')

  const getCurrentTreatment = () => {
    const latestVisitWithTreatment = visits.find((v) => v.treatment_updates)
    if (latestVisitWithTreatment) return latestVisitWithTreatment.treatment_updates
    const brief = getLatestIntake()?.ai_brief
    if (brief?.treatment_pathway?.recommended_approach) {
      return brief.treatment_pathway.recommended_approach
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <ProviderNav />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-cream">
        <ProviderNav />
        <div className="text-center py-32">
          <p className="font-sans font-semibold text-xl text-aubergine/30">Patient not found</p>
          <button onClick={() => router.push('/provider/dashboard')} className="text-sm font-sans text-violet mt-4 hover:text-violet-dark">
            ← Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  const name = `${patient.profiles?.first_name || ''} ${patient.profiles?.last_name || ''}`.trim()
  const age = getAge()
  const stage = getMenopausalStage()
  const burden = getSymptomBurden()
  const membership = getActiveMembership()
  const treatment = getCurrentTreatment()
  const latestIntake = getLatestIntake()

  // Biometrics from intake answers
  const intakeAnswers = latestIntake?.answers || {}
  const heightStr: string = intakeAnswers.height || ''
  const weightStr: string = String(intakeAnswers.weight || '')
  const hMatch = heightStr.match(/(\d+)'(\d+)"/)
  const heightInches = hMatch ? parseInt(hMatch[1]) * 12 + parseInt(hMatch[2]) : null
  const weightLbs = parseFloat(weightStr.replace(/[^\d.]/g, '')) || null
  const bmi = heightInches && weightLbs
    ? ((weightLbs / (heightInches * heightInches)) * 703).toFixed(1)
    : null

  const TABS: { key: ProfileTab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview & Trends' },
    { key: 'intake', label: 'Intake' },
    { key: 'biometrics', label: 'Biometrics' },
    { key: 'prescriptions', label: 'Prescriptions', count: prescriptions.length },
    { key: 'labs', label: 'Labs', count: labOrders.length },
    { key: 'timeline', label: 'Visit Timeline', count: providerVisits.length },
    { key: 'notes', label: 'Notes', count: providerNotes.length + providerVisits.filter(v => v.provider_notes).length + encounterNotesCount },
    { key: 'messages', label: 'Messages', count: messageThreadCount },
  ]

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Freestanding patient name header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif font-normal text-4xl text-aubergine">{name || 'Unknown Patient'}</h1>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-2 text-sm font-sans text-aubergine/50">
                {age && <span className="whitespace-nowrap">{age} years old</span>}
                {patient.state && (
                  <>
                    <span className="text-aubergine/20">·</span>
                    <span>{patient.state}</span>
                  </>
                )}
              </div>
              {membership && (
                <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600 text-xs font-sans font-medium px-2.5 py-0.5 rounded-pill">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Member
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                const session = await getProviderSession()
                if (!session?.providerId) return
                startRecording(
                  { id: patientId, name },
                  session.providerId
                )
              }}
              disabled={recordingState === 'recording' || recordingState === 'uploading'}
              className={`whitespace-nowrap text-sm font-sans font-medium px-4 py-2.5 rounded-pill border transition-colors flex items-center gap-2
                ${recordingState === 'recording'
                  ? 'text-red-600 bg-red-50 border-red-200'
                  : 'text-aubergine/60 bg-white border-aubergine/15 hover:bg-aubergine/5 hover:text-aubergine'
                } disabled:opacity-50`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              {recordingState === 'recording' ? 'Recording…' : 'Record Visit'}
            </button>
            <button
              onClick={() => router.push(`/provider/presentation/create/${patientId}`)}
              className="whitespace-nowrap text-sm font-sans font-medium text-violet bg-white border border-violet/30 px-5 py-2.5 rounded-pill hover:bg-violet/5 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Care Presentation
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mb-8">
          <div className="flex gap-1 bg-white rounded-brand p-1 shadow-sm w-full">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2.5 rounded-brand text-sm font-sans font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-aubergine text-white shadow-sm'
                  : 'text-aubergine/50 hover:text-aubergine hover:bg-aubergine/5'
              }`}
            >
              {tab.label}
              {tab.key === 'notes' && notesRefreshing && (
                <span className="ml-1.5 inline-block">
                  <svg className={`w-3 h-3 animate-spin ${activeTab === tab.key ? 'text-white/60' : 'text-aubergine/30'}`} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </span>
              )}
            </button>
          ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <PatientOverview
            view="provider"
            visits={visits}
            prescriptions={prescriptions}
            latestIntake={latestIntake}
            liveWmi={liveWmi}
          />
        )}

        {activeTab === 'biometrics' && (
          <PatientBiometrics
            patientId={patientId}
            visits={visits}
            prescriptions={prescriptions}
          />
        )}

        {activeTab === 'intake' && (
          latestIntake ? (
            <ClinicalBriefView intakeId={latestIntake.id} showHeader={false} />
          ) : (
            <div className="text-center py-20 bg-white rounded-card shadow-sm">
              <p className="text-lg font-sans font-semibold text-aubergine/30">No intake submitted yet</p>
              <p className="text-sm font-sans text-aubergine/20 mt-2">An intake form will appear here once the patient completes one</p>
            </div>
          )
        )}

        {activeTab === 'timeline' && (
          <VisitTimeline
            visits={providerVisits}
            onViewBrief={() => setActiveTab('intake')}
          />
        )}

        {activeTab === 'prescriptions' && (
          <PrescriptionsPanel
            patientId={patientId}
            providerId={providerId}
            prescriptions={prescriptions}
            onPrescriptionSent={reloadPrescriptions}
          />
        )}

        {activeTab === 'labs' && (
          <LabOrdersPanel
            patientId={patientId}
            providerId={providerId}
            labOrders={labOrders}
            onLabOrderSent={reloadLabOrders}
          />
        )}

        {activeTab === 'notes' && (
          <NotesPanel
            patientId={patientId}
            providerId={providerId}
            visits={providerVisits}
            providerNotes={providerNotes}
            onNoteAdded={reloadProviderNotes}
          />
        )}

        {activeTab === 'messages' && (
          <PatientMessagesPanel
            patientId={patientId}
            providerId={providerId}
            patientName={name || 'Patient'}
          />
        )}

      </div>

      <ChatWidget context={pageContext} key={patientId} />
    </div>
  )
}
