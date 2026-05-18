'use client'

import { useEffect, useState } from 'react'

interface DiffData {
  since: string | null
  wmiDelta: number | null
  wmiNow: number | null
  wmiBefore: number | null
  newLabs: number
  latestLabName: string | null
  rnNotes: number
  newMessages: number
}

interface Props {
  patientId: string
}

export default function DiffPanel({ patientId }: Props) {
  const [diff, setDiff]       = useState<DiffData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/provider/patients/${patientId}/diff`)
      .then(r => r.json())
      .then(setDiff)
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) {
    return (
      <div className="bg-white rounded-card border border-aubergine/5 px-5 py-4">
        <div className="h-3 bg-aubergine/5 rounded animate-pulse w-40" />
      </div>
    )
  }
  if (!diff) return null

  const sinceLabel = diff.since
    ? (() => {
        const days = Math.floor((Date.now() - new Date(diff.since).getTime()) / 86400000)
        if (days === 0) return 'today'
        if (days === 1) return '1 day ago'
        return `${days} days ago`
      })()
    : null

  const hasAny = diff.wmiDelta != null || diff.newLabs > 0 || diff.rnNotes > 0 || diff.newMessages > 0

  return (
    <div className="bg-white rounded-card border border-aubergine/5 px-5 py-4">
      <p className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wide mb-3">
        {sinceLabel ? `Since Last MD Review (${sinceLabel})` : 'No MD Review Recorded Yet'}
      </p>

      {!hasAny ? (
        <p className="text-sm font-sans text-aubergine/30">
          {sinceLabel
            ? `No changes since review on ${new Date(diff.since!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
            : 'Record a review by closing an MD sign-off task for this patient.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {diff.wmiDelta != null && (
            <div className={`rounded-lg px-3 py-2 text-xs font-sans ${diff.wmiDelta < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <span className="font-semibold">WMI {diff.wmiDelta > 0 ? '+' : ''}{diff.wmiDelta} pts</span>
              {diff.wmiBefore != null && diff.wmiNow != null && (
                <span className="ml-1 opacity-70">{diff.wmiBefore} → {diff.wmiNow}</span>
              )}
            </div>
          )}
          {diff.newLabs > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs font-sans bg-amber-50 text-amber-700">
              <span className="font-semibold">{diff.newLabs} new lab{diff.newLabs > 1 ? 's' : ''}</span>
              {diff.latestLabName && <span className="ml-1 opacity-70">{diff.latestLabName}</span>}
            </div>
          )}
          {diff.rnNotes > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs font-sans bg-violet/10 text-violet">
              <span className="font-semibold">{diff.rnNotes} RN note{diff.rnNotes > 1 ? 's' : ''}</span>
            </div>
          )}
          {diff.newMessages > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs font-sans bg-blue-50 text-blue-700">
              <span className="font-semibold">{diff.newMessages} message{diff.newMessages > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
