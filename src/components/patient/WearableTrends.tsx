'use client'

import { useState, useEffect, useRef } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface WearableTrendsProps {
  patientId: string
  dateRange?: number // days, default 30
}

interface MetricRow {
  metric_date: string
  metric_type: string
  value: number
}

// Chart config for each metric panel
const CHART_CONFIG: {
  key: string
  label: string
  unit: string
  suffix: string
  domain: [number, number | string]
  ticks: number[] | undefined
  color: string
  higherIsBetter: boolean
  description: string
}[] = [
  {
    key: 'sleep_score',
    label: 'Sleep Quality',
    unit: '',
    suffix: '/100',
    domain: [0, 100],
    ticks: [0, 25, 50, 75, 100],
    color: '#944fed',
    higherIsBetter: true,
    description: 'Overall sleep score from your Oura Ring',
  },
  {
    key: 'temperature_deviation',
    label: 'Skin Temperature',
    unit: '°C',
    suffix: '°C',
    domain: [-2, 2],
    ticks: [-2, -1, 0, 1, 2],
    color: '#d85623',
    higherIsBetter: false,
    description: 'Deviation from your baseline body temperature',
  },
  {
    key: 'hrv_average',
    label: 'Heart Rate Variability',
    unit: 'ms',
    suffix: ' ms',
    domain: [0, 'auto'],
    ticks: undefined,
    color: '#4ECDC4',
    higherIsBetter: true,
    description: 'Average HRV during sleep — higher indicates better recovery',
  },
  {
    key: 'resting_heart_rate',
    label: 'Resting Heart Rate',
    unit: 'bpm',
    suffix: ' bpm',
    domain: [40, 'auto'],
    ticks: undefined,
    color: '#e05286',
    higherIsBetter: false,
    description: 'Lowest heart rate recorded during sleep',
  },
]

function MetricTooltip({ active, payload, label, config }: any) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="bg-white rounded-brand shadow-lg border border-aubergine/10 px-3 py-2">
      <p className="text-xs font-sans text-aubergine/50 mb-1">{label}</p>
      <p className="text-sm font-sans font-semibold" style={{ color: config.color }}>
        {config.key === 'temperature_deviation'
          ? `${val > 0 ? '+' : ''}${val.toFixed(2)}${config.suffix}`
          : `${Math.round(val)}${config.suffix}`}
      </p>
    </div>
  )
}

