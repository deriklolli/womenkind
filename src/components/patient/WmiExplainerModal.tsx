'use client'

interface Props {
  open: boolean
  onClose: () => void
  score: number
  wmiLabel: string
  wmiMessage: string
  hasWearable: boolean
}

const DOMAINS = [
  { name: 'Vasomotor',     note: 'hot flashes, night sweats' },
  { name: 'Sleep',         note: 'quality & duration' },
  { name: 'Energy',        note: 'daily fatigue levels' },
  { name: 'Mood',          note: 'self-rated' },
  { name: 'Cognition',     note: 'brain fog & clarity' },
  { name: 'Hormonal',      note: 'GSM symptoms' },
  { name: 'Libido',        note: 'self-rated intimacy' },
  { name: 'Cardiovascular', note: 'heart & circulation' },
]

export default function WmiExplainerModal({ open, onClose, score, wmiLabel, wmiMessage, hasWearable }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#f7f3ee] rounded-2xl w-full max-w-md shadow-xl overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <p className="font-sans text-[10px] font-bold tracking-[0.16em] uppercase text-aubergine/35 mb-0.5">
              Understanding
            </p>
            <h2 className="font-serif text-xl text-aubergine">Your Womenkind Score</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-aubergine/40 hover:text-aubergine hover:bg-aubergine/8 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Band chip + intro */}
          <div>
            <span className="inline-flex items-center text-xs font-sans px-3 py-1 rounded-full bg-violet/10 text-violet mb-3">
              {score} · {wmiLabel}
            </span>
            <p className="text-sm font-sans text-aubergine/70 leading-relaxed">
              {wmiMessage}
            </p>
            <p className="text-sm font-sans text-aubergine/50 leading-relaxed mt-2">
              Higher is better — 100 means your symptoms are fully managed. Your score updates as you check in and your treatment takes effect.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-aubergine/8" />

          {/* What goes into it */}
          <div>
            <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-aubergine/40 mb-3">
              What goes into it
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {DOMAINS.map(d => (
                <div key={d.name} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-violet/50 mt-1.5 shrink-0" />
                  <div>
                    <span className="text-sm font-sans text-aubergine/80 font-medium">{d.name}</span>
                    <span className="block text-[11px] font-sans text-aubergine/40">{d.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-aubergine/8" />

          {/* How to improve */}
          <div>
            <p className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-aubergine/40 mb-2">
              How to improve it
            </p>
            <p className="text-sm font-sans text-aubergine/60 leading-relaxed">
              {hasWearable
                ? 'Check in daily to log your symptoms. Your Oura Ring also contributes sleep and energy data automatically — the more consistent your data, the more accurate your score.'
                : 'Check in daily to log your symptoms. Your score updates every time you submit — consistent check-ins give Dr. Urban the clearest picture of your progress.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
