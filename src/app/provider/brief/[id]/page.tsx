'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ProviderNav from '@/components/provider/ProviderNav'
import { useChatContext } from '@/lib/chat-context'

type Tab = 'symptoms' | 'risks' | 'treatment' | 'questions'

interface Intake {
  id: string
  status: string
  answers: Record<string, any>
  ai_brief: any
  provider_notes: string | null
  submitted_at: string
  reviewed_at: string | null
}

export default function BriefViewerPage() {
  const router = useRouter()
  const params = useParams()
  const intakeId = params.id as string

  const [intake, setIntake] = useState<Intake | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('symptoms')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const { setPageContext } = useChatContext()

  useEffect(() => {
    loadIntake()
  }, [intakeId])

  const loadIntake = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/provider/intakes/${intakeId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { intake: data, isMember: member } = await res.json()

      setIntake(data)
      setNotes(data.provider_notes || '')
      setIsMember(member)

      setPageContext({
        page: 'brief',
        patientId: data.patient_id,
        patientName: data.answers?.full_name || 'Unknown Patient',
        intakeId: data.id,
        intakeStatus: data.status,
      })

      if (data.status === 'submitted') {
        await fetch(`/api/provider/intakes/${intakeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'reviewed' }),
        })
      }
    } catch (err) {
      console.error('Failed to load intake:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveNotes = useCallback(async () => {
    if (!intake) return
    setSaving(true)
    try {
      await fetch(`/api/provider/intakes/${intake.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_notes: notes }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save notes:', err)
    } finally {
      setSaving(false)
    }
  }, [intake, notes])

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (!intake) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="font-sans font-semibold text-xl text-aubergine/40">Brief not found</p>
          <button onClick={() => router.push('/provider/dashboard')} className="text-sm text-violet mt-4 font-sans">
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!intake.ai_brief) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="font-sans font-semibold text-xl text-aubergine/40">Brief not yet generated</p>
          <p className="text-sm text-aubergine/40 font-sans">The intake was submitted but the AI brief failed to generate.</p>
          <button
            onClick={async () => {
              setLoading(true)
              await fetch('/api/intake/regenerate-brief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intakeId }),
              })
              await loadIntake()
            }}
            className="px-6 py-2.5 rounded-full bg-violet text-white text-sm font-sans font-semibold hover:bg-violet/90 transition-colors"
          >
            Generate Brief Now
          </button>
          <div>
            <button onClick={() => router.push('/provider/dashboard')} className="text-sm text-violet font-sans">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const brief = intake.ai_brief
  const answers = intake.answers || {}
  const age = answers.dob
    ? Math.floor((Date.now() - new Date(answers.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'symptoms', label: 'Symptoms', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'risks', label: 'Risk Flags', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
    { key: 'treatment', label: 'Treatment', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { key: 'questions', label: 'Questions', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Patient header */}
        <div className="bg-white rounded-card shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-sans font-semibold text-2xl text-aubergine">{answers.full_name || 'Unknown Patient'}</h1>
                {isMember && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-xs font-sans text-aubergine/50 font-medium">Member</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm font-sans text-aubergine/50">
                {age && <span>{age} years old</span>}
                {answers.height && <span>{answers.height}</span>}
                {answers.weight && <span>{answers.weight}</span>}
                {answers.height && answers.weight && (() => {
                  const hMatch = String(answers.height).match(/(\d+)'(\d+)/)
                  if (!hMatch) return null
                  const inches = parseInt(hMatch[1]) * 12 + parseInt(hMatch[2])
                  const lbs = parseFloat(String(answers.weight).replace(/[^\d.]/g, ''))
                  if (!inches || !lbs) return null
                  const bmi = ((lbs / (inches * inches)) * 703).toFixed(1)
                  return <span>BMI {bmi}</span>
                })()}
              </div>
              {brief.metadata && (
                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-xs font-sans px-2.5 py-1 rounded-pill border
                    ${brief.metadata.symptom_burden === 'severe' ? 'text-red-600 bg-red-50 border-red-200' :
                      brief.metadata.symptom_burden === 'high' ? 'text-orange-600 bg-orange-50 border-orange-200' :
                      'text-amber-600 bg-amber-50 border-amber-200'}`}
                  >
                    {brief.metadata.symptom_burden?.charAt(0).toUpperCase() + brief.metadata.symptom_burden?.slice(1)} Burden
                  </span>
                  <span className="text-xs font-sans px-2.5 py-1 rounded-pill border text-violet bg-violet/5 border-violet/20">
                    {brief.metadata.menopausal_stage?.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                  <span className="text-xs font-sans px-2.5 py-1 rounded-pill border text-aubergine/50 bg-aubergine/5 border-aubergine/10">
                    {brief.metadata.complexity?.charAt(0).toUpperCase() + brief.metadata.complexity?.slice(1)} Complexity
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <button
                onClick={() => router.push(`/provider/presentation/create/${(intake as any).patient_id}`)}
                className="text-sm font-sans font-medium text-violet bg-white px-5 py-2.5 rounded-brand border border-violet/30 hover:bg-violet/5 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Care Presentation
              </button>
            </div>
          </div>

          {/* Overview */}
          {brief.symptom_summary?.overview && (
            <div className="mt-4 pt-4 border-t border-aubergine/5">
              <p className="text-sm font-sans text-aubergine/70 leading-relaxed">
                {brief.symptom_summary.overview}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main content — tabs + brief */}
          <div className="col-span-8">
            {/* Tab bar */}
            <div className="flex gap-1 mb-4 bg-white rounded-brand p-1 shadow-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-brand text-sm font-sans font-medium transition-all
                    ${activeTab === tab.key
                      ? 'bg-aubergine text-white shadow-sm'
                      : 'text-aubergine/40 hover:text-aubergine hover:bg-aubergine/5'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="bg-white rounded-card shadow-sm p-6">
              {activeTab === 'symptoms' && <SymptomsTab brief={brief} />}
              {activeTab === 'risks' && <RiskFlagsTab brief={brief} />}
              {activeTab === 'treatment' && <TreatmentTab brief={brief} />}
              {activeTab === 'questions' && <QuestionsTab brief={brief} />}
            </div>
          </div>

          {/* Sidebar — notes */}
          <div className="col-span-4">
            <div className="bg-white rounded-card shadow-sm p-5 sticky top-6">
              <h3 className="font-sans font-semibold text-base text-aubergine mb-3">Provider Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes, observations, or follow-up items here..."
                rows={12}
                className="w-full p-3 rounded-brand border border-aubergine/10 text-sm font-sans text-aubergine
                           placeholder:text-aubergine/25 resize-none
                           focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                           transition-colors"
              />
              <button
                onClick={saveNotes}
                disabled={saving}
                className="w-full mt-3 py-2.5 rounded-brand font-sans text-sm font-semibold
                           bg-aubergine text-white hover:bg-aubergine-light
                           disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Notes'}
              </button>

              {/* Quick patient info */}
              <div className="mt-6 pt-5 border-t border-aubergine/5">
                <h4 className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wider mb-3">
                  Quick Reference
                </h4>
                <div className="space-y-2 text-xs font-sans text-aubergine/60">
                  {answers.height && answers.weight && (() => {
                    const hMatch = String(answers.height).match(/(\d+)'(\d+)/)
                    if (!hMatch) return null
                    const inches = parseInt(hMatch[1]) * 12 + parseInt(hMatch[2])
                    const lbs = parseFloat(String(answers.weight).replace(/[^\d.]/g, ''))
                    if (!inches || !lbs) return null
                    const bmi = ((lbs / (inches * inches)) * 703).toFixed(1)
                    const num = parseFloat(bmi)
                    const label = num < 18.5 ? 'Underweight' : num < 25 ? 'Normal' : num < 30 ? 'Overweight' : 'Obese'
                    const labelColor = num >= 25 ? 'text-red-600 font-semibold' : 'text-aubergine/30'
                    return <p><span className="text-aubergine/30">BMI:</span> {bmi} <span className={labelColor}>({label})</span></p>
                  })()}
                  {answers.bp_known === 'Yes' && <p><span className="text-aubergine/30">BP:</span> {answers.bp_sys}/{answers.bp_dia}</p>}
                  {answers.smoking && <p><span className="text-aubergine/30">Smoking:</span> {answers.smoking}</p>}
                  {answers.pcp && <p><span className="text-aubergine/30">PCP:</span> {answers.pcp}</p>}
                  {answers.pharmacy && <p><span className="text-aubergine/30">Pharmacy:</span> {answers.pharmacy}</p>}
                  {answers.meds_detail && (
                    <div>
                      <p className="text-aubergine/30 mb-1">Medications:</p>
                      <p className="text-aubergine/50 leading-relaxed">{answers.meds_detail}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs font-sans text-aubergine/20 text-center mt-8 pb-8">
          This is a structured pre-visit summary generated by AI, not a diagnosis. The provider reviews, annotates, and makes all clinical decisions.
        </p>
      </div>
    </div>
  )
}

/* ───── TAB COMPONENTS ───── */

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase()
  let color = 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (s.includes('severe')) color = 'text-red-600 bg-red-50 border-red-200'
  else if (s.includes('moderate')) color = 'text-amber-600 bg-amber-50 border-amber-200'
  else if (s.includes('mild')) color = 'text-green-600 bg-green-50 border-green-200'

  return (
    <span className={`text-xs font-sans px-2 py-0.5 rounded-pill border uppercase ${color}`}>
      {severity}
    </span>
  )
}

function SymptomsTab({ brief }: { brief: any }) {
  const domains = brief.symptom_summary?.domains || []

  return (
    <div>
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">Symptom Summary</h2>
      <div className="space-y-4">
        {domains.map((d: any, i: number) => (
          <div key={i} className="p-4 rounded-brand border border-aubergine/5 bg-cream/50">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-sans font-semibold text-sm text-aubergine">{d.domain}</h3>
              <SeverityBadge severity={d.severity} />
            </div>
            <p className="text-sm font-sans text-aubergine/70 leading-relaxed">{d.findings}</p>
            {d.patient_language && (
              <p className="text-sm font-sans text-violet italic mt-2 pl-3 border-l-2 border-violet/20">
                &ldquo;{d.patient_language}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RiskFlagsTab({ brief }: { brief: any }) {
  const flags = brief.risk_flags || {}

  return (
    <div>
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">Risk Flags</h2>

      {/* Urgent */}
      {flags.urgent && flags.urgent.length > 0 ? (
        <div className="mb-6 p-4 rounded-brand bg-red-50 border border-red-200">
          <h3 className="font-sans font-semibold text-sm text-red-700 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Urgent
          </h3>
          <ul className="space-y-1.5">
            {flags.urgent.map((item: string, i: number) => (
              <li key={i} className="text-sm font-sans text-red-700 leading-relaxed flex gap-2">
                <span className="text-red-400 mt-0.5">&#x2022;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-brand bg-emerald-50 border border-emerald-200">
          <p className="text-sm font-sans text-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            No urgent flags identified
          </p>
        </div>
      )}

      {/* Contraindications */}
      {flags.contraindications && flags.contraindications.length > 0 && (
        <div className="mb-4">
          <h3 className="font-sans font-semibold text-sm text-aubergine mb-2">Contraindications / Monitoring</h3>
          <ul className="space-y-2">
            {flags.contraindications.map((item: string, i: number) => (
              <li key={i} className="text-sm font-sans text-aubergine/70 leading-relaxed flex gap-2 p-3 rounded-brand bg-amber-50/50 border border-amber-100">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">&#x26A0;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Considerations */}
      {flags.considerations && flags.considerations.length > 0 && (
        <div>
          <h3 className="font-sans font-semibold text-sm text-aubergine mb-2 mt-5">Clinical Considerations</h3>
          <ul className="space-y-2">
            {flags.considerations.map((item: string, i: number) => (
              <li key={i} className="text-sm font-sans text-aubergine/60 leading-relaxed flex gap-2 p-3 rounded-brand bg-cream/50 border border-aubergine/5">
                <span className="text-aubergine/30 mt-0.5 flex-shrink-0">&#x2022;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TreatmentTab({ brief }: { brief: any }) {
  const pathway = brief.treatment_pathway || {}

  return (
    <div>
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">Treatment Pathway</h2>

      {/* Recommended approach */}
      {pathway.recommended_approach && (
        <div className="p-4 rounded-brand bg-violet/5 border border-violet/10 mb-6">
          <h3 className="font-sans font-semibold text-sm text-violet mb-2">Recommended Approach</h3>
          <p className="text-sm font-sans text-aubergine/70 leading-relaxed">{pathway.recommended_approach}</p>
        </div>
      )}

      {/* Options */}
      {pathway.options && (
        <div className="space-y-4 mb-6">
          {pathway.options.map((opt: any, i: number) => (
            <div key={i} className="p-4 rounded-brand border border-aubergine/5">
              <h4 className="font-sans font-semibold text-sm text-aubergine mb-2">
                Option {i + 1}: {opt.treatment}
              </h4>
              <div className="space-y-2 text-sm font-sans text-aubergine/60 leading-relaxed">
                <p><span className="font-medium text-aubergine/70">Rationale:</span> {opt.rationale}</p>
                <p><span className="font-medium text-aubergine/70">Considerations:</span> {opt.considerations}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Patient preferences */}
      {pathway.patient_preferences && (
        <div className="p-4 rounded-brand bg-cream border border-aubergine/5">
          <h3 className="font-sans font-semibold text-sm text-aubergine/50 mb-2">Patient Preferences</h3>
          <p className="text-sm font-sans text-aubergine/60 leading-relaxed">{pathway.patient_preferences}</p>
        </div>
      )}
    </div>
  )
}

function QuestionsTab({ brief }: { brief: any }) {
  const questions = brief.suggested_questions || []

  return (
    <div>
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-1">Suggested Questions</h2>
      <p className="text-xs font-sans text-aubergine/40 mb-5">
        Conversation starters based on the intake data — saves time by not re-asking what&apos;s already covered.
      </p>

      <div className="space-y-4">
        {questions.map((q: any, i: number) => (
          <div key={i} className="p-4 rounded-brand border border-aubergine/5">
            <p className="font-sans font-semibold text-sm text-aubergine leading-relaxed mb-2">
              {i + 1}. {q.question}
            </p>
            <p className="text-xs font-sans text-aubergine/40 leading-relaxed pl-4 border-l-2 border-aubergine/10">
              {q.context}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
