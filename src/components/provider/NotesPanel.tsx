'use client'

import { useState } from 'react'
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

interface NotesPanelProps {
  patientId: string
  providerId: string
  visits: Visit[]
  providerNotes: ProviderNote[]
  onNoteAdded: () => void
}

const NOTE_TYPES = [
  { value: 'general', label: 'General', icon: '📝' },
  { value: 'follow_up', label: 'Follow-up', icon: '🔄' },
  { value: 'phone_call', label: 'Phone Call', icon: '📞' },
  { value: 'message', label: 'Message', icon: '💬' },
  { value: 'clinical', label: 'Clinical', icon: '🩺' },
]

// Merge visit notes + standalone notes into a unified timeline
interface TimelineNote {
  id: string
  source: 'visit' | 'standalone'
  date: string
  title: string
  content: string
  type: string
  visitType?: string
  visitId?: string
}

function buildTimeline(visits: Visit[], notes: ProviderNote[]): TimelineNote[] {
  const items: TimelineNote[] = []

  // Add visit notes
  for (const v of visits) {
    if (v.provider_notes) {
      const typeLabel = v.visit_type === 'intake' ? 'Intake' :
                        v.visit_type === 'follow_up' ? 'Follow-up' :
                        v.visit_type === 'check_in' ? 'Check-in' : v.visit_type
      items.push({
        id: `visit-${v.id}`,
        source: 'visit',
        date: v.visit_date,
        title: `${typeLabel} Visit Notes`,
        content: v.provider_notes,
        type: 'visit',
        visitType: v.visit_type,
        visitId: v.id,
      })
    }
  }

  // Add standalone notes
  for (const n of notes) {
    items.push({
      id: n.id,
      source: 'standalone',
      date: n.created_at,
      title: n.title || NOTE_TYPES.find(t => t.value === n.note_type)?.label || 'Note',
      content: n.content,
      type: n.note_type,
    })
  }

  // Sort newest first
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

  const timeline = buildTimeline(visits, providerNotes)

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('provider_notes').insert({
        patient_id: patientId,
        provider_id: providerId,
        title: title.trim() || null,
        content: content.trim(),
        note_type: noteType,
      })
      if (error) throw error
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setShowForm(false)
        setTitle('')
        setContent('')
        setNoteType('general')
        onNoteAdded()
      }, 800)
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSaving(false)
    }
  }

  const visitTypeColor = (type: string) => {
    switch (type) {
      case 'intake': return 'bg-violet/10 text-violet border-violet/20'
      case 'follow_up': return 'bg-terracota/10 text-terracota border-terracota/20'
      case 'check_in': return 'bg-aubergine/5 text-aubergine/60 border-aubergine/10'
      default: return 'bg-aubergine/5 text-aubergine/60 border-aubergine/10'
    }
  }

  const noteTypeColor = (type: string) => {
    switch (type) {
      case 'clinical': return 'bg-violet/10 text-violet border-violet/20'
      case 'follow_up': return 'bg-terracota/10 text-terracota border-terracota/20'
      case 'phone_call': return 'bg-blue-50 text-blue-600 border-blue-200'
      case 'message': return 'bg-blue-50 text-blue-600 border-blue-200'
      default: return 'bg-aubergine/5 text-aubergine/50 border-aubergine/10'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + New Note button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-sans font-medium text-aubergine flex items-center gap-2">
            <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            All Notes
          </h3>
          <p className="text-xs font-sans text-aubergine/40 mt-0.5">
            Visit notes and standalone notes, newest first
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-violet border border-violet/30 text-sm font-sans font-medium rounded-brand hover:bg-violet/5 transition-colors"
        >
          {showForm ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Note
            </>
          )}
        </button>
      </div>

      {/* New note form */}
      {showForm && (
        <div className="bg-white rounded-card p-6 shadow-sm border border-violet/15">
          <h4 className="text-sm font-sans font-semibold text-aubergine mb-4">New Note</h4>

          {/* Note type selector */}
          <div className="mb-4">
            <label className="text-xs font-sans font-medium text-aubergine/60 mb-2 block">Type</label>
            <div className="flex gap-2 flex-wrap">
              {NOTE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setNoteType(t.value)}
                  className={`text-xs font-sans font-medium px-3 py-1.5 rounded-pill border transition-all ${
                    noteType === t.value
                      ? 'bg-aubergine text-white border-aubergine'
                      : 'bg-white text-aubergine/60 border-aubergine/15 hover:border-aubergine/30'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title (optional) */}
          <div className="mb-4">
            <label className="text-xs font-sans font-medium text-aubergine/60 mb-1.5 block">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Post-visit follow-up, Patient phone call..."
              className="w-full px-3 py-2 text-sm font-sans text-aubergine bg-cream border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20"
            />
          </div>

          {/* Content */}
          <div className="mb-5">
            <label className="text-xs font-sans font-medium text-aubergine/60 mb-1.5 block">Note</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Write your note here..."
              className="w-full px-3 py-2 text-sm font-sans text-aubergine bg-cream border border-aubergine/10 rounded-brand focus:outline-none focus:border-violet/40 focus:ring-1 focus:ring-violet/20 resize-y"
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving || saved}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-sans font-medium rounded-brand transition-all shadow-sm ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-aubergine text-white hover:bg-aubergine/90 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Save Note
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-card border border-aubergine/5">
          <svg className="w-10 h-10 mx-auto text-aubergine/15 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <p className="text-sm font-sans text-aubergine/30">No notes yet</p>
          <p className="text-xs font-sans text-aubergine/20 mt-1">Click &ldquo;Add Note&rdquo; to create the first one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {timeline.map((note) => (
            <div
              key={note.id}
              className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5 hover:border-aubergine/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {note.source === 'visit' ? (
                    <span className={`text-xs font-sans px-2.5 py-1 rounded-pill border ${visitTypeColor(note.visitType || '')}`}>
                      Visit
                    </span>
                  ) : (
                    <span className={`text-xs font-sans px-2.5 py-1 rounded-pill border ${noteTypeColor(note.type)}`}>
                      {NOTE_TYPES.find(t => t.value === note.type)?.icon}{' '}
                      {NOTE_TYPES.find(t => t.value === note.type)?.label || note.type}
                    </span>
                  )}
                  <h4 className="text-sm font-sans font-medium text-aubergine">{note.title}</h4>
                </div>
                <span className="text-xs font-sans text-aubergine/40 flex-shrink-0">
                  {new Date(note.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <p className="text-sm font-sans text-aubergine/70 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
