'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'
import ProviderNav from '@/components/provider/ProviderNav'
import { PRESENTATION_COMPONENTS, type PresentationComponent } from '@/lib/presentation-components'
import { useChatContext } from '@/lib/chat-context'
import { getProviderSession } from '@/lib/getProviderSession'

interface PatientInfo {
  id: string
  profiles: { first_name: string | null; last_name: string | null }
}

interface ComponentNotes {
  [key: string]: {
    provider_note: string
    ai_draft: string
  }
}

export default function CreatePresentationPage() {
  const router = useRouter()
  const params = useParams()
  const patientId = params.patientId as string

  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<ComponentNotes>({})
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [closingMessage, setClosingMessage] = useState('')
  const [activeComponent, setActiveComponent] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [draftingAI, setDraftingAI] = useState<string | null>(null)
  const [providerId, setProviderId] = useState<string>('')
  const [sendError, setSendError] = useState<string | null>(null)

  const { setPageContext } = useChatContext()

  useEffect(() => {
    loadPatient()
    loadProviderId()
  }, [patientId])

  const loadProviderId = async () => {
    const session = await getProviderSession()
    if (session?.providerId) setProviderId(session.providerId)
  }

  const loadPatient = async () => {
    try {
      const { data } = await supabase
        .from('patients')
        .select('id, profiles ( first_name, last_name )')
        .eq('id', patientId)
        .single()
      const patientData = data as unknown as PatientInfo
      setPatient(patientData)

      // Set chat context for AI assistant
      setPageContext({
        page: 'presentation-create',
        patientId,
        patientName: `${patientData.profiles?.first_name || ''} ${patientData.profiles?.last_name || ''}`.trim(),
      })
    } catch (err) {
      console.error('Failed to load patient:', err)
    } finally {
      setLoading(false)
    }
  }

  const patientName = patient
    ? `${patient.profiles?.first_name || ''} ${patient.profiles?.last_name || ''}`.trim()
    : ''

  const firstName = patient?.profiles?.first_name || 'your patient'

  const toggleComponent = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        if (activeComponent === key) setActiveComponent(null)
      } else {
        next.add(key)
        setActiveComponent(key)
        // Initialize notes if not present
        if (!notes[key]) {
          setNotes((n) => ({ ...n, [key]: { provider_note: '', ai_draft: '' } }))
        }
      }
      return next
    })
  }

  const updateNote = (key: string, text: string) => {
    setNotes((prev) => ({
      ...prev,
      [key]: { ...prev[key], provider_note: text },
    }))
  }

  const handleAIDraft = async (key: string) => {
    setDraftingAI(key)
    try {
      const res = await fetch('/api/presentation/ai-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, componentKey: key }),
      })
      const data = await res.json()
      if (data.draft) {
        setNotes((prev) => ({
          ...prev,
          [key]: { ...prev[key], provider_note: data.draft, ai_draft: data.draft },
        }))
      }
    } catch (err) {
      console.error('AI draft failed:', err)
    } finally {
      setDraftingAI(null)
    }
  }

  const handleSend = async () => {
    if (selected.size === 0) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/presentation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          providerId,
          selectedComponents: Array.from(selected),
          componentNotes: notes,
          welcomeMessage: welcomeMessage || `${firstName}, I've put together a personalized summary of what's happening in your body and how we're going to address it together.`,
          closingMessage: closingMessage || `Remember, this is a journey and you're not alone in it. I'm here to guide you every step of the way. — Dr. Urban`,
        }),
      })
      const data = await res.json()
      if (data.id) {
        setSent(true)
        setTimeout(() => {
          router.push(`/provider/patient/${patientId}`)
        }, 2000)
      } else {
        setSendError(data.error || 'Failed to generate presentation. Please try again.')
      }
    } catch (err: any) {
      console.error('Failed to generate presentation:', err)
      setSendError('Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
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

  return (
    <div className="min-h-screen bg-cream">
      <ProviderNav />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.back()}
            className="text-xs font-sans text-aubergine/40 hover:text-aubergine/60 transition-colors mb-4 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Patient Intake
          </button>
          <h1 className="font-sans font-semibold text-2xl text-aubergine tracking-tight">
            Create Care Presentation
          </h1>
          <p className="text-xs font-sans text-violet mt-[15px]">
            Step {step} of 2 — {step === 1 ? 'Body Systems' : 'Message & Send'}
          </p>
          <p className="text-sm font-sans text-aubergine/50 mt-1">
            {step === 1
              ? `Select the body systems relevant to ${firstName}'s care and add personalized notes for each.`
              : `Add a personal welcome and closing message for ${firstName}.`
            }
          </p>
        </div>

        {/* Success state */}
        {sent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-aubergine/30 backdrop-blur-sm">
            <div className="bg-white rounded-card p-10 shadow-2xl text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-sans font-semibold text-xl text-aubergine mb-2">Presentation Sent</h2>
              <p className="text-sm font-sans text-aubergine/50">
                {firstName}&apos;s personalized care presentation is ready. They&apos;ll receive a link to view it.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Body Systems */}
        {step === 1 && (
          <>
            <div className="grid grid-cols-3 gap-8">
              {/* Left: Component selection */}
              <div className="col-span-1 space-y-3">
                <h3 className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider mb-3">
                  Body Systems
                </h3>
                {PRESENTATION_COMPONENTS.map((comp) => (
                  <button
                    key={comp.key}
                    onClick={() => toggleComponent(comp.key)}
                    className={`w-full text-left p-3 rounded-card border transition-all ${
                      selected.has(comp.key)
                        ? activeComponent === comp.key
                          ? 'bg-white border-violet/30 shadow-md ring-2 ring-violet/10'
                          : 'bg-white border-violet/20 shadow-sm'
                        : 'bg-white/50 border-aubergine/5 hover:border-aubergine/15 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected.has(comp.key)
                            ? 'bg-violet/10'
                            : 'bg-aubergine/5'
                        }`}
                      >
                        <svg
                          className={`w-4 h-4 transition-colors ${
                            selected.has(comp.key) ? 'text-violet' : 'text-aubergine/30'
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d={comp.icon} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-sans transition-colors ${
                          selected.has(comp.key) ? 'text-aubergine' : 'text-aubergine/50'
                        }`}>
                          {comp.label}
                        </p>
                      </div>
                      {selected.has(comp.key) && (
                        <svg className="w-4 h-4 text-violet flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}

                <p className="text-xs font-sans text-aubergine/30 mt-4 px-1">
                  {selected.size} of 10 systems selected
                </p>
              </div>

              {/* Right: Notes editor */}
              <div className="col-span-2">
                {activeComponent ? (
                  <ComponentEditor
                    component={PRESENTATION_COMPONENTS.find((c) => c.key === activeComponent)!}
                    note={notes[activeComponent]?.provider_note || ''}
                    onNoteChange={(text) => updateNote(activeComponent, text)}
                    onAIDraft={() => handleAIDraft(activeComponent)}
                    isDrafting={draftingAI === activeComponent}
                    firstName={firstName}
                  />
                ) : selected.size > 0 ? (
                  <div className="bg-white rounded-card p-8 shadow-sm border border-aubergine/5 text-center">
                    <svg className="w-10 h-10 mx-auto text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <p className="text-sm font-sans text-aubergine/40">
                      Click a selected body system to add personalized notes
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-card p-8 shadow-sm border border-aubergine/5 text-center">
                    <svg className="w-10 h-10 mx-auto text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <p className="text-sm font-sans text-aubergine/40">
                      Select body systems from the left to begin building {firstName}&apos;s presentation
                    </p>
                  </div>
                )}

                {/* Next step button */}
                {selected.size > 0 && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setStep(2)}
                      className="flex items-center gap-2 px-6 py-3 bg-aubergine text-white text-sm font-sans font-medium rounded-brand hover:bg-aubergine/90 transition-colors shadow-sm"
                    >
                      Continue to Messages
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Step 2: Messages & Send */}
        {step === 2 && (
          <div className="max-w-2xl">
            {/* Selected systems summary */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5 mb-6">
              <p className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider mb-3">
                Selected Body Systems
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from(selected).map((key) => {
                  const comp = PRESENTATION_COMPONENTS.find((c) => c.key === key)
                  if (!comp) return null
                  return (
                    <span key={key} className="text-xs font-sans text-violet bg-violet/5 px-3 py-1.5 rounded-pill border border-violet/15">
                      {comp.label}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Welcome message */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5 mb-4">
              <label className="text-xs font-sans text-aubergine/50 mb-2 block">
                Welcome message (optional — a default will be used)
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={3}
                placeholder={`${firstName}, I've put together a personalized summary of what's happening in your body and how we're going to address it together.`}
                className="w-full px-3 py-2 text-sm font-sans text-aubergine bg-cream border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20 resize-y"
              />
            </div>

            {/* Closing message */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5 mb-6">
              <label className="text-xs font-sans text-aubergine/50 mb-2 block">
                Closing message (optional — a default will be used)
              </label>
              <textarea
                value={closingMessage}
                onChange={(e) => setClosingMessage(e.target.value)}
                rows={3}
                placeholder="Remember, this is a journey and you're not alone in it. I'm here to guide you every step of the way. — Dr. Urban"
                className="w-full px-3 py-2 text-sm font-sans text-aubergine bg-cream border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20 resize-y"
              />
            </div>

            {/* Error message */}
            {sendError && (
              <div className="mb-4 p-3 rounded-brand bg-red-50 border border-red-100 text-sm font-sans text-red-600">
                {sendError}
              </div>
            )}

            {/* Back and Send buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-5 py-3 text-sm font-sans font-medium text-aubergine/60 bg-white border border-aubergine/15 rounded-brand hover:bg-aubergine/5 hover:text-aubergine transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Body Systems
              </button>
              <button
                onClick={handleSend}
                disabled={sending || sent}
                className="flex items-center gap-2 px-6 py-3 bg-aubergine text-white text-sm font-sans font-medium rounded-brand hover:bg-aubergine/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Generate &amp; Send Presentation
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Inline sub-component for editing a single body system's notes
function ComponentEditor({
  component,
  note,
  onNoteChange,
  onAIDraft,
  isDrafting,
  firstName,
}: {
  component: PresentationComponent
  note: string
  onNoteChange: (text: string) => void
  onAIDraft: () => void
  isDrafting: boolean
  firstName: string
}) {
  return (
    <div className="bg-white rounded-card p-6 shadow-sm border border-aubergine/5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-sans font-semibold text-lg text-aubergine">{component.label}</h3>
          <p className="text-xs font-sans text-aubergine/40 mt-1">{component.description}</p>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${component.color}15` }}
        >
          <svg
            className="w-5 h-5"
            style={{ color: component.color }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={component.icon} />
          </svg>
        </div>
      </div>

      {/* Clinical relevance */}
      <div className="mb-5 p-4 rounded-brand bg-violet/5 border border-violet/10">
        <p className="text-xs font-sans font-semibold text-violet/60 mb-1">Clinical Relevance</p>
        <p className="text-sm font-sans text-aubergine/70 leading-relaxed">{component.clinicalRelevance}</p>
      </div>

      {/* Patient-facing explanation preview */}
      <div className="mb-5 p-4 rounded-brand bg-cream border border-aubergine/5">
        <p className="text-xs font-sans font-semibold text-aubergine/40 mb-1">Default Patient Explanation</p>
        <p className="text-sm font-sans text-aubergine/60 leading-relaxed italic">{component.defaultExplanation}</p>
      </div>

      {/* Provider notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-sans font-semibold text-aubergine/50">
            Your Personalized Note for {firstName}
          </label>
          <button
            onClick={onAIDraft}
            disabled={isDrafting}
            className="flex items-center gap-1.5 text-xs font-sans text-violet hover:text-violet-dark transition-colors disabled:opacity-50"
          >
            {isDrafting ? (
              <>
                <div className="w-3 h-3 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
                Drafting...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Assist
              </>
            )}
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={4}
          placeholder={`Add personalized notes about ${firstName}'s ${component.shortLabel.toLowerCase()} findings, treatment plan, and what to expect...`}
          className="w-full px-3 py-2 text-sm font-sans text-aubergine bg-cream border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20 resize-y"
        />
        <p className="text-xs font-sans text-aubergine/25 mt-1.5">
          This note will appear as a &ldquo;From your provider&rdquo; card in the presentation.
        </p>
      </div>
    </div>
  )
}
