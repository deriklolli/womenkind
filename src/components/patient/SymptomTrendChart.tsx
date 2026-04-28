'use client'

const DOMAINS = [
  { key: 'vasomotor', label: 'Vasomotor', color: '#944fed' },
  { key: 'sleep', label: 'Sleep', color: '#4ECDC4' },
  { key: 'mood', label: 'Mood', color: '#F4A261' },
  { key: 'energy', label: 'Energy', color: '#E76F51' },
  { key: 'cognition', label: 'Cognition', color: '#2A9D8F' },
  { key: 'gsm', label: 'GSM', color: '#E9C46A' },
] as const

export type TrendPoint = { weekIndex: number; date: string } & Partial<Record<typeof DOMAINS[number]['key'], number>>

interface Props {
  series: TrendPoint[]
}

function smoothCurvePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x},${p2.y}`
  }
  return d
}

export default function SymptomTrendChart({ series }: Props) {
  const hasData = series.length >= 1
  const width = 720
  const height = 220
  const padX = 40
  const padY = 24
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const maxWeek = Math.max(11, ...series.map(p => p.weekIndex))
  const xFor = (w: number) => padX + (w / maxWeek) * innerW
  const yFor = (v: number) => padY + (1 - v / 10) * innerH

  return (
    <div className="bg-white rounded-card shadow-sm border border-aubergine/5 p-6">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-serif text-xl text-aubergine">Your <span className="italic text-violet">trend</span></h3>
        <div className="flex flex-wrap gap-3">
          {DOMAINS.map(d => (
            <span key={d.key} className="flex items-center gap-1.5 text-xs font-sans text-aubergine/60">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.label}
            </span>
          ))}
        </div>
      </div>
      {hasData ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {[0, 2, 4, 6, 8, 10].map(g => (
            <line key={g} x1={padX} x2={width - padX} y1={yFor(g)} y2={yFor(g)} stroke="#280f49" strokeOpacity={0.05} strokeWidth={1} />
          ))}
          {DOMAINS.map(d => {
            const pts = series
              .filter(p => typeof p[d.key] === 'number')
              .map(p => ({ x: xFor(p.weekIndex), y: yFor(p[d.key] as number) }))
            if (pts.length < 1) return null
            const path = smoothCurvePath(pts)
            return (
              <g key={d.key}>
                {pts.length >= 2 && <path d={path} fill="none" stroke={d.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3.5} fill={d.color} stroke="#fff" strokeWidth={1.5} />
              </g>
            )
          })}
        </svg>
      ) : (
        <div className="h-[220px] flex items-center justify-center text-center">
          <p className="font-sans text-sm text-aubergine/50 max-w-xs">Your trend will appear here after your first check-in.</p>
        </div>
      )}
    </div>
  )
}
