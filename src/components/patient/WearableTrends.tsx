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
  onGoToSettings?: () => void
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
    label: 'Skin Temp',
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
  {
    key: 'readiness_score',
    label: 'Readiness Score',
    unit: '',
    suffix: '/100',
    domain: [0, 100],
    ticks: [0, 25, 50, 75, 100],
    color: '#F59E0B',
    higherIsBetter: true,
    description: 'Daily recovery score — how prepared your body is for the day',
  },
  {
    key: 'respiratory_rate',
    label: 'Respiratory Rate',
    unit: 'br/min',
    suffix: ' br/min',
    domain: [10, 'auto'],
    ticks: undefined,
    color: '#6366F1',
    higherIsBetter: false,
    description: 'Average breathing rate during sleep',
  },
  {
    key: 'sleep_efficiency',
    label: 'Sleep Efficiency',
    unit: '%',
    suffix: '%',
    domain: [50, 100],
    ticks: [50, 60, 70, 80, 90, 100],
    color: '#8B5CF6',
    higherIsBetter: true,
    description: 'Percentage of time in bed actually spent sleeping',
  },
  {
    key: 'sleep_deep_minutes',
    label: 'Deep Sleep',
    unit: 'min',
    suffix: ' min',
    domain: [0, 'auto'],
    ticks: undefined,
    color: '#280f49',
    higherIsBetter: true,
    description: 'Time in deep sleep — essential for physical recovery',
  },
  {
    key: 'sleep_rem_minutes',
    label: 'REM Sleep',
    unit: 'min',
    suffix: ' min',
    domain: [0, 'auto'],
    ticks: undefined,
    color: '#4ECDC4',
    higherIsBetter: true,
    description: 'Time in REM sleep — important for memory and mood regulation',
  },
]

/** Returns a short insight line based on the latest metric value and trend. */
function getMetricInsight(key: string, latest: number, avg: number, dataPoints: number): { text: string; tone: 'good' | 'caution' | 'neutral' } {
  if (dataPoints < 3) return { text: 'Collecting data — check back in a few days.', tone: 'neutral' }

  switch (key) {
    case 'sleep_score':
      if (latest >= 85) return { text: 'Excellent sleep quality. Keep up your current routine.', tone: 'good' }
      if (latest >= 70) return { text: 'Decent sleep, but there may be room to improve consistency.', tone: 'neutral' }
      return { text: 'Your sleep quality has been low — consider discussing this with Dr. Urban.', tone: 'caution' }

    case 'temperature_deviation':
      if (Math.abs(latest) <= 0.3) return { text: 'Skin temperature is stable and close to your baseline.', tone: 'good' }
      if (Math.abs(latest) <= 0.7) return { text: 'Mild temperature variation — this can be normal during hormonal shifts.', tone: 'neutral' }
      return { text: 'Notable temperature deviation — worth mentioning at your next visit.', tone: 'caution' }

    case 'hrv_average':
      if (latest >= 40) return { text: 'Healthy HRV indicating good recovery and stress resilience.', tone: 'good' }
      if (latest >= 25) return { text: 'HRV is moderate — prioritizing rest and stress management can help.', tone: 'neutral' }
      return { text: 'HRV is on the low side — this may reflect elevated stress or poor recovery.', tone: 'caution' }

    case 'resting_heart_rate':
      if (latest <= 60) return { text: 'Great resting heart rate — a sign of good cardiovascular fitness.', tone: 'good' }
      if (latest <= 72) return { text: 'Resting heart rate is in a normal range.', tone: 'neutral' }
      return { text: 'Elevated resting heart rate — stress, caffeine, or poor sleep could be factors.', tone: 'caution' }

    case 'readiness_score':
      if (latest >= 80) return { text: 'Your body is well-recovered and ready for the day.', tone: 'good' }
      if (latest >= 60) return { text: 'Moderate readiness — consider a lighter day if possible.', tone: 'neutral' }
      return { text: 'Low readiness — your body may need extra rest today.', tone: 'caution' }

    case 'respiratory_rate':
      if (latest >= 12 && latest <= 16) return { text: 'Breathing rate is in an optimal range during sleep.', tone: 'good' }
      if (latest >= 10 && latest <= 20) return { text: 'Respiratory rate is within normal bounds.', tone: 'neutral' }
      return { text: 'Unusual breathing rate — could indicate stress or a developing illness.', tone: 'caution' }

    case 'sleep_efficiency':
      if (latest >= 85) return { text: 'High sleep efficiency — you\'re spending your time in bed well.', tone: 'good' }
      if (latest >= 75) return { text: 'Room to improve — frequent waking may be reducing sleep quality.', tone: 'neutral' }
      return { text: 'Low efficiency suggests disrupted sleep — night sweats or insomnia may be a factor.', tone: 'caution' }

    case 'sleep_deep_minutes':
      if (latest >= 60) return { text: 'Strong deep sleep — essential for physical repair and hormone regulation.', tone: 'good' }
      if (latest >= 30) return { text: 'Moderate deep sleep — this stage often decreases during menopause.', tone: 'neutral' }
      return { text: 'Low deep sleep — this is common with hormonal changes and worth discussing.', tone: 'caution' }

    case 'sleep_rem_minutes':
      if (latest >= 90) return { text: 'Plenty of REM sleep — great for memory, mood, and emotional balance.', tone: 'good' }
      if (latest >= 50) return { text: 'REM sleep is adequate but could be better with consistent bedtimes.', tone: 'neutral' }
      return { text: 'Low REM sleep may affect mood and cognitive clarity.', tone: 'caution' }

    default:
      return { text: '', tone: 'neutral' }
  }
}

