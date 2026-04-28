'use client'

import { useState } from 'react'

const DOMAINS = [
  { key: 'vasomotor', label: 'Vasomotor',     color: '#d85623' },
  { key: 'sleep',     label: 'Sleep',          color: '#5d9ed5' },
  { key: 'energy',    label: 'Energy',         color: '#e8a838' },
  { key: 'mood',      label: 'Mood',           color: '#944fed' },
  { key: 'cognition', label: 'Cognition',      color: '#6366f1' },
  { key: 'gsm',       label: 'Hormonal',       color: '#c2796d' },
  { key: 'bone',      label: 'Bone Health',    color: '#78716c' },
  { key: 'weight',    label: 'Metabolism',     color: '#0891b2' },
  { key: 'libido',    label: 'Libido',         color: '#e879f9' },
  { key: 'cardio',    label: 'Cardiovascular', color: '#ef4444' },
]

interface Visit {
  id: string
  visit_date: string
  symptom_scores?: Record<string, number> | null
}

interface RxMarker {
  id: string
  medication_name: string
  dosage: string
  prescribed_at: string
}

interface Props {
  visits: Visit[]
  prescriptions?: RxMarker[]
  activeDomains?: string[]
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

// Measure approximate text width in SVG units (fontSize 9, ~0.6 ratio)
function labelWidth(text: string): number {
  return text.length * 5.4 + 14
}

export default function SymptomTrendChart({
  visits,
  prescriptions = [],
  activeDomains = ['vasomotor', 'sleep', 'energy', 'mood'],
}: Props) {
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30)
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null)

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - dateRange)

  const filtered = visits
    .filter(v => v.symptom_scores && Object.keys(v.symptom_scores).length > 0)
    .filter(v => new Date(v.visit_date) >= cutoff)
    .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())

  const VB_W = 600
  const VB_H = 200
  const margin = { top: 32, right: 12, bottom: 28, left: 28 }
  const chartW = VB_W - margin.left - margin.right
  const chartH = VB_H - margin.top - margin.bottom

  const yPos = (score: number) => margin.top + ((score - 1) / 4) * chartH

  const n = filtered.length
  const xPos = (index: number) =>
    n <= 1 ? margin.left + chartW / 2 : margin.left + (index / (n - 1)) * chartW

  const minDate = n > 0 ? new Date(filtered[0].visit_date).getTime() : cutoff.getTime()
  const maxDate = new Date().getTime()

  const rxInRange = prescriptions.filter(rx => {
    const d = new Date(rx.prescribed_at).getTime()
    return d >= cutoff.getTime() && d <= maxDate
  })

  const tickIndices: number[] = []
  if (n > 0) {
    const maxTicks = Math.min(7, n)
    for (let i = 0; i < maxTicks; i++) {
      tickIndices.push(Math.round((i / (maxTicks - 1 || 1)) * (n - 1)))
    }
    const seen: Record<number, boolean> = {}
    const unique = tickIndices.filter(v => { if (seen[v]) return false; seen[v] = true; return true })
    tickIndices.length = 0
    tickIndices.push(...unique)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const hasEnoughData = filtered.length >= 2

  // Pre-compute points for all active domains so hover labels can reference them
  const domainPoints: Record<string, [number, number][]> = {}
  DOMAINS.filter(d => activeDomains.includes(d.key)).forEach(domain => {
    domainPoints[domain.key] = filtered
      .map((v, i) => {
        const score = v.symptom_scores?.[domain.key]
        if (typeof score !== 'number') return null
        return [xPos(i), yPos(score)] as [number, number]
      })
      .filter((p): p is [number, number] => p !== null)
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-serif text-xl text-aubergine">
          Symptom <span className="italic text-violet">Trends</span>
        </p>

        <div className="flex gap-2">
          {([7, 30, 90] as const).map(d => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`font-sans text-xs font-medium px-4 py-1.5 rounded-full transition-colors ${
                dateRange === d
                  ? 'bg-aubergine text-white'
                  : 'bg-aubergine/8 text-aubergine/60 hover:bg-aubergine/12'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 border border-aubergine/5 overflow-hidden">
        {!hasEnoughData ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-sans text-sm text-aubergine/40">
              Check in daily to build your trend
            </p>
            <p className="font-sans text-xs text-aubergine/25 mt-1">
              Your journey line appears after 2 check-ins
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="block w-full h-auto"
            onMouseLeave={() => setHoveredDomain(null)}
          >
            {/* "Better" label */}
            <text
              x={margin.left - 6}
              y={margin.top - 12}
              fontSize="7"
              fill="#280f49"
              fillOpacity={0.35}
              textAnchor="end"
            >
              Better ↑
            </text>

            {/* Y-axis grid lines + labels */}
            {[1, 2, 3, 4, 5].map(score => {
              const y = yPos(score)
              return (
                <g key={score}>
                  <line
                    x1={margin.left}
                    x2={margin.left + chartW}
                    y1={y}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="0.5"
                  />
                  <text
                    x={margin.left - 6}
                    y={y + 3}
                    fontSize="7"
                    fill="#280f49"
                    fillOpacity={0.3}
                    textAnchor="end"
                  >
                    {score}
                  </text>
                </g>
              )
            })}

            {/* X-axis date labels */}
            {tickIndices.map((idx, i) => {
              const anchor = i === 0 ? 'start' : i === tickIndices.length - 1 ? 'end' : 'middle'
              return (
                <text
                  key={idx}
                  x={xPos(idx)}
                  y={margin.top + chartH + 18}
                  fontSize="7"
                  fill="#280f49"
                  fillOpacity={0.4}
                  textAnchor={anchor}
                >
                  {formatDate(filtered[idx].visit_date)}
                </text>
              )
            })}

            {/* Prescription markers */}
            {rxInRange.map(rx => {
              const rxDate = new Date(rx.prescribed_at).getTime()
              const span = maxDate - minDate
              const rxX =
                span === 0
                  ? margin.left + chartW / 2
                  : margin.left + ((rxDate - minDate) / span) * chartW
              return (
                <g key={rx.id}>
                  <line
                    x1={rxX} x2={rxX}
                    y1={margin.top} y2={margin.top + chartH}
                    stroke="#944fed" strokeOpacity={0.35}
                    strokeDasharray="3 3" strokeWidth="1.5"
                  />
                  <text
                    x={rxX} y={margin.top - 8}
                    fontSize="7" fill="#944fed" fillOpacity={0.7}
                    textAnchor="middle"
                  >
                    {rx.medication_name}
                  </text>
                </g>
              )
            })}

            {/* Domain lines — rendered in two passes so hit areas sit on top */}
            {/* Pass 1: visible lines + dots */}
            {DOMAINS.filter(d => activeDomains.includes(d.key)).map(domain => {
              const pts = domainPoints[domain.key]
              if (!pts || pts.length < 2) return null
              const path = smoothPath(pts)
              const last = pts[pts.length - 1]
              const isHovered = hoveredDomain === domain.key
              const isDimmed = hoveredDomain !== null && !isHovered

              return (
                <g
                  key={domain.key}
                  style={{ opacity: isDimmed ? 0.2 : 1, transition: 'opacity 0.15s' }}
                >
                  <path
                    d={path}
                    stroke={domain.color}
                    strokeWidth={isHovered ? '2' : '1.5'}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'stroke-width 0.15s' }}
                  />
                  {pts.slice(0, -1).map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="1.5" fill={domain.color} />
                  ))}
                  <circle
                    cx={last[0]} cy={last[1]}
                    r="3" fill={domain.color}
                    stroke="white" strokeWidth="1"
                  />
                </g>
              )
            })}

            {/* Pass 2: invisible wide hit areas on top of lines */}
            {DOMAINS.filter(d => activeDomains.includes(d.key)).map(domain => {
              const pts = domainPoints[domain.key]
              if (!pts || pts.length < 2) return null
              return (
                <path
                  key={`hit-${domain.key}`}
                  d={smoothPath(pts)}
                  stroke="transparent"
                  strokeWidth="16"
                  fill="none"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredDomain(domain.key)}
                />
              )
            })}

            {/* Hover label — pill at terminal dot of hovered line */}
            {hoveredDomain && (() => {
              const domain = DOMAINS.find(d => d.key === hoveredDomain)
              const pts = domainPoints[hoveredDomain]
              if (!domain || !pts || pts.length < 2) return null
              const last = pts[pts.length - 1]
              const lw = labelWidth(domain.label)
              const lh = 15
              // Keep pill within the viewBox
              let lx = last[0] + 8
              if (lx + lw > VB_W - 4) lx = last[0] - lw - 8
              const ly = Math.max(margin.top, Math.min(last[1] - lh / 2, margin.top + chartH - lh))
              return (
                <g key="hover-label" style={{ pointerEvents: 'none' }}>
                  <rect
                    x={lx} y={ly}
                    width={lw} height={lh}
                    rx="9" ry="9"
                    fill={domain.color}
                  />
                  <text
                    x={lx + lw / 2} y={ly + lh / 2 + 3.5}
                    fontSize="9"
                    fontWeight="600"
                    fill="white"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {domain.label}
                  </text>
                </g>
              )
            })()}
          </svg>
        )}
      </div>
    </div>
  )
}
