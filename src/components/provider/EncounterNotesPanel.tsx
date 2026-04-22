'use client'

import { useState, useEffect } from 'react'

interface EncounterNote {
  id: string
  source: 'telehealth' | 'in_office'
  status: 'pending' | 'transcribing' | 'draft' | 'signed' | 'failed'
  chief_complaint: string | null
  hpi: string | null
  ros: string | null
  assessment: string | null
  plan: string | null
  transcript: string | null
  signed_at: string | null
  created_at: string
  appointment_id: string | null
}

interface Props {
  patientId: string
  providerId: string
}

const STATUS_LABEL: Record<EncounterNote['status'], { label: string; color: string }> = {
  pending:      { label: 'Processing',   color: 'bg-amber-50 text-amber-600 border-amber-200' },
  transcribing: { label: 'Transcribing', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  draft:        { label: 'Draft',        color: 'bg-violet/8 text-violet border-violet/20' },
  signed:       { label: 'Signed',       color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  failed:       { label: 'Failed',       color: 'bg-red-50 text-red-500 border-red-200' },
}

const SOAP_SECTIONS: { key: keyof Pick<EncounterNote, 'chief_complaint' | 'hpi' | 'ros' | 'assessment' | 'plan'>; label: string; sub: string }[] = [
  { key: 'chief_complaint', label: 'Chief Complaint',         sub: 'Primary reason for visit' },
  { key: 'hpi',             label: 'History of Present Illness', sub: 'Detailed symptom narrative' },
  { key: 'ros',             label: 'Review of Systems',       sub: 'Pertinent positives and negatives' },
  { key: 'assessment',      label: 'Assessment',              sub: 'Clinical reasoning and diagnosis' },
  { key: 'plan',            label: 'Plan',                    sub: 'Treatments, follow-up, and next steps' },
]

export default function EncounterNotesPanel({ patientId, providerId }: Props) {
  const [notes, setNotes] = useState<EncounterNote[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Partial<EncounterNote>>({})
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [showTranscript, setShowTranscript] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchNotes()
  }, [patientId])

  const fetchNotes = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/provider/encounter-notes?patientId=${encodeURIComponent(patientId)}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const { notes: data } = await res.json()
      setNotes(data || [])

      // Auto-expand the first draft note
      const firstDraft = (data || []).find((n: EncounterNote) => n.status === 'draft')
      if (firstDraft) setExpandedId(firstDraft.id)
    } catch (err) {
      console.error('Failed to fetch encounter notes:', err)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (note: EncounterNote) => {
    setEditingId(note.id)
    setEdits({
      chief_complaint: note.chief_complaint || '',
      hpi: note.hpi || '',
      ros: note.ros || '',
      assessment: note.assessment || '',
      plan: note.plan || '',
    })
  }

  const saveEdits = async (noteId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/provider/encounter-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits),
      })
      if (!res.ok) throw new Error('Failed to save')
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...edits } : n))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to save note edits:', err)
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (noteId: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/provider/encounter-notes/${noteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      setNotes(prev => prev.filter(n => n.id !== noteId))
      setConfirmDeleteId(null)
      if (expandedId === noteId) setExpandedId(null)
    } catch (err) {
      console.error('Failed to delete note:', err)
    } finally {
      setDeleting(false)
    }
  }

  const signNote = async (noteId: string) => {
    setSigning(true)
    try {
      const res = await fetch(`/api/provider/encounter-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign: true }),
      })
      if (!res.ok) throw new Error('Failed to sign')
      const signedAt = new Date().toISOString()
      setNotes(prev => prev.map(n =>
        n.id === noteId ? { ...n, status: 'signed', signed_at: signedAt } : n
      ))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to sign note:', err)
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-card shadow-sm border border-aubergine/5 p-6 animate-pulse h-24" />
        ))}
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-sm border border-aubergine/5 py-14 text-center">
        <svg className="w-10 h-10 mx-auto text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
        <p className="text-sm font-sans text-aubergine/30">No AI visit notes yet</p>
        <p className="text-xs font-sans text-aubergine/20 mt-1">Notes appear here after a recorded visit is processed</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notes.map(note => {
        const isExpanded = expandedId === note.id
        const isEditing = editingId === note.id
        const statusCfg = STATUS_LABEL[note.status]
        const sourceLabel = note.source === 'telehealth' ? 'Video Visit' : 'In-Office Visit'

        return (
          <div
            key={note.id}
            className="bg-white rounded-card shadow-sm border border-aubergine/5"
          >
            {/* Header row */}
            <div
              className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-aubergine/[0.01] transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : note.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet/8 flex items-center justify-center shrink-0">
                  {note.source === 'telehealth' ? (
                    <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-sans font-semibold text-aubergine">
                    {sourceLabel} — AI Note
                  </p>
                  <p className="text-xs font-sans text-aubergine/40">
                    {new Date(note.created_at).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                    })}
                    {note.status === 'signed' && note.signed_at && (
                      <> &middot; Signed {new Date(note.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-sans font-medium px-2.5 py-1 rounded-pill border ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>

                {/* Delete — not allowed on signed notes */}
                {note.status !== 'signed' && (
                  confirmDeleteId === note.id ? (
                    <div
                      className="flex items-center gap-1.5"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="text-xs font-sans text-aubergine/50">Delete?</span>
                      <button
                        onClick={() => deleteNote(note.id)}
                        disabled={deleting}
                        className="text-xs font-sans font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs font-sans text-aubergine/40 hover:text-aubergine/70 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(note.id) }}
                      className="text-aubergine/20 hover:text-red-400 transition-colors p-1 rounded"
                      aria-label="Delete note"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )
                )}

                <svg
                  className={`w-4 h-4 text-aubergine/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-6 pb-6 border-t border-aubergine/5">

                {/* Processing states */}
                {(note.status === 'pending' || note.status === 'transcribing') && (
                  <div className="flex items-center gap-3 py-8 justify-center">
                    <div className="w-5 h-5 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
                    <p className="text-sm font-sans text-aubergine/50">
                      {note.status === 'pending' ? 'Recording received — starting transcription...' : 'Transcribing visit audio...'}
                    </p>
                  </div>
                )}

                {note.status === 'failed' && (
                  <div className="py-8 text-center">
                    <p className="text-sm font-sans text-red-500">Note generation failed. Please add a manual note below.</p>
                  </div>
                )}

                {/* SOAP sections */}
                {(note.status === 'draft' || note.status === 'signed') && (
                  <div className="mt-5 space-y-5">
                    {SOAP_SECTIONS.map(section => (
                      <div key={section.key}>
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <h4 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider">
                            {section.label}
                          </h4>
                          <span className="text-xs font-sans text-aubergine/30">{section.sub}</span>
                        </div>
                        {isEditing ? (
                          <textarea
                            value={(edits[section.key] as string) || ''}
                            onChange={e => setEdits(prev => ({ ...prev, [section.key]: e.target.value }))}
                            rows={section.key === 'hpi' || section.key === 'plan' ? 5 : 3}
                            className="w-full px-3 py-2.5 text-sm font-sans text-aubergine bg-cream border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20 resize-y"
                          />
                        ) : (
                          <p className="text-sm font-sans text-aubergine/75 leading-relaxed whitespace-pre-wrap">
                            {note[section.key] || <span className="text-aubergine/25 italic">Not documented</span>}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Action row */}
                    {note.status === 'draft' && (
                      <div className="flex items-center justify-between pt-4 border-t border-aubergine/5">
                        <div className="flex items-center gap-2">
                          {note.transcript && (
                            <button
                              onClick={() => setShowTranscript(showTranscript === note.id ? null : note.id)}
                              className="text-xs font-sans text-aubergine/40 hover:text-aubergine/70 transition-colors underline underline-offset-2"
                            >
                              {showTranscript === note.id ? 'Hide transcript' : 'View transcript'}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-4 py-2 text-xs font-sans font-medium text-aubergine/50 border border-aubergine/10 rounded-pill hover:bg-aubergine/5 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdits(note.id)}
                                disabled={saving}
                                className="px-4 py-2 text-xs font-sans font-medium text-white bg-aubergine rounded-pill hover:bg-aubergine/90 transition-colors disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save changes'}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(note)}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-sans font-medium text-aubergine/60 border border-aubergine/10 rounded-pill hover:bg-aubergine/5 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                </svg>
                                Edit
                              </button>
                              <button
                                onClick={() => signNote(note.id)}
                                disabled={signing}
                                className="flex items-center gap-1.5 px-5 py-2 text-xs font-sans font-semibold text-white bg-violet rounded-pill hover:bg-violet/90 transition-colors disabled:opacity-50"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                {signing ? 'Signing...' : 'Sign Note'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {note.status === 'signed' && (
                      <div className="flex items-center gap-2 pt-4 border-t border-aubergine/5">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs font-sans text-aubergine/40">
                          Signed {note.signed_at ? new Date(note.signed_at).toLocaleString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true,
                          }) : ''}
                        </p>
                        {note.transcript && (
                          <button
                            onClick={() => setShowTranscript(showTranscript === note.id ? null : note.id)}
                            className="ml-auto text-xs font-sans text-aubergine/35 hover:text-aubergine/60 transition-colors underline underline-offset-2"
                          >
                            {showTranscript === note.id ? 'Hide transcript' : 'View transcript'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Raw transcript (collapsible) */}
                    {showTranscript === note.id && note.transcript && (
                      <div className="mt-2 p-4 bg-cream rounded-brand border border-aubergine/8">
                        <p className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider mb-3">
                          Visit Transcript
                        </p>
                        <p className="text-xs font-sans text-aubergine/60 leading-relaxed whitespace-pre-wrap">
                          {note.transcript}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
