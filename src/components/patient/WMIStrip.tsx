'use client'

interface Props {
  currentWMI: number | null
  baselineWMI: number | null
  label?: string | null
  lastUpdatedAt?: Date | string | null
}

function trendPhrase(current: number | null, baseline: number | null): string {
  if (current == null || baseline == null) return 'baseline'
  const delta = current - baseline
  if (delta >= 1) return `up ${delta} from intake`
  if (delta <= -5) return `down ${Math.abs(delta)} — let's check in`
  if (delta <= -1) return `down ${Math.abs(delta)} from intake`
  return 'steady since intake'
}

export default function WMIStrip({ currentWMI, baselineWMI, label, lastUpdatedAt }: Props) {
  if (currentWMI == null) {
    return (
      <div className="border-b border-aubergine/5 pb-5">
        <p className="font-sans text-sm text-aubergine/50">Your WMI score will appear here once your intake is processed.</p>
      </div>
    )
  }
  return (
    <div className="border-b border-aubergine/5 pb-5 flex items-baseline gap-4 flex-wrap">
      <span className="font-serif text-5xl text-aubergine leading-none">{currentWMI}</span>
      {label && <span className="font-serif text-xl italic text-violet">{label}</span>}
      <span className="font-sans text-sm text-aubergine/60">— {trendPhrase(currentWMI, baselineWMI)}</span>
      {lastUpdatedAt && (
        <span className="font-sans text-xs text-aubergine/40 ml-auto">
          last updated {new Date(lastUpdatedAt).toLocaleDateString()}
        </span>
      )}
    </div>
  )
}
