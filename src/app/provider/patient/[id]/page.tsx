'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import ProviderNav from '@/components/provider/ProviderNav'
import SymptomTrendChart from '@/components/provider/SymptomTrendChart'
import VisitTimeline from '@/components/provider/VisitTimeline'
import PrescriptionsPanel from '@/components/provider/PrescriptionsPanel'
import LabOrdersPanel from '@/components/provider/LabOrdersPanel'
import NotesPanel from '@/components/provider/NotesPanel'
import { useChatContext } from '@/lib/chat-context'

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
  quantity: number
  refills: number
  pharmacy: string
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
  visit_id: string | null
  title: string | null
  content: string
  note_type: string
  created_at: string
  updated_at: string
}

type ProfileTab = 'overview' | 'intake' | 'timeline' | 'prescriptions' | 'labs' | 'notes'

const SYMPTOM_DOMAINS = [
  { key: 'vasomotor', label: 'Vasomotor (Hot Flashes)', color: '#d85623' },
  { key: 'sleep', label: 'Sleep Quality', color: '#5d9ed5' },
  { key: 'mood', label: 'Mood & Cognition', color: '#944fed' },
  { key: 'gsm', label: 'Genitourinary / GSM', color: '#c2796d' },
  { key: 'overall', label: 'Overall Symptom Burden', color: '#280f49' },
]

