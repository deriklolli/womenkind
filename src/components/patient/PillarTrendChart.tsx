'use client'

import { useState, useEffect, useId } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DomainMeta {
  key: string
  name: string
  accent: string
  baseline: number
  current: number
  rawScale?: number
  lowerIsBetter?: boolean
}

interface Milestone {
  wk: number
  type: 'visit' | 'rx' | 'dose' | 'lab'
  short: string
  title: string
  body: string
}

interface TrendData {
  weeks: number
  startIso: string
  domains: DomainMeta[]
  series: Record<string, (number | null)[]>
  seriesRaw: Record<string, (number | null)[]>
  wearableSeries: Record<string, (number | null)[]>
  milestones: Milestone[]
}

interface Props {
  patientId: string
  activeDomains: string[]   // mirrors symptom tracker card selection
  initialDomain?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUBERGINE = '#280f49'
const CREAM = '#f7f3ee'
const OURA_COLOR = 'rgba(66,42,31,0.35)'

const DOMAIN_SUBTITLES: Record<string, string> = {
  vasomotor: 'Hot flashes / daily avg',
  sleep:     'Sleep / nightly avg',
  energy:    'Daily energy level',
  mood:      'Self-rated, journaled',
  cognition: 'Brain fog & clarity',
  gsm:       'GSM symptom score',
  bone:      'Density indicators',
  weight:    'Weight & metabolic',
  libido:    'Self-rated intimacy',
  cardio:    'Heart & circulation',
}

const VB_W = 1100
const VB_H = 380
const PAD = { l: 54, r: 36, t: 62, b: 46 }
const CHART_W = VB_W - PAD.l - PAD.r
const CHART_H = VB_H - PAD.t - PAD.b
// ── Math helpers ──────────────────────────────────────────────────────────────

function xOf(wk: number, weeks: number): number {
  return PAD.l + (wk / Math.max(1, weeks - 1)) * CHART_W
}

function getXTicks(weeks: number) {
  if (weeks <= 1) return [{ wk: 0, label: 'NOW' }]
  return [
    { wk: 0, label: 'START' },
    { wk: weeks - 1, label: 'NOW' },
  ]
}

function yOf(val: number): number {
  return PAD.t + CHART_H - (val / 10) * CHART_H
}

function buildPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mid = (x0 + x1) / 2
    d += ` C${mid.toFixed(1)},${y0.toFixed(1)} ${mid.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  return d
}

// ── Domain dropdown ───────────────────────────────────────────────────────────

function DomainDropdown({
  domains,
  activeKey,
  onChange,
}: {
  domains: DomainMeta[]
  activeKey: string
  onChange: (k: string) => void
}) {
  const [open, setOpen] = useState(false)
  const active = domains.find(d => d.key === activeKey) ?? domains[0]

  return (
    <div className="relative" style={{ minWidth: 230 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-cream border transition-colors"
        style={{ borderRadius: 14, borderColor: open ? '#944fed' : 'rgba(66,42,31,.15)' }}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: active?.accent }} />
        <span className="font-display text-sm text-aubergine flex-1 text-left">{active?.name}</span>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          className="flex-shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none', color: AUBERGINE, opacity: 0.4 }}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 w-full bg-white border border-aubergine/10 shadow-lg z-20 overflow-hidden"
          style={{ borderRadius: 14 }}
        >
          {domains.map(d => (
            <button
              key={d.key}
              onClick={() => { onChange(d.key); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cream/60"
              style={{ background: d.key === activeKey ? CREAM : undefined }}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.accent }} />
              <span className="font-display text-sm text-aubergine">{d.name}</span>
            </button>
          ))}
        </div>
      )}

      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
    </div>
  )
}

// ── Annotation card ───────────────────────────────────────────────────────────

function AnnotationCard({
  milestone,
  milestoneIndex,
  displayNumber,
  accent,
  highlighted,
  onHover,
}: {
  milestone: Milestone
  milestoneIndex: number
  displayNumber: number
  accent: string
  highlighted: boolean
  onHover: (idx: number | null) => void
}) {
  return (
    <div
      className="rounded-2xl p-4 cursor-default transition-all duration-[250ms]"
      style={{ background: highlighted ? accent : CREAM, color: highlighted ? 'white' : AUBERGINE }}
      onMouseEnter={() => onHover(milestoneIndex)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-[250ms]"
          style={{
            background: highlighted ? 'white' : accent,
            color: highlighted ? accent : 'white',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-display, serif)',
            fontStyle: 'italic',
          }}
        >
          {displayNumber}
        </span>
        <span
          className="font-sans font-bold tracking-[0.18em] uppercase transition-colors duration-[250ms]"
          style={{ fontSize: 9.5, color: highlighted ? 'rgba(255,255,255,0.65)' : 'rgba(66,42,31,0.45)' }}
        >
          WK {milestone.wk} · {milestone.short}
        </span>
      </div>
      <p
        className="font-display leading-snug transition-colors duration-[250ms]"
        style={{ fontSize: 14, color: highlighted ? 'white' : AUBERGINE }}
      >
        {milestone.title}
      </p>
    </div>
  )
}

// ── Main chart ────────────────────────────────────────────────────────────────

export default function PillarTrendChart({ patientId, activeDomains, initialDomain }: Props) {
  const gradId = useId().replace(/:/g, '')
  const [data, setData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDomainKey, setActiveDomainKey] = useState<string>(initialDomain ?? activeDomains?.[0] ?? 'vasomotor')
  const [hoveredPin, setHoveredPin] = useState<number | null>(null)
  const [hoveredDot, setHoveredDot] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/patient/pillar-trend?patientId=${encodeURIComponent(patientId)}`)
      .then(r => r.json())
      .then((d: TrendData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [patientId])

  // Sync active domain when activeDomains prop changes
  useEffect(() => {
    if (!activeDomains?.length) return
    if (!activeDomains.includes(activeDomainKey)) {
      setActiveDomainKey(activeDomains[0])
    }
  }, [activeDomains, activeDomainKey])

  if (loading || !data) {
    return (
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8 animate-pulse">
        <div className="h-6 bg-aubergine/5 rounded w-48 mb-4" />
        <div className="h-64 bg-aubergine/5 rounded" />
      </div>
    )
  }

  // Filter to only domains in activeDomains (preserving order from activeDomains)
  const visibleDomains = (activeDomains ?? [])
    .map(k => data.domains.find(d => d.key === k))
    .filter((d): d is DomainMeta => !!d)

  if (visibleDomains.length === 0) return null

  const domain = visibleDomains.find(d => d.key === activeDomainKey) ?? visibleDomains[0]
  const { accent, key: domainKey } = domain
  const series = data.series[domainKey] ?? []
  const wearableSeries = data.wearableSeries?.[domainKey] ?? null
  const milestones = data.milestones
  const weeks = data.weeks ?? 24
  const xTicks = getXTicks(weeks)

  // Domain-aware y coordinate: raw-scale domains (e.g. vasomotor, lower=better) map
  // 0 → top of chart, rawScale → bottom. Normalized domains map 10 → top, 0 → bottom.
  const yOfDomain = (val: number): number => {
    if (domain.rawScale) return PAD.t + CHART_H - (val / domain.rawScale) * CHART_H
    return PAD.t + CHART_H - (val / 10) * CHART_H
  }

  const yTicks = domain.rawScale
    ? [0, 5, 10, 15, 20].filter(v => v <= domain.rawScale!)
    : [0, 2, 4, 6, 8, 10]

  // SVG points
  const pts: [number, number][] = series
    .map((v, i) => v !== null ? [xOf(i, weeks), yOfDomain(v)] as [number, number] : null)
    .filter((p): p is [number, number] => p !== null)

  const rawSeries = data.seriesRaw?.[domainKey] ?? []
  const rawPts: { x: number; y: number; wk: number }[] = rawSeries
    .map((v, i) => v !== null ? { x: xOf(i, weeks), y: yOfDomain(v), wk: i } : null)
    .filter((p): p is { x: number; y: number; wk: number } => p !== null)

  const chartStartDate = new Date(data.startIso + 'T00:00:00')

  const linePath = buildPath(pts)
  const lastPt = pts[pts.length - 1] ?? [xOf(weeks - 1, weeks), yOfDomain(domain.rawScale ? domain.rawScale / 2 : 5)]
  const firstPt = pts[0] ?? [xOf(0, weeks), yOfDomain(domain.rawScale ? domain.rawScale / 2 : 5)]

  // Wearable overlay line
  const wearablePts: [number, number][] = wearableSeries
    ? wearableSeries
        .map((v, i) => v !== null ? [xOf(i, weeks), yOfDomain(v)] as [number, number] : null)
        .filter((p): p is [number, number] => p !== null)
    : []
  const wearableLinePath = buildPath(wearablePts)

  const areaPath = pts.length > 0
    ? `${linePath} L${lastPt[0].toFixed(1)},${(PAD.t + CHART_H).toFixed(1)} L${firstPt[0].toFixed(1)},${(PAD.t + CHART_H).toFixed(1)} Z`
    : ''

  // Annotation rail: first 3 + most recent
  const annotationCards = milestones.length <= 4
    ? milestones.map((m, i) => ({ milestone: m, milestoneIndex: i, displayNumber: i + 1 }))
    : [
        { milestone: milestones[0], milestoneIndex: 0, displayNumber: 1 },
        { milestone: milestones[1], milestoneIndex: 1, displayNumber: 2 },
        { milestone: milestones[2], milestoneIndex: 2, displayNumber: 3 },
        { milestone: milestones[milestones.length - 1], milestoneIndex: milestones.length - 1, displayNumber: milestones.length },
      ]

  return (
    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-[26px] leading-tight text-aubergine">
            {domain.name} over time
          </h2>
          {DOMAIN_SUBTITLES[domain.key] && (
            <p className="font-sans text-xs text-aubergine/45 mt-1">{DOMAIN_SUBTITLES[domain.key]}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DomainDropdown
            domains={visibleDomains}
            activeKey={activeDomainKey}
            onChange={k => { setActiveDomainKey(k); setHoveredPin(null); setHoveredDot(null) }}
          />
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-visible">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: 'auto', minHeight: 200, display: 'block' }}
        >
          <defs>
            <linearGradient id={`grad-${gradId}-${domainKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis gridlines */}
          {yTicks.map(v => {
            const gy = yOfDomain(v)
            return (
              <g key={v}>
                <line x1={PAD.l} y1={gy} x2={PAD.l + CHART_W} y2={gy} stroke="rgba(66,42,31,0.07)" strokeWidth={1} />
                <text x={PAD.l - 8} y={gy + 4} textAnchor="end" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize={10} fontWeight={600} fill="rgba(66,42,31,0.5)">{v}</text>
              </g>
            )
          })}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill={`url(#grad-${gradId}-${domainKey})`} />}

          {/* Series line — patient self-reported */}
          {linePath && <path d={linePath} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}

          {/* Check-in dots — hollow ring at each real data point (last point covered by current-week dot) */}
          {rawPts.slice(0, -1).map((pt, i) => {
            const ptDate = new Date(chartStartDate.getTime() + pt.wk * 7 * 24 * 60 * 60 * 1000)
            const label = ptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const isHovered = hoveredDot === i
            const PILL_W = 80
            return (
              <g key={i} onMouseEnter={() => setHoveredDot(i)} onMouseLeave={() => setHoveredDot(null)} style={{ cursor: 'default' }}>
                {isHovered && (
                  <g>
                    <rect x={pt.x - PILL_W / 2} y={pt.y - 44} width={PILL_W} height={24} rx={12} fill={AUBERGINE} />
                    <text x={pt.x} y={pt.y - 27} textAnchor="middle" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize={15} fontWeight={600} fill="white">{label}</text>
                  </g>
                )}
                <circle cx={pt.x} cy={pt.y} r={isHovered ? 5 : 4} fill="white" stroke={accent} strokeWidth={2} />
              </g>
            )
          })}

          {/* Wearable (Oura) overlay — dashed, dimmer */}
          {wearableLinePath && (
            <>
              <path d={wearableLinePath} fill="none" stroke={OURA_COLOR} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />
              {wearablePts.length > 0 && (
                <text
                  x={wearablePts[0][0]}
                  y={wearablePts[0][1] - 10}
                  textAnchor="start"
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                  fontSize={9}
                  fontWeight={700}
                  letterSpacing="0.14em"
                  fill={OURA_COLOR}
                >
                  OURA
                </text>
              )}
            </>
          )}

          {/* Milestone stems + data dots */}
          {milestones.map((m, i) => {
            const mx = xOf(Math.min(weeks - 1, m.wk), weeks)
            const sv = series[Math.min(weeks - 1, m.wk)]
            const my = sv !== null ? yOfDomain(sv) : PAD.t + CHART_H
            return (
              <g key={i}>
                <line x1={mx} y1={my} x2={mx} y2={PAD.t - 18} stroke={AUBERGINE} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
                <circle cx={mx} cy={my} r={4.5} fill="white" stroke={accent} strokeWidth={2} />
              </g>
            )
          })}

          {/* Medallions */}
          {milestones.map((m, i) => {
            const mx = xOf(Math.min(weeks - 1, m.wk), weeks)
            const my = PAD.t - 30
            const isHovered = hoveredPin === i
            const r = isHovered ? 15 : 13
            return (
              <g key={i} style={{ cursor: 'default' }} onMouseEnter={() => setHoveredPin(i)} onMouseLeave={() => setHoveredPin(null)}>
                <circle cx={mx} cy={my} r={r} fill={isHovered ? accent : 'white'} stroke={accent} strokeWidth={1.8} style={{ transition: 'r 200ms, fill 200ms' }} />
                <text x={mx} y={my + 4.5} textAnchor="middle" fontFamily="'Playfair Display', serif" fontSize={12} fontStyle="italic" fill={isHovered ? 'white' : accent} style={{ transition: 'fill 200ms', userSelect: 'none', pointerEvents: 'none' }}>
                  {i + 1}
                </text>
              </g>
            )
          })}

          {/* Current week dot */}
          {pts.length > 0 && (() => {
            const lastRaw = rawPts[rawPts.length - 1]
            const ptDate = lastRaw ? new Date(chartStartDate.getTime() + lastRaw.wk * 7 * 24 * 60 * 60 * 1000) : null
            const label = ptDate ? ptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
            const isHovered = hoveredDot === -1
            const PILL_W = 80
            return (
              <g onMouseEnter={() => setHoveredDot(-1)} onMouseLeave={() => setHoveredDot(null)} style={{ cursor: 'default' }}>
                {isHovered && label && (
                  <g>
                    <rect x={lastPt[0] - PILL_W / 2} y={lastPt[1] - 44} width={PILL_W} height={24} rx={12} fill={AUBERGINE} />
                    <text x={lastPt[0]} y={lastPt[1] - 27} textAnchor="middle" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize={15} fontWeight={600} fill="white">{label}</text>
                  </g>
                )}
                <circle cx={lastPt[0]} cy={lastPt[1]} r={14} fill={accent} opacity={0.15} />
                <circle cx={lastPt[0]} cy={lastPt[1]} r={6} fill="white" stroke={accent} strokeWidth={2.5} />
              </g>
            )
          })()}

          {/* X-axis labels */}
          {xTicks.map(({ wk, label }) => (
            <text key={wk} x={xOf(wk, weeks)} y={PAD.t + CHART_H + 20} textAnchor="middle" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize={10} fontWeight={700} letterSpacing="0.12em" fill="rgba(66,42,31,0.45)">
              {label}
            </text>
          ))}
        </svg>
      </div>

      {/* Annotation rail */}
      {annotationCards.length > 0 && (
        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(4, annotationCards.length)}, 1fr)` }}>
          {annotationCards.map(({ milestone, milestoneIndex, displayNumber }) => (
            <AnnotationCard
              key={milestoneIndex}
              milestone={milestone}
              milestoneIndex={milestoneIndex}
              displayNumber={displayNumber}
              accent={accent}
              highlighted={hoveredPin === milestoneIndex}
              onHover={setHoveredPin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
