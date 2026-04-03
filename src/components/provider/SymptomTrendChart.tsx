'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
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
        {payload[0]?.value}/10
      </p>
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
      fullDate: new Date(v.visit_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    }))

  if (data.length < 2) {
    return (
      <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5">
        <h4 className="text-sm font-sans font-medium text-aubergine mb-3">{label}</h4>
        <div className="flex items-center justify-center h-32 text-xs font-sans text-aubergine/30">
          {data.length === 1
            ? `Current score: ${data[0].score}/10`
            : 'Needs at least 2 visits to show trend'
          }
        </div>
      </div>
    )
  }

  const firstScore = data[0].score
  const lastScore = data[data.length - 1].score
  const change = lastScore - firstScore
  const improved = change < 0

  return (
    <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-sans font-medium text-aubergine">{label}</h4>
        <div className="flex items-center gap-2">
          <span className="text-lg font-sans font-semibold text-aubergine">{lastScore}</span>
          <span className="text-xs font-sans text-aubergine/40">/10</span>
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
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${domain}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#280f4910" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#280f4950', fontFamily: 'Plus Jakarta Sans' }}
              axisLine={{ stroke: '#280f4910' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              tick={{ fontSize: 11, fill: '#280f4930', fontFamily: 'Plus Jakarta Sans' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
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
