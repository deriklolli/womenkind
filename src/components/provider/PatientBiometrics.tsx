'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface PatientBiometricsProps {
  patientId: string
  visits?: { visit_date: string; visit_type: string }[]
  prescriptions?: { medication_name: string; prescribed_at: string | null }[]
}

interface MetricRow {
  metric_date: string
  metric_type: string
  value: number
}

interface ConnectionStatus {
  connected: boolean
  provider: string | null
  lastSyncedAt: string | null
}

const CHART_CONFIG: {
  key: string
  label: string
  suffix: string
  domain: [number, number | string]
  ticks: number[] | undefined
  color: string
  higherIsBetter: boolean
}[] = [
  {
    key: 'sleep_score',
    label: 'Sleep Quality',
    suffix: '/100',
    domain: [0, 100],
    ticks: [0, 25, 50, 75, 100],
    color: '#944fed',
    higherIsBetter: true,
  },
  {
    key: 'temperature_deviation',
    label: 'Skin Temperature Deviation',
    suffix: '°C',
    domain: [-2, 2],
    ticks: [-2, -1, 0, 1, 2],
    color: '#d85623',
    higherIsBetter: false,
  },
  {
    key: 'hrv_average',
    label: 'Heart Rate Variability',
    suffix: ' ms',
    domain: [0, 'auto'],
    ticks: undefined,
    color: '#4ECDC4',
    higherIsBetter: true,
  },
  {
    key: 'resting_heart_rate',
    label: 'Resting Heart Rate',
    suffix: ' bpm',
    domain: [40, 'auto'],
    ticks: undefined,
    color: '#e05286',
    higherIsBetter: false,
  },
  {
    key: 'readiness_score',
    label: 'Readiness Score',
    suffix: '/100',
    domain: [0, 100],
    ticks: [0, 25, 50, 75, 100],
    color: '#F59E0B',
    higherIsBetter: true,
  },
  {
    key: 'respiratory_rate',
    label: 'Respiratory Rate',
    suffix: ' br/min',
    domain: [10, 'auto'],
    ticks: undefined,
    color: '#6366F1',
    higherIsBetter: false,
  },
  {
    key: 'sleep_efficiency',
    label: 'Sleep Efficiency',
    suffix: '%',
    domain: [50, 100],
    ticks: [50, 60, 70, 80, 90, 100],
    color: '#8B5CF6',
    higherIsBetter: true,
  },
  {
    key: 'sleep_deep_minutes',
    label: 'Deep Sleep',
    suffix: ' min',
    domain: [0, 'auto'],
    ticks: undefined,
    color: '#280f49',
    higherIsBetter: true,
  },
  {
    key: 'sleep_rem_minutes',
    label: 'REM Sleep',
    suffix: ' min',
    domain: [0, 'auto'],
    ticks: undefined,
    color: '#4ECDC4',
    higherIsBetter: true,
  },
]