const INSIGHT_COLORS = {
  good: 'text-aubergine/35',
  caution: 'text-aubergine/35',
  neutral: 'text-aubergine/35',
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg
        className="w-3.5 h-3.5 text-aubergine/25 hover:text-aubergine/40 transition-colors cursor-help"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
      </svg>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-aubergine text-white text-xs font-sans leading-relaxed whitespace-nowrap shadow-lg z-20 pointer-events-none">
          {text}
        </span>
      )}
    </span>
  )
}

function MetricTooltip({ active, payload, label, config }: any) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  const formatted = config.key === 'temperature_deviation'
    ? `${val > 0 ? '+' : ''}${val.toFixed(2)}${config.suffix}`
    : config.key === 'respiratory_rate'
      ? `${val.toFixed(1)}${config.suffix}`
      : `${Math.round(val)}${config.suffix}`

  return (
    <div className="bg-white rounded-brand shadow-lg border border-aubergine/10 px-3 py-2">
      <p className="text-xs font-sans text-aubergine/50 mb-1">{label}</p>
      <p className="text-sm font-sans font-semibold" style={{ color: config.color }}>
        {formatted}
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

  if (chartData.length === 0) return null

  const latest = chartData[chartData.length - 1].value
  const first = chartData[0].value
  const change = latest - first
  const improved = config.higherIsBetter ? change > 0 : change < 0
  const avg = chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length
  const insight = getMetricInsight(config.key, latest, avg, chartData.length)

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
        <div className="flex items-center gap-1.5">
          <h4 className="text-sm font-sans font-medium text-aubergine">{config.label}</h4>
          <InfoTooltip text={config.description} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-lg font-sans font-semibold text-aubergine">
            {config.key === 'temperature_deviation'
              ? `${latest > 0 ? '+' : ''}${latest.toFixed(2)}`
              : config.key === 'respiratory_rate'
                ? latest.toFixed(1)
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
                : config.key === 'respiratory_rate'
                  ? Math.abs(change).toFixed(1)
                  : Math.abs(Math.round(change))}
            </span>
          )}
        </div>
      </div>
      {insight.text && (
        <p className={`text-xs font-sans mt-1 ${INSIGHT_COLORS[insight.tone]}`}>
          {insight.text}
        </p>
      )}
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
              baseValue={typeof yDomain[0] === 'number' ? yDomain[0] : undefined}
              dot={{ r: 3, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function WearableTrends({ patientId, dateRange = 30, onGoToSettings }: WearableTrendsProps) {
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
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
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
      <div className="bg-white rounded-card p-10 shadow-sm border border-aubergine/5 text-center">
        <div className="w-14 h-14 rounded-full bg-violet/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-violet/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h3 className="font-sans text-sm font-semibold text-aubergine mb-1">No Health Data Yet</h3>
        <p className="text-sm font-sans text-aubergine/40 max-w-sm mx-auto mb-5">
          Connect your Oura Ring in Settings to automatically track sleep, temperature, HRV, and heart rate between visits.
        </p>
        {onGoToSettings && (
          <button
            onClick={onGoToSettings}
            className="bg-violet hover:bg-violet/90 text-white text-sm font-sans font-medium px-5 py-2.5 rounded-pill transition-colors"
          >
            Go to Settings
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Wearable source tabs */}
      <div className="flex items-center gap-2">
        {[{ key: 'oura', label: 'Oura Ring' }].map(tab => (
          <button
            key={tab.key}
            className="flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-sans font-medium bg-aubergine text-white shadow-sm"
          >
            <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" strokeLinecap="round" />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date pills + chart grid wrapper — negative top margin pulls charts up to align with sidebar */}
      <div className="-mt-[34px]">
        {/* Date range selector — right-aligned, compact row above charts */}
        <div className="flex justify-end gap-1 mb-1.5 -mt-[15px]">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`text-xs font-sans font-medium px-3 py-1 rounded-pill transition-colors ${
                range === d
                  ? 'bg-violet text-white shadow-sm'
                  : 'text-aubergine/40 hover:text-aubergine/60 border border-aubergine/10 hover:border-aubergine/20'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4">
          {CHART_CONFIG.map(config => (
            <MetricChart key={config.key} data={metrics} config={config} />
          ))}
        </div>
      </div>

    </div>
  )
}