function MetricChart({ data, config }: { data: MetricRow[]; config: (typeof CHART_CONFIG)[number] }) {
  const chartData = data
    .filter(d => d.metric_type === config.key)
    .sort((a, b) => new Date(a.metric_date).getTime() - new Date(b.metric_date).getTime())
    .map(d => ({
      date: new Date(d.metric_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: d.value,
    }))

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5">
        <h4 className="text-sm font-sans font-medium text-aubergine mb-1">{config.label}</h4>
        <p className="text-xs font-sans text-aubergine/30 mb-3">{config.description}</p>
        <div className="flex items-center justify-center h-36 text-xs font-sans text-aubergine/20">
          No data yet
        </div>
      </div>
    )
  }

  const latest = chartData[chartData.length - 1].value
  const first = chartData[0].value
  const change = latest - first
  const improved = config.higherIsBetter ? change > 0 : change < 0

  // Compute Y-axis domain
  const values = chartData.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const yDomain: [number | string, number | string] = [
    typeof config.domain[0] === 'number' ? config.domain[0] : Math.floor(minVal - 5),
    typeof config.domain[1] === 'string' ? Math.ceil(maxVal + 5) : config.domain[1],
  ]

  return (
    <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h4 className="text-sm font-sans font-medium text-aubergine">{config.label}</h4>
          <p className="text-xs font-sans text-aubergine/30">{config.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-lg font-sans font-semibold text-aubergine">
            {config.key === 'temperature_deviation'
              ? `${latest > 0 ? '+' : ''}${latest.toFixed(2)}`
              : Math.round(latest)}
          </span>
          <span className="text-xs font-sans text-aubergine/40">{config.suffix}</span>
          {chartData.length >= 3 && Math.abs(change) > 0.1 && (
            <span className={`text-xs font-sans px-1.5 py-0.5 rounded-pill ${
              improved
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-red-500 bg-red-50'
            }`}>
              {improved ? (config.higherIsBetter ? '↑' : '↓') : (config.higherIsBetter ? '↓' : '↑')}
              {config.key === 'temperature_deviation'
                ? Math.abs(change).toFixed(2)
                : Math.abs(Math.round(change))}
            </span>
          )}
        </div>
      </div>
      <div className="h-36 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${config.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#280f4910" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#280f4950', fontFamily: 'Plus Jakarta Sans' }}
              axisLine={{ stroke: '#280f4910' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={yDomain}
              ticks={config.ticks}
              tick={{ fontSize: 11, fill: '#280f4930', fontFamily: 'Plus Jakarta Sans' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<MetricTooltip config={config} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2.5}
              fill={`url(#gradient-${config.key})`}
              dot={{ r: 3, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Summary stats below the charts
function SleepBreakdown({ data }: { data: MetricRow[] }) {
  const types = ['sleep_deep_minutes', 'sleep_rem_minutes', 'sleep_light_minutes', 'sleep_total_minutes'] as const
  const labels: Record<string, string> = {
    sleep_deep_minutes: 'Deep Sleep',
    sleep_rem_minutes: 'REM Sleep',
    sleep_light_minutes: 'Light Sleep',
    sleep_total_minutes: 'Total Sleep',
  }
  const colors: Record<string, string> = {
    sleep_deep_minutes: 'text-violet',
    sleep_rem_minutes: 'text-[#4ECDC4]',
    sleep_light_minutes: 'text-aubergine/50',
    sleep_total_minutes: 'text-aubergine',
  }

  // Get latest day's data
  const latestDate = data
    .filter(d => types.includes(d.metric_type as any))
    .sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0]?.metric_date

  if (!latestDate) return null

  const latestData = data.filter(d => d.metric_date === latestDate && types.includes(d.metric_type as any))
  if (latestData.length === 0) return null

  function formatMinutes(mins: number): string {
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5">
      <h4 className="text-sm font-sans font-medium text-aubergine mb-3">Last Night&apos;s Sleep Breakdown</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {types.map(type => {
          const row = latestData.find(d => d.metric_type === type)
          if (!row) return null
          return (
            <div key={type} className="text-center">
              <p className={`text-lg font-sans font-semibold ${colors[type]}`}>{formatMinutes(row.value)}</p>
              <p className="text-xs font-sans text-aubergine/40 mt-0.5">{labels[type]}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WearableTrends({ patientId, dateRange = 30 }: WearableTrendsProps) {
  const [metrics, setMetrics] = useState<MetricRow[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(dateRange)
  const autoSyncTriggered = useRef(false)

  useEffect(() => {
    // Auto-sync on mount if last sync was more than 6 hours ago
    if (!autoSyncTriggered.current) {
      autoSyncTriggered.current = true
      autoSync()
    }
  }, [patientId])

  useEffect(() => {
    fetchMetrics()
  }, [patientId, range])

  async function autoSync() {
    try {
      const statusRes = await fetch(`/api/wearables/status?patientId=${patientId}`)
      const status = await statusRes.json()
      if (!status.connected) return

      const lastSynced = status.lastSyncedAt ? new Date(status.lastSyncedAt).getTime() : 0
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000

      if (lastSynced < sixHoursAgo) {
        // Sync last 7 days in background, then refresh charts
        await fetch('/api/wearables/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId, days: 7 }),
        })
        fetchMetrics()
      }
    } catch (err) {
      console.error('Auto-sync failed:', err)
    }
  }

  async function fetchMetrics() {
    setLoading(true)
    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const res = await fetch(`/api/wearables/metrics?patientId=${patientId}&startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      setMetrics(data.metrics || [])
    } catch (err) {
      console.error('Failed to fetch wearable metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5 animate-pulse">
              <div className="h-4 bg-aubergine/5 rounded w-32 mb-2" />
              <div className="h-3 bg-aubergine/5 rounded w-48 mb-4" />
              <div className="h-36 bg-aubergine/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (metrics.length === 0) {
    return (
      <div className="bg-white rounded-card p-8 shadow-sm border border-aubergine/5 text-center">
        <p className="text-sm font-sans text-aubergine/40">No wearable data yet. Data will appear after your Oura Ring syncs.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Date range selector */}
      <div className="flex justify-end gap-1">
        {[7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setRange(d)}
            className={`text-xs font-sans font-medium px-3 py-1.5 rounded-pill transition-colors ${
              range === d
                ? 'bg-violet text-white'
                : 'text-aubergine/40 hover:text-aubergine/60 border border-aubergine/10 hover:border-aubergine/20'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* 2x2 chart grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CHART_CONFIG.map(config => (
          <MetricChart key={config.key} data={metrics} config={config} />
        ))}
      </div>

      {/* Sleep breakdown stats */}
      <SleepBreakdown data={metrics} />
    </div>
  )
}
