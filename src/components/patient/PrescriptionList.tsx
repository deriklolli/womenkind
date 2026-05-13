'use client'

import { useState, useEffect } from 'react'

interface Prescription {
  id: string
  medicationName: string
  dosage: string
  frequency: string
  quantityDispensed: number | null
  daysRemaining: number | null
  refillsAuthorized: number
  refillsUsed: number
  refillsRemaining: number
  needsRefillSoon: boolean
  prescribedAt: string | null
  lastFilledAt: string | null
  runsOutAt: string | null
  providerId?: string
  status: string
}

interface PrescriptionNote {
  id: string
  prescription_id: string
  patient_id: string
  note: string
  created_at: string
}

interface Props {
  patientId: string
  providerId: string
}

export default function PrescriptionList({ patientId, providerId }: Props) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [notes, setNotes] = useState<PrescriptionNote[]>([])
  const [loading, setLoading] = useState(true)
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [newNote, setNewNote] = useState<Record<string, string>>({})
  const [savingNote, setSavingNote] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!patientId) { setLoading(false); return }

    const fetchAll = async () => {
      try {
        const [rxRes, notesRes, pendingRes] = await Promise.all([
          fetch(`/api/prescriptions?patientId=${patientId}`),
          fetch(`/api/prescription-notes?patientId=${patientId}`),
          fetch(`/api/refill-requests?patientId=${patientId}&status=pending`),
        ])

        const rxData = await rxRes.json()
        setPrescriptions(rxData.prescriptions || [])

        if (notesRes.ok) {
          const notesData = await notesRes.json()
          setNotes(Array.isArray(notesData) ? notesData : [])
        }

        if (pendingRes.ok) {
          const pendingData = await pendingRes.json()
          const pendingIds: string[] = (pendingData.refillRequests || []).map((r: any) => r.prescription_id)
          setRequestedIds(new Set(pendingIds))
        }
      } catch (err) {
        console.error('Failed to fetch prescription data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [patientId])

  const notesForRx = (rxId: string) => notes.filter(n => n.prescription_id === rxId)

  const handleRequestRefill = async (prescriptionId: string) => {
    setSubmittingId(prescriptionId)
    try {
      const res = await fetch('/api/refill-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prescriptionId, patientId, providerId }),
      })
      if (res.ok || res.status === 409) {
        setRequestedIds(prev => new Set(prev).add(prescriptionId))
      } else {
        const data = await res.json()
        console.error('Failed to submit refill request:', data.error)
      }
    } catch (err) {
      console.error('Failed to submit refill request:', err)
    } finally {
      setSubmittingId(null)
    }
  }

  const handleSaveNote = async (prescriptionId: string) => {
    const text = newNote[prescriptionId]?.trim()
    if (!text) return
    setSavingNote(prescriptionId)
    try {
      const res = await fetch('/api/prescription-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prescriptionId, patientId, note: text }),
      })
      if (res.ok) {
        const created = await res.json()
        setNotes(prev => [...prev, created])
        setNewNote(prev => ({ ...prev, [prescriptionId]: '' }))
      }
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSavingNote(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (prescriptions.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-10 h-10 text-aubergine/15 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-sans text-aubergine/40">No active prescriptions</p>
        <p className="text-xs font-sans text-aubergine/25 mt-1">Prescriptions will appear here once prescribed by Dr. Urban</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((rx) => {
        const rxNotes = notesForRx(rx.id)
        const isUrgent = rx.daysRemaining !== null && rx.daysRemaining <= 3
        const isExpiringSoon = rx.needsRefillSoon
        const isRequested = requestedIds.has(rx.id)

        const startDate = rx.prescribedAt
          ? new Date(rx.prescribedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null
        const expiryDate = rx.runsOutAt
          ? new Date(rx.runsOutAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null

        // Supply bar: % remaining out of total supply period
        let barPercent = 100
        if (rx.daysRemaining !== null && rx.prescribedAt && rx.runsOutAt) {
          const totalMs = new Date(rx.runsOutAt).getTime() - new Date(rx.prescribedAt).getTime()
          const totalDays = totalMs / (1000 * 60 * 60 * 24)
          barPercent = totalDays > 0 ? Math.max(0, Math.min(100, (rx.daysRemaining / totalDays) * 100)) : 0
        } else if (rx.daysRemaining !== null) {
          barPercent = Math.max(0, Math.min(100, (rx.daysRemaining / 90) * 100))
        }

        const isExpanded = expandedIds.has(rx.id)
        const toggleExpanded = () =>
          setExpandedIds(prev => {
            const next = new Set(prev)
            next.has(rx.id) ? next.delete(rx.id) : next.add(rx.id)
            return next
          })

        return (
          <div key={rx.id} className="bg-white rounded-card border border-aubergine/8 overflow-hidden">
            {/* Header — always visible, click to toggle */}
            <button
              onClick={toggleExpanded}
              className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-aubergine/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="font-sans font-semibold text-aubergine text-base">{rx.medicationName}</p>
                  <p className="text-sm font-sans text-aubergine/50 mt-0.5">{rx.dosage} &middot; {rx.frequency}</p>
                </div>
                {isExpiringSoon && rx.daysRemaining !== null && (
                  <span className={`text-xs font-sans font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                    isUrgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {rx.daysRemaining <= 0 ? 'Expired' : `${rx.daysRemaining}d left`}
                  </span>
                )}
                {rxNotes.length > 0 && (
                  <span className="text-xs font-sans text-aubergine/35 flex-shrink-0">
                    {rxNotes.length} {rxNotes.length === 1 ? 'note' : 'notes'}
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-aubergine/30 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Collapsible body */}
            {isExpanded && (
              <div className="px-6 pb-6 flex flex-col gap-5 border-t border-aubergine/8">
                {/* Dates row */}
                <div className="flex flex-wrap gap-6 pt-4">
                  {startDate && (
                    <div>
                      <p className="text-aubergine/40 text-xs font-sans uppercase tracking-wide mb-0.5">Started</p>
                      <p className="text-sm font-sans text-aubergine/80">{startDate}</p>
                    </div>
                  )}
                  {expiryDate && (
                    <div>
                      <p className="text-aubergine/40 text-xs font-sans uppercase tracking-wide mb-0.5">
                        {rx.daysRemaining !== null && rx.daysRemaining <= 0 ? 'Expired' : 'Expires'}
                      </p>
                      <p className="text-sm font-sans text-aubergine/80">{expiryDate}</p>
                    </div>
                  )}
                  {rx.refillsRemaining > 0 && (
                    <div>
                      <p className="text-aubergine/40 text-xs font-sans uppercase tracking-wide mb-0.5">Refills left</p>
                      <p className="text-sm font-sans text-aubergine/80">{rx.refillsRemaining}</p>
                    </div>
                  )}
                </div>

                {/* Supply bar */}
                {rx.daysRemaining !== null && (
                  <div className="h-1.5 bg-aubergine/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barPercent}%`,
                        background: isUrgent
                          ? '#ef4444'
                          : isExpiringSoon
                          ? '#f59e0b'
                          : 'linear-gradient(to right, #c9a5f7, #944fed)',
                      }}
                    />
                  </div>
                )}

                {/* Refill actions */}
                {isExpiringSoon && rx.refillsRemaining > 0 && (
                  <button
                    onClick={() => handleRequestRefill(rx.id)}
                    disabled={isRequested || submittingId === rx.id}
                    className={`self-start text-sm font-sans font-medium rounded-lg px-4 py-2 transition-colors ${
                      isRequested
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60 cursor-default'
                        : 'text-violet border border-violet/30 hover:bg-violet/5 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {submittingId === rx.id ? 'Requesting…' : isRequested ? 'Refill Requested' : 'Request Refill'}
                  </button>
                )}
                {isExpiringSoon && rx.refillsRemaining === 0 && (
                  <p className="text-sm font-sans text-aubergine/50">
                    No refills remaining — contact Dr. Urban for a new prescription.
                  </p>
                )}

                {/* Divider */}
                <hr className="border-aubergine/8" />

                {/* Notes section */}
                <div>
                  <p className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wide mb-3">
                    Your notes
                  </p>

                  {rxNotes.length === 0 && (
                    <p className="text-sm font-sans text-aubergine/35 mb-3">
                      No notes yet. Add how you&apos;re feeling on this medication.
                    </p>
                  )}

                  {rxNotes.length > 0 && (
                    <div className="flex flex-col gap-3 mb-4">
                      {rxNotes.map(n => (
                        <div key={n.id} className="bg-aubergine/[0.03] rounded-lg p-3">
                          <p className="text-xs font-sans text-aubergine/40 mb-1">
                            {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-sm font-sans text-aubergine/80 whitespace-pre-wrap">{n.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={newNote[rx.id] ?? ''}
                    onChange={e => setNewNote(prev => ({ ...prev, [rx.id]: e.target.value }))}
                    placeholder="How is this medication working for you? Any side effects?"
                    rows={3}
                    className="w-full text-sm font-sans text-aubergine bg-aubergine/[0.03] border border-aubergine/10 rounded-lg px-3 py-2.5 placeholder:text-aubergine/30 resize-none focus:outline-none focus:ring-1 focus:ring-violet/40"
                  />
                  <button
                    onClick={() => handleSaveNote(rx.id)}
                    disabled={!newNote[rx.id]?.trim() || savingNote === rx.id}
                    className="mt-2 text-sm font-sans font-medium text-white bg-violet rounded-lg px-4 py-2 hover:bg-violet/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingNote === rx.id ? 'Saving…' : 'Save note'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
