'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface Visit {
  id: string
  visit_type: string
  visit_date: string
  provider_notes: string | null
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
}

interface NotesPanelProps {
  patientId: string
  providerId: string
  visits: Visit[]
  providerNotes: ProviderNote[]
  onNoteAdded: () => void
}

const NOTE_TYPES = [
  { value: 'general',   label: 'General',    icon: '📝' },
  { value: 'follow_up', label: 'Follow-up',  icon: '🔄' },
  { value: 'phone_call',label: 'Phone Call', icon: '📞' },
  { value: 'message',   label: 'Message',    icon: '💬' },
  { value: 'clinical',  label: 'Clinical',   icon: '🩺' },
]

const SOAP_SECTIONS: { key: keyof Pick<EncounterNote, 'chief_complaint' | 'hpi' | 'ros' | 'assessment' | 'plan'>; label: string; sub: string }[] = [
  { key: 'chief_complaint', label: 'Chief Complaint',            sub: 'Primary reason for visit' },
  { key: 'hpi',             label: 'History of Present Illness', sub: 'Detailed symptom narrative' },
  { key: 'ros',             label: 'Review of Systems',          sub: 'Pertinent positives and negatives' },
  { key: 'assessment',      label: 'Assessment',                 sub: 'Clinical reasoning and diagnosis' },
  { key: 'plan',            label: 'Plan',                       sub: 'Treatments, follow-up, and next steps' },
]