/** Returns a short clinical insight for the provider based on the latest metric value. */
function getProviderInsight(key: string, latest: number, avg: number, dataPoints: number): { text: string; tone: 'good' | 'caution' | 'neutral' } {
  if (dataPoints < 3) return { text: 'Insufficient data — 3+ days needed for trends.', tone: 'neutral' }

  switch (key) {
    case 'sleep_score':
      if (avg >= 85) return { text: 'Consistently high sleep quality. Current treatment is well-tolerated.', tone: 'good' }
      if (avg >= 70) return { text: 'Sleep is adequate. Monitor for correlation with symptom reports.', tone: 'neutral' }
      return { text: 'Chronic poor sleep — consider sleep hygiene counseling or medication review.', tone: 'caution' }

    case 'temperature_deviation':
      if (Math.abs(avg) <= 0.3) return { text: 'Thermoregulation is stable. No vasomotor concerns.', tone: 'good' }
      if (Math.abs(avg) <= 0.7) return { text: 'Mild fluctuations consistent with perimenopause.', tone: 'neutral' }
      return { text: 'Significant thermal instability — may indicate active vasomotor symptoms.', tone: 'caution' }

    case 'hrv_average':
      if (avg >= 40) return { text: 'Strong autonomic function and stress resilience.', tone: 'good' }
      if (avg >= 25) return { text: 'Moderate HRV — within normal range for age group.', tone: 'neutral' }
      return { text: 'Low HRV may reflect chronic stress or autonomic dysfunction.', tone: 'caution' }

    case 'resting_heart_rate':
      if (avg <= 60) return { text: 'Excellent cardiovascular baseline.', tone: 'good' }
      if (avg <= 72) return { text: 'Resting heart rate is within normal limits.', tone: 'neutral' }
      return { text: 'Elevated RHR — assess for anxiety, deconditioning, or thyroid changes.', tone: 'caution' }

    case 'readiness_score':
      if (avg >= 80) return { text: 'Patient is recovering well between days. Treatment tolerance is good.', tone: 'good' }
      if (avg >= 60) return { text: 'Moderate recovery capacity. May benefit from lifestyle adjustments.', tone: 'neutral' }
      return { text: 'Consistently low readiness — consider systemic stressors or treatment burden.', tone: 'caution' }

    case 'respiratory_rate':
      if (avg >= 12 && avg <= 16) return { text: 'Optimal nocturnal respiratory rate.', tone: 'good' }
      if (avg >= 10 && avg <= 20) return { text: 'Respiratory rate is within acceptable range.', tone: 'neutral' }
      return { text: 'Abnormal breathing pattern during sleep — screen for sleep apnea.', tone: 'caution' }

    case 'sleep_efficiency':
      if (avg >= 85) return { text: 'Minimal sleep disruption. No intervention needed.', tone: 'good' }
      if (avg >= 75) return { text: 'Some fragmentation present — may correlate with night sweats.', tone: 'neutral' }
      return { text: 'Significant sleep disruption — evaluate for insomnia or nocturnal symptoms.', tone: 'caution' }

    case 'sleep_deep_minutes':
      if (avg >= 60) return { text: 'Adequate deep sleep for physical recovery and hormone release.', tone: 'good' }
      if (avg >= 30) return { text: 'Reduced deep sleep — common in menopause, monitor trend.', tone: 'neutral' }
      return { text: 'Deep sleep deficit — may impact growth hormone and tissue repair.', tone: 'caution' }

    case 'sleep_rem_minutes':
      if (avg >= 90) return { text: 'Healthy REM duration supporting cognitive and emotional health.', tone: 'good' }
      if (avg >= 50) return { text: 'REM is moderate — watch for mood or cognition complaints.', tone: 'neutral' }
      return { text: 'Low REM may contribute to brain fog and emotional lability.', tone: 'caution' }

    default:
      return { text: '', tone: 'neutral' }
  }
}

const PROVIDER_INSIGHT_COLORS = {
  good: 'text-aubergine/35',
  caution: 'text-aubergine/35',
  neutral: 'text-aubergine/35',
}

