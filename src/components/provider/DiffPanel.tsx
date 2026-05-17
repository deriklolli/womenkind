'use client'

interface RxChange {
  id: string
  change_type: string
  previous_dosage: string | null
  new_dosage: string | null
  created_at: string
}

interface RnNote {
  visit_date: string
  notes: string | null
}

interface DiffData {
  since: string | null
  wmiDelta: { from: number | null; to: number; delta: number | null } | null
  rxChanges: RxChange[]
  messageCount: number
  rnNotes: RnNote[]
}

interface Props {
  diff: DiffData
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  started:             'Started',
  dose_increased:      'Dose increased',
  dose_decreased:      'Dose decreased',
  stopped:             'Stopped',
  refill_authorized:   'Refill authorized',
  formulation_changed: 'Formulation changed',
}

export function DiffPanel({ diff }: Props) {
  if (!diff.since) {
    return (
      <div className="text-sm text-aubergine/40 italic px-1">
        No prior MD review recorded — showing all history.
      </div>
    )
  }

  const hasAnything = diff.wmiDelta || diff.rxChanges.length > 0 || diff.messageCount > 0 || diff.rnNotes.length > 0

  if (!hasAnything) {
    return (
      <div className="text-sm text-aubergine/40 italic px-1">
        No changes since last MD review on {formatDate(diff.since)}.
      </div>
    )
  }

  return (
    <div className="divide-y divide-aubergine/5">
      {diff.wmiDelta && (
        <div className="flex items-baseline gap-3 py-2.5">
          <span className="text-xs font-semibold text-aubergine/40 w-24 flex-shrink-0">WMI</span>
          <span className="text-sm text-aubergine">
            {diff.wmiDelta.from != null ? `${diff.wmiDelta.from} → ` : ''}{diff.wmiDelta.to}
            {diff.wmiDelta.delta != null && (
              <span className={`ml-2 text-xs font-semibold ${diff.wmiDelta.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {diff.wmiDelta.delta >= 0 ? `↑ ${diff.wmiDelta.delta}` : `↓ ${Math.abs(diff.wmiDelta.delta)}`}
              </span>
            )}
          </span>
        </div>
      )}

      {diff.rxChanges.length > 0 && (
        <div className="flex items-baseline gap-3 py-2.5">
          <span className="text-xs font-semibold text-aubergine/40 w-24 flex-shrink-0">Rx Changes</span>
          <div className="text-sm text-aubergine space-y-0.5">
            {diff.rxChanges.map(c => (
              <div key={c.id}>
                {CHANGE_TYPE_LABELS[c.change_type] ?? c.change_type}
                {c.new_dosage ? ` → ${c.new_dosage}` : ''}
                <span className="text-aubergine/40 ml-1">({formatDate(c.created_at)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diff.messageCount > 0 && (
        <div className="flex items-baseline gap-3 py-2.5">
          <span className="text-xs font-semibold text-aubergine/40 w-24 flex-shrink-0">Messages</span>
          <span className="text-sm text-aubergine">{diff.messageCount} new</span>
        </div>
      )}

      {diff.rnNotes.length > 0 && (
        <div className="flex items-baseline gap-3 py-2.5">
          <span className="text-xs font-semibold text-aubergine/40 w-24 flex-shrink-0">RN Notes</span>
          <div className="text-sm text-aubergine space-y-0.5">
            {diff.rnNotes.map((n, i) => (
              <div key={i} className="truncate">
                {n.notes ? `${n.notes.slice(0, 80)}${n.notes.length > 80 ? '…' : ''}` : 'Note recorded'}
                <span className="text-aubergine/40 ml-1">({formatDate(n.visit_date)})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