const ENCOUNTER_STATUS: Record<EncounterNote['status'], { label: string; color: string }> = {
  pending:      { label: 'Processing',   color: 'bg-amber-50 text-amber-600 border-amber-200' },
  transcribing: { label: 'Transcribing', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  draft:        { label: 'Draft',        color: 'bg-violet/8 text-violet border-violet/20' },
  signed:       { label: 'Signed',       color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  failed:       { label: 'Failed',       color: 'bg-red-50 text-red-500 border-red-200' },
}

// ── Unified timeline entry ──────────────────────────────────────────────────
type TimelineEntry =
  | { kind: 'visit';     id: string; date: string; title: string; content: string; visitType: string }
  | { kind: 'manual';    id: string; date: string; title: string; content: string; noteType: string }
  | { kind: 'encounter'; id: string; date: string; note: EncounterNote }

function buildTimeline(
  visits: Visit[],
  notes: ProviderNote[],
  encounters: EncounterNote[],
): TimelineEntry[] {
  const items: TimelineEntry[] = []

  for (const v of visits) {
    if (v.provider_notes) {
      const typeLabel = v.visit_type === 'intake' ? 'Intake' :
                        v.visit_type === 'follow_up' ? 'Follow-up' :
                        v.visit_type === 'check_in' ? 'Check-in' : v.visit_type
      items.push({ kind: 'visit', id: `visit-${v.id}`, date: v.visit_date,
        title: `${typeLabel} Visit Notes`, content: v.provider_notes, visitType: v.visit_type })
    }
  }

  for (const n of notes) {
    items.push({ kind: 'manual', id: n.id, date: n.created_at,
      title: n.title || NOTE_TYPES.find(t => t.value === n.note_type)?.label || 'Note',
      content: n.content, noteType: n.note_type })
  }

  for (const e of encounters) {
    items.push({ kind: 'encounter', id: e.id, date: e.created_at, note: e })
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return items
}

export default function NotesPanel({ patientId, providerId, visits, providerNotes, onNoteAdded }: NotesPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState('general')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Encounter note state
  const [encounters, setEncounters] = useState<EncounterNote[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Partial<EncounterNote>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [showTranscript, setShowTranscript] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchEncounters()
  }, [patientId])

  const fetchEncounters = async () => {
    const { data } = await supabase
      .from('encounter_notes')
      .select('id, source, status, chief_complaint, hpi, ros, assessment, plan, transcript, signed_at, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    const list = (data || []) as EncounterNote[]
    setEncounters(list)
    // Auto-expand first draft
    const firstDraft = list.find(n => n.status === 'draft')
    if (firstDraft) setExpandedId(firstDraft.id)
  }

  const timeline = buildTimeline(visits, providerNotes, encounters)

  // ── New manual note ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('provider_notes').insert({
        patient_id: patientId, provider_id: providerId,
        title: title.trim() || null, content: content.trim(), note_type: noteType,
      })
      if (error) throw error
      setSaved(true)
      setTimeout(() => {
        setSaved(false); setShowForm(false)
        setTitle(''); setContent(''); setNoteType('general')
        onNoteAdded()
      }, 800)
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Encounter note actions ──────────────────────────────────────────────
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
    setEditSaving(true)
    try {
      const { error } = await supabase.from('encounter_notes').update(edits).eq('id', noteId)
      if (error) throw error
      setEncounters(prev => prev.map(n => n.id === noteId ? { ...n, ...edits } : n))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to save edits:', err)
    } finally {
      setEditSaving(false)
    }
  }

  const signNote = async (noteId: string) => {
    setSigning(true)
    try {
      const signedAt = new Date().toISOString()
      const { error } = await supabase.from('encounter_notes')
        .update({ status: 'signed', signed_at: signedAt }).eq('id', noteId)
      if (error) throw error
      setEncounters(prev => prev.map(n =>
        n.id === noteId ? { ...n, status: 'signed', signed_at: signedAt } : n
      ))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to sign note:', err)
    } finally {
      setSigning(false)
    }
  }

  const deleteEncounter = async (noteId: string) => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('encounter_notes').delete().eq('id', noteId)
      if (error) throw error
      setEncounters(prev => prev.filter(n => n.id !== noteId))
      setConfirmDeleteId(null)
      if (expandedId === noteId) setExpandedId(null)
    } catch (err) {
      console.error('Failed to delete note:', err)
    } finally {
      setDeleting(false)
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const visitTypeColor = (type: string) => {
    switch (type) {
      case 'intake':    return 'bg-violet/10 text-violet border-violet/20'
      case 'follow_up': return 'bg-terracota/10 text-terracota border-terracota/20'
      default:          return 'bg-aubergine/5 text-aubergine/60 border-aubergine/10'
    }
  }
  const noteTypeColor = (type: string) => {
    switch (type) {
      case 'clinical':   return 'bg-violet/10 text-violet border-violet/20'
      case 'follow_up':  return 'bg-terracota/10 text-terracota border-terracota/20'
      case 'phone_call':
      case 'message':    return 'bg-blue-50 text-blue-600 border-blue-200'
      default:           return 'bg-aubergine/5 text-aubergine/50 border-aubergine/10'
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* New note form */}
      {showForm && (
        <div className="bg-white rounded-card p-6 shadow-sm border border-violet/15">
          <h4 className="text-sm font-sans font-semibold text-aubergine mb-4">New Note</h4>
          <div className="mb-4">
            <label className="text-xs font-sans font-medium text-aubergine/60 mb-2 block">Type</label>
            <div className="flex gap-2 flex-wrap">
              {NOTE_TYPES.map((t) => (
                <button key={t.value} onClick={() => setNoteType(t.value)}
                  className={`text-xs font-sans font-medium px-3 py-1.5 rounded-pill border transition-all ${
                    noteType === t.value
                      ? 'bg-aubergine text-white border-aubergine'
                      : 'bg-white text-aubergine/60 border-aubergine/15 hover:border-aubergine/30'
                  }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-sans font-medium text-aubergine/60 mb-1.5 block">Title (optional)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Post-visit follow-up, Patient phone call..."
              className="w-full px-3 py-2 text-sm font-sans text-aubergine bg-cream border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20" />
          </div>
          <div className="mb-5">
            <label className="text-xs font-sans font-medium text-aubergine/60 mb-1.5 block">Note</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5}
              placeholder="Write your note here..."
              className="w-full px-3 py-2 text-sm font-sans text-aubergine bg-cream border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20 resize-y" />
          </div>
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={!content.trim() || saving || saved}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-sans font-medium rounded-brand transition-all shadow-sm ${
                saved ? 'bg-emerald-500 text-white'
                      : 'bg-aubergine text-white hover:bg-aubergine/90 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}>
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
              ) : saved ? (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Saved</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Save Note</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main notes card */}
      {!showForm && (
        <div className="bg-white rounded-card shadow-sm border border-aubergine/5">
          <div className="flex items-center justify-between px-6 py-4 border-b border-aubergine/5">
            <h3 className="text-sm font-sans font-medium text-aubergine flex items-center gap-2">
              <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              All Notes
            </h3>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-violet border border-violet/30 text-sm font-sans font-medium rounded-brand hover:bg-violet/5 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Note
            </button>
          </div>

          {timeline.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-10 h-10 mx-auto text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <p className="text-sm font-sans text-aubergine/30">No notes yet</p>
            </div>
          ) : (
            <div className="divide-y divide-aubergine/5">
              {timeline.map((entry) => {

                // ── Visit or manual note (simple row) ──────────────────────
                if (entry.kind === 'visit' || entry.kind === 'manual') {
                  return (
                    <div key={entry.id} className="p-5 hover:bg-aubergine/[0.01] transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {entry.kind === 'visit' ? (
                            <span className={`text-xs font-sans px-2.5 py-1 rounded-pill border ${visitTypeColor(entry.visitType)}`}>
                              Visit
                            </span>
                          ) : (
                            <span className={`text-xs font-sans px-2.5 py-1 rounded-pill border ${noteTypeColor(entry.noteType)}`}>
                              {NOTE_TYPES.find(t => t.value === entry.noteType)?.icon}{' '}
                              {NOTE_TYPES.find(t => t.value === entry.noteType)?.label || entry.noteType}
                            </span>
                          )}
                          <h4 className="text-sm font-sans font-medium text-aubergine">{entry.title}</h4>
                        </div>
                        <span className="text-xs font-sans text-aubergine/40 flex-shrink-0">
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm font-sans text-aubergine/70 whitespace-pre-wrap leading-relaxed">
                        {entry.content}
                      </p>
                    </div>
                  )
                }

                // ── Encounter / AI note (expandable) ───────────────────────
                const note = entry.note
                const isExpanded = expandedId === note.id
                const isEditing = editingId === note.id
                const statusCfg = ENCOUNTER_STATUS[note.status]
                const sourceLabel = note.source === 'telehealth' ? 'Video Visit' : 'In-Office Visit'

                return (
                  <div key={entry.id}>
                    {/* Header row */}
                    <div
                      className="p-5 hover:bg-aubergine/[0.01] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : note.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-sans px-2.5 py-1 rounded-pill border bg-violet/5 text-violet border-violet/20">
                            AI Note
                          </span>
                          <h4 className="text-sm font-sans font-medium text-aubergine">{sourceLabel}</h4>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-sans text-aubergine/40">
                            {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className={`text-xs font-sans font-medium px-2.5 py-1 rounded-pill border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>

                          {/* Delete (not on signed notes) */}
                          {note.status !== 'signed' && (
                            confirmDeleteId === note.id ? (
                              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                <span className="text-xs font-sans text-aubergine/50">Delete?</span>
                                <button onClick={() => deleteEncounter(note.id)} disabled={deleting}
                                  className="text-xs font-sans font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50">
                                  {deleting ? 'Deleting...' : 'Yes'}
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs font-sans text-aubergine/40 hover:text-aubergine/70 transition-colors">
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

                          <svg className={`w-4 h-4 text-aubergine/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Expanded SOAP content */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-aubergine/5 bg-aubergine/[0.01]">

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

                        {(note.status === 'draft' || note.status === 'signed') && (
                          <div className="mt-4 space-y-4">
                            {SOAP_SECTIONS.map(section => (
                              <div key={section.key}>
                                <div className="flex items-baseline gap-2 mb-1.5">
                                  <h4 className="text-xs font-sans font-semibold text-aubergine/65 uppercase tracking-wider">{section.label}</h4>
                                  <span className="text-xs font-sans text-aubergine/30">{section.sub}</span>
                                </div>
                                {isEditing ? (
                                  <textarea
                                    value={(edits[section.key] as string) || ''}
                                    onChange={e => setEdits(prev => ({ ...prev, [section.key]: e.target.value }))}
                                    rows={section.key === 'hpi' || section.key === 'plan' ? 5 : 3}
                                    className="w-full px-3 py-2.5 text-sm font-sans text-aubergine bg-white border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20 resize-y"
                                  />
                                ) : (
                                  <p className="text-sm font-sans text-aubergine/75 leading-relaxed whitespace-pre-wrap">
                                    {note[section.key] || <span className="text-aubergine/25 italic">Not documented</span>}
                                  </p>
                                )}
                              </div>
                            ))}

                            {/* Actions */}
                            {note.status === 'draft' && (
                              <div className="flex items-center justify-between pt-4 border-t border-aubergine/5">
                                <div>
                                  {note.transcript && (
                                    <button onClick={() => setShowTranscript(showTranscript === note.id ? null : note.id)}
                                      className="text-xs font-sans text-aubergine/40 hover:text-aubergine/70 transition-colors underline underline-offset-2">
                                      {showTranscript === note.id ? 'Hide transcript' : 'View transcript'}
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isEditing ? (
                                    <>
                                      <button onClick={() => setEditingId(null)}
                                        className="px-4 py-2 text-xs font-sans font-medium text-aubergine/50 border border-aubergine/10 rounded-pill hover:bg-aubergine/5 transition-colors">
                                        Cancel
                                      </button>
                                      <button onClick={() => saveEdits(note.id)} disabled={editSaving}
                                        className="px-4 py-2 text-xs font-sans font-medium text-white bg-aubergine rounded-pill hover:bg-aubergine/90 transition-colors disabled:opacity-50">
                                        {editSaving ? 'Saving...' : 'Save changes'}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditing(note)}
                                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-sans font-medium text-aubergine/60 border border-aubergine/10 rounded-pill hover:bg-aubergine/5 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                        </svg>
                                        Edit
                                      </button>
                                      <button onClick={() => signNote(note.id)} disabled={signing}
                                        className="flex items-center gap-1.5 px-5 py-2 text-xs font-sans font-semibold text-white bg-violet rounded-pill hover:bg-violet/90 transition-colors disabled:opacity-50">
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
                                    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
                                  }) : ''}
                                </p>
                                {note.transcript && (
                                  <button onClick={() => setShowTranscript(showTranscript === note.id ? null : note.id)}
                                    className="ml-auto text-xs font-sans text-aubergine/35 hover:text-aubergine/60 transition-colors underline underline-offset-2">
                                    {showTranscript === note.id ? 'Hide transcript' : 'View transcript'}
                                  </button>
                                )}
                              </div>
                            )}

                            {showTranscript === note.id && note.transcript && (
                              <div className="mt-2 p-4 bg-cream rounded-brand border border-aubergine/8">
                                <p className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider mb-3">Visit Transcript</p>
                                <p className="text-xs font-sans text-aubergine/60 leading-relaxed whitespace-pre-wrap">{note.transcript}</p>
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
          )}
        </div>
      )}
    </div>
  )
}