function ProviderMetricTooltip({ active, payload, label, config }: any) {
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

function ProviderMetricChart({
  data,
  config,
  visitDates,
  rxDates,
}: {
  data: MetricRow[]
  config: (typeof CHART_CONFIG)[number]
  visitDates: string[]
  rxDates: { date: string; label: string }[]
}) {
  const chartData = data
    .filter(d => d.metric_type === config.key)
    .sort((a, b) => new Date(a.metric_date).getTime() - new Date(b.metric_date).getTime())
    .map(d => ({
      date: new Date(d.metric_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rawDate: d.metric_date,
      value: d.value,
    }))

  if (chartData.length === 0) return null

  const latest = chartData[chartData.length - 1].value
  const first = chartData[0].value
  const change = latest - first
  const improved = config.higherIsBetter ? change > 0 : change < 0
  const avg = chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length
  const insight = getProviderInsight(config.key, latest, avg, chartData.length)

  const values = chartData.map(d => d.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const yDomain: [number | string, number | string] = [
    typeof config.domain[0] === 'number' ? config.domain[0] : Math.floor(minVal - 5),
    typeof config.domain[1] === 'string' ? Math.ceil(maxVal + 5) : config.domain[1],
  ]

  // Map visit dates to chart x-axis labels
  const visitLabels = visitDates
    .map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    .filter(label => chartData.some(cd => cd.date === label))

  return (
    <div className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-sans font-medium text-aubergine">{config.label}</h4>
        <div className="flex items-center gap-2">
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
              improved ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'
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
        <p className={`text-xs font-sans mt-1 mb-2 ${PROVIDER_INSIGHT_COLORS[insight.tone]}`}>
          {insight.text}
        </p>
      )}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`prov-gradient-${config.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={config.color} stopOpacity={0.03} />
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
            <Tooltip content={<ProviderMetricTooltip config={config} />} />
            {/* Visit date markers */}
            {visitLabels.map((label, i) => (
              <ReferenceLine
                key={`visit-${i}`}
                x={label}
                stroke="#944fed"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
            ))}
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2.5}
              fill={`url(#prov-gradient-${config.key})`}
              fillOpacity={1}
              baseValue={config.key === 'temperature_deviation' ? 0 : undefined}
              dot={{ r: 3, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function PatientBiometrics({ patientId, visits = [], prescriptions = [] }: PatientBiometricsProps) {
  const [metrics, setMetrics] = useState<MetricRow[]>([])
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(30)

  useEffect(() => {
    fetchAll()
  }, [patientId, range])

  async function fetchAll() {
    setLoading(true)
    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [metricsRes, statusRes] = await Promise.all([
        fetch(`/api/wearables/metrics?patientId=${patientId}&startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/wearables/status?patientId=${patientId}`),
      ])

      const metricsData = await metricsRes.json()
      const statusData = await statusRes.json()

      setMetrics(metricsData.metrics || [])
      setStatus(statusData)
    } catch (err) {
      console.error('Failed to fetch biometrics:', err)
    } finally {
      setLoading(false)
    }
  }

  const visitDates = visits.map(v => v.visit_date)
  const rxDates = prescriptions
    .filter(p => p.prescribed_at)
    .map(p => ({ date: p.prescribed_at!, label: p.medication_name }))

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-card p-5 shadow-sm border border-aubergine/5 animate-pulse">
            <div className="h-4 bg-aubergine/5 rounded w-32 mb-4" />
            <div className="h-40 bg-aubergine/5 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!status?.connected && metrics.length === 0) {
    return (
      <div className="bg-white rounded-card p-8 shadow-sm border border-aubergine/5 text-center">
        <div className="w-12 h-12 rounded-full bg-aubergine/5 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-aubergine/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h3 className="font-sans text-sm font-medium text-aubergine mb-1">No Wearable Connected</h3>
        <p className="text-xs font-sans text-aubergine/40 max-w-sm mx-auto">
          This patient has not connected a wearable device. Biometric data will appear here once they connect their Oura Ring from the patient dashboard.
        </p>
      </div>
    )
  }

  // Compute summary stats
  const sleepScores = metrics.filter(m => m.metric_type === 'sleep_score').map(m => m.value)
  const tempDeviations = metrics.filter(m => m.metric_type === 'temperature_deviation').map(m => Math.abs(m.value))
  const avgSleep = sleepScores.length > 0 ? Math.round(sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length) : null
  const tempSpikes = tempDeviations.filter(v => v > 0.5).length

  return (
    <div className="space-y-4">
      {/* Status bar + range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status?.connected && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4ECDC4]/10 border border-[#4ECDC4]/20 text-xs font-sans text-[#4ECDC4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4]" />
              Oura Ring Connected
            </span>
          )}
          {status?.lastSyncedAt && (
            <span className="text-xs font-sans text-aubergine/30">
              Last synced {new Date(status.lastSyncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex gap-1">
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
      </div>

      {/* Quick summary stats */}
      {(avgSleep !== null || tempSpikes > 0) && (
        <div className="flex gap-3">
          {avgSleep !== null && (
            <div className="flex-1 bg-white rounded-card p-4 shadow-sm border border-aubergine/5">
              <p className="text-xs font-sans text-aubergine/40 mb-1">Avg Sleep Score</p>
              <p className="text-xl font-sans font-semibold text-aubergine">{avgSleep}<span className="text-xs text-aubergine/30 ml-0.5">/100</span></p>
            </div>
          )}
          <div className="flex-1 bg-white rounded-card p-4 shadow-sm border border-aubergine/5">
            <p className="text-xs font-sans text-aubergine/40 mb-1">Temp Spikes (&gt;0.5°C)</p>
            <p className="text-xl font-sans font-semibold text-aubergine">{tempSpikes}<span className="text-xs text-aubergine/30 ml-0.5"> in {range}d</span></p>
          </div>
          <div className="flex-1 bg-white rounded-card p-4 shadow-sm border border-aubergine/5">
            <p className="text-xs font-sans text-aubergine/40 mb-1">Data Points</p>
            <p className="text-xl font-sans font-semibold text-aubergine">{metrics.length}</p>
          </div>
        </div>
      )}

      {/* Legend for visit markers */}
      {visitDates.length > 0 && (
        <div className="flex items-center gap-4 text-xs font-sans text-aubergine/40">
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-violet/40" />
            Visit dates
          </span>
        </div>
      )}

      {/* Full-width stacked charts */}
      <div className="grid grid-cols-1 gap-4">
        {CHART_CONFIG.map(config => (
          <ProviderMetricChart
            key={config.key}
            data={metrics}
            config={config}
            visitDates={visitDates}
            rxDates={rxDates}
          />
        ))}
      </div>
    </div>
  )
}