export default function PatientProfilePage() {
  const router = useRouter()
  const params = useParams()
  const patientId = params.id as string

  const [patient, setPatient] = useState<PatientProfile | null>(null)
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [labOrders, setLabOrders] = useState<LabOrder[]>([])
  const [providerNotes, setProviderNotes] = useState<ProviderNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')

  // Resolve provider ID from localStorage for demo mode
  const getProviderId = () => {
    if (typeof window === 'undefined') return ''
    try {
      const demo = localStorage.getItem('womenkind_demo_provider')
      if (demo) return JSON.parse(demo).id || ''
    } catch {}
    return ''
  }

  const { setPageContext } = useChatContext()

  useEffect(() => {
    loadPatientData()
  }, [patientId])

  const loadPatientData = async () => {
    setLoading(true)
    try {
      const [patientRes, intakesRes, visitsRes, subsRes, rxRes, labRes, notesRes] = await Promise.all([
        supabase
          .from('patients')
          .select('id, profile_id, date_of_birth, phone, state, profiles ( first_name, last_name, email )')
          .eq('id', patientId)
          .single(),
        supabase
          .from('intakes')
          .select('id, status, answers, ai_brief, provider_notes, submitted_at, reviewed_at')
          .eq('patient_id', patientId)
          .order('submitted_at', { ascending: false }),
        supabase
          .from('visits')
          .select('id, intake_id, visit_type, visit_date, symptom_scores, provider_notes, treatment_updates')
          .eq('patient_id', patientId)
          .order('visit_date', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('id, status, plan_type, current_period_end')
          .eq('patient_id', patientId),
        supabase
          .from('prescriptions')
          .select('id, medication_name, dosage, frequency, quantity, refills, pharmacy, status, prescribed_at, created_at')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('lab_orders')
          .select('id, lab_partner, tests, clinical_indication, status, results, ordered_at, created_at')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('provider_notes')
          .select('id, visit_id, title, content, note_type, created_at, updated_at')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
      ])

      if (patientRes.error) throw patientRes.error
      const patientData = patientRes.data as unknown as PatientProfile
      setPatient(patientData)
      setIntakes(intakesRes.data || [])
      setVisits((visitsRes.data || []) as Visit[])
      setSubscriptions(subsRes.data || [])
      setPrescriptions((rxRes.data || []) as Prescription[])
      setLabOrders((labRes.data || []) as LabOrder[])
      setProviderNotes((notesRes.data || []) as ProviderNote[])

      // Set chat context for AI assistant
      const latestIntake = (intakesRes.data || [])[0]
      setPageContext({
        page: 'patient-profile',
        patientId,
        patientName: `${patientData.profiles?.first_name || ''} ${patientData.profiles?.last_name || ''}`.trim(),
        intakeId: latestIntake?.id,
        intakeStatus: latestIntake?.status,
      })
    } catch (err) {
      console.error('Failed to load patient:', err)
    } finally {
      setLoading(false)
    }
  }

  const reloadPrescriptions = async () => {
    const { data } = await supabase
      .from('prescriptions')
      .select('id, medication_name, dosage, frequency, quantity, refills, pharmacy, status, prescribed_at, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    setPrescriptions((data || []) as Prescription[])
  }

  const reloadProviderNotes = async () => {
    const { data } = await supabase
      .from('provider_notes')
      .select('id, visit_id, title, content, note_type, created_at, updated_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    setProviderNotes((data || []) as ProviderNote[])
  }

  const reloadLabOrders = async () => {
    const { data } = await supabase
      .from('lab_orders')
      .select('id, lab_partner, tests, clinical_indication, status, results, ordered_at, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    setLabOrders((data || []) as LabOrder[])
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
          <p className="font-serif text-xl text-aubergine/30">Patient not found</p>
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

  const TABS: { key: ProfileTab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview & Trends' },
{ key: 'timeline', label: 'Visit Timeline', count: visits.length },
    { key: 'prescriptions', label: 'Prescriptions', count: prescriptions.length },
    { key: 'labs', label: 'Labs', count: labOrders.length },
    { key: 'notes', label: 'Notes', count: providerNotes.length + visits.filter(v => v.provider_notes).length },
  ]

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Patient header card */}
        <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-violet/10 flex items-center justify-center">
                <span className="text-xl font-sans font-semibold text-violet">
                  {(patient.profiles?.first_name?.[0] || '?').toUpperCase()}
                  {(patient.profiles?.last_name?.[0] || '').toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="font-serif text-2xl text-aubergine tracking-tight">{name || 'Unknown Patient'}</h1>
                <div className="flex items-center gap-4 mt-2">
                  {age && <span className="text-sm font-sans text-aubergine/50">{age} years old</span>}
                  {patient.state && <span className="text-sm font-sans text-aubergine/50">{patient.state}</span>}
                  {patient.phone && <span className="text-sm font-sans text-aubergine/50">{patient.phone}</span>}
                  {patient.profiles?.email && (
                    <span className="text-sm font-sans text-aubergine/40">{patient.profiles.email}</span>
                  )}
                </div>
                {latestIntake && (
                  <div className="flex items-center gap-2.5 mt-3">
                    <button
                      onClick={() => router.push(`/provider/brief/${latestIntake.id}`)}
                      className="text-xs font-sans text-violet hover:text-violet-dark transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Clinical Brief
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {stage && (
                <span className="text-xs font-sans text-violet bg-violet/5 px-3 py-1.5 rounded-pill border border-violet/15">
                  {stage}
                </span>
              )}
              {burden && (
                <span className={`text-xs font-sans px-3 py-1.5 rounded-pill border ${
                  burden === 'severe' ? 'text-red-600 bg-red-50 border-red-200' :
                  burden === 'high' ? 'text-orange-600 bg-orange-50 border-orange-200' :
                  burden === 'moderate' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                  'text-emerald-600 bg-emerald-50 border-emerald-200'
                }`}>
                  {burden.charAt(0).toUpperCase() + burden.slice(1)} burden
                </span>
              )}
              {membership ? (
                <span className="text-xs font-sans text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-pill border border-emerald-200">
                  Active Member
                </span>
              ) : (
                <span className="text-xs font-sans text-aubergine/30 bg-aubergine/5 px-3 py-1.5 rounded-pill border border-aubergine/10">
                  No Membership
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-8 bg-white rounded-brand p-1 w-fit shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-brand text-sm font-sans font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-aubergine text-white shadow-sm'
                  : 'text-aubergine/50 hover:text-aubergine hover:bg-aubergine/5'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-white/60' : 'text-aubergine/30'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {treatment && (
              <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5">
                <h3 className="text-sm font-sans font-medium text-aubergine mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Current Treatment
                </h3>
                <p className="text-sm font-sans text-aubergine/70 whitespace-pre-wrap">{treatment}</p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-sans font-medium text-aubergine mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Symptom Trends Over Time
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {SYMPTOM_DOMAINS.map((domain) => (
                  <SymptomTrendChart
                    key={domain.key}
                    visits={visits}
                    domain={domain.key}
                    label={domain.label}
                    color={domain.color}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'intake' && (
          <div className="space-y-4">
            {intakes.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-card shadow-sm">
                <p className="text-lg font-serif text-aubergine/30">No intakes on file</p>
                <p className="text-sm font-sans text-aubergine/20 mt-2">Intakes will appear here once submitted</p>
              </div>
            ) : (
              intakes.map((intake) => {
                const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                  submitted: { label: 'New', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
                  reviewed: { label: 'Reviewed', color: 'text-violet', bg: 'bg-violet/5 border-violet/20' },
                  care_plan_sent: { label: 'Care Plan Sent', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                  draft: { label: 'In Progress', color: 'text-aubergine/40', bg: 'bg-gray-50 border-gray-200' },
                }
                const status = statusConfig[intake.status] || statusConfig.draft
                const burden = intake.ai_brief?.metadata?.symptom_burden
                const riskFlags = intake.ai_brief?.risk_flags
                const urgentCount = riskFlags?.urgent?.length || 0
                const contraCount = riskFlags?.contraindications?.length || 0
                const considerCount = riskFlags?.considerations?.length || 0

                return (
                  <button
                    key={intake.id}
                    onClick={() => router.push(`/provider/brief/${intake.id}`)}
                    className="w-full bg-white rounded-card p-5 shadow-sm hover:shadow-md border border-transparent hover:border-violet/10 transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-serif text-lg text-aubergine group-hover:text-violet transition-colors">
                            Intake
                          </h3>
                          <span className={`text-xs font-sans px-2.5 py-0.5 rounded-pill border ${status.color} ${status.bg}`}>
                            {status.label}
                          </span>
                          {burden && (
                            <span className={`text-xs font-sans px-2.5 py-0.5 rounded-pill ${
                              burden === 'severe' ? 'text-red-600 bg-red-50 border border-red-200' :
                              burden === 'high' ? 'text-orange-600 bg-orange-50 border border-orange-200' :
                              burden === 'moderate' ? 'text-amber-600 bg-amber-50 border border-amber-200' :
                              'text-emerald-600 bg-emerald-50 border border-emerald-200'
                            }`}>
                              {burden.charAt(0).toUpperCase() + burden.slice(1)} burden
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs font-sans text-aubergine/40">
                          <span>
                            Submitted {intake.submitted_at
                              ? new Date(intake.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </span>
                          {(urgentCount + contraCount + considerCount) > 0 && (
                            <span className="flex items-center gap-2">
                              {urgentCount > 0 && <span className="text-red-500">{urgentCount} urgent</span>}
                              {contraCount > 0 && <span className="text-orange-500">{contraCount} contraindications</span>}
                              {considerCount > 0 && <span className="text-amber-500">{considerCount} considerations</span>}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <svg className="w-5 h-5 text-aubergine/20 group-hover:text-violet transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <VisitTimeline
            visits={visits}
            onViewBrief={(intakeId) => router.push(`/provider/brief/${intakeId}`)}
          />
        )}

        {activeTab === 'prescriptions' && (
          <PrescriptionsPanel
            patientId={patientId}
            providerId={getProviderId()}
            prescriptions={prescriptions}
            onPrescriptionSent={reloadPrescriptions}
          />
        )}

        {activeTab === 'labs' && (
          <LabOrdersPanel
            patientId={patientId}
            providerId={getProviderId()}
            labOrders={labOrders}
            onLabOrderSent={reloadLabOrders}
          />
        )}

        {activeTab === 'notes' && (
          <NotesPanel
            patientId={patientId}
            providerId={getProviderId()}
            visits={visits}
            providerNotes={providerNotes}
            onNoteAdded={reloadProviderNotes}
          />
        )}
      </div>
    </div>
  )
}
