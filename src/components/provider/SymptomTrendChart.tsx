'use client'

import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

interface Visit {
  id: string
  visit_type: string
  visit_date: string
  symptom_scores: Record<string, number>
}

interface SymptomTrendChartProps {
  visits: Visit[]
  domain: string
  label: string
  color: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-brand shadow-lg border border-aubergine/10 px-3 py-2">
      <p className="text-xs font-sans text-aubergine/50 mb-1">{label}</p>
      <p className="text-sm font-sans font-semibold" style={{ color: payload[0]?.color }}>
        {payload[0]?.value}/5
      </p>
    </div>
  )
}

// Wavy ghost data — gives the placeholder a realistic up/down curve shape
const GHOST_DATA = [
  { date: '', score: 3.2 },
  { date: '', score: 4.1 },
  { date: '', score: 3.5 },
  { date: '', score: 2.7 },
  { date: '', score: 3.8 },
  { date: '', score: 2.4 },
  { date: '', score: 3.1 },
]

function GhostChart({ domain, label, color, currentScore }: {
  domain: string
  label: string
  color: string
  currentScore?: number
}) {
  return (
    <div className="bg-white rounded-card shadow-sm border border-aubergine/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <h4 className="text-sm font-sans font-medium text-aubergine/40">{label}</h4>
        {currentScore !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-lg font-sans font-semibold text-aubergine/40">{currentScore}</span>
            <span className="text-xs font-sans text-aubergine/25">/5</span>
          </div>
        )}
      </div>

      {/* Ghost chart + overlay — full bleed */}
      <div className="relative h-32">
        <div className="absolute inset-0 opacity-[0.13] pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={GHOST_DATA} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id={`ghost-gradient-${domain}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={[1, 5]} hide />
              <Area
                type="natural"
                dataKey="score"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#ghost-gradient-${domain})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Overlay message */}
        <div className="absolute inset-0 flex items-center justify-center pb-6">
          <p className="text-xs font-sans text-aubergine/50 text-center leading-snug">
            {currentScore !== undefined
              ? 'Trend appears after a second check-in'
              : 'Trend appears after 2 check-ins'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SymptomTrendChart({ visits, domain, label, color }: SymptomTrendChartProps) {
  const data = visits
    .filter((v) => v.symptom_scores?.[domain] !== undefined)
    .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())
    .map((v) => ({
      date: new Date(v.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: v.symptom_scores[domain],
    }))

  if (data.length < 2) {
    return (
      <GhostChart
        domain={domain}
        label={label}
        color={color}
        currentScore={data.length === 1 ? data[0].score : undefined}
      />
    )
  }

  const firstScore = data[0].score
  const lastScore = data[data.length - 1].score
  const change = lastScore - firstScore
  const improved = change < 0

  return (
    <div className="bg-white rounded-card shadow-sm border border-aubergine/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <h4 className="text-sm font-sans font-medium text-aubergine">{label}</h4>
        <div className="flex items-center gap-2">
          <span className="text-lg font-sans font-semibold text-aubergine">{lastScore}</span>
          <span className="text-xs font-sans text-aubergine/40">/5</span>
          {change !== 0 && (
            <span className={`text-xs font-sans px-1.5 py-0.5 rounded-pill ${
              improved
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-red-500 bg-red-50'
            }`}>
              {improved ? '↓' : '↑'} {Math.abs(change)}
            </span>
          )}
        </div>
      </div>

      {/* Chart — full bleed */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${domain}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#280f4945', fontFamily: 'Plus Jakarta Sans' }}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
            />
            <YAxis domain={[1, 5]} hide />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="natural"
              dataKey="score"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#gradient-${domain})`}
              dot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
