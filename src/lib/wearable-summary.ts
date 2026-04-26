import { db } from '@/lib/db'
import { wearable_metrics } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'

export interface WearableSummary {
  sleepScore?: { avg: number; trend: 'improving' | 'stable' | 'declining' }
  hrv?: { avg: number; trend: 'improving' | 'stable' | 'declining' }
  readinessScore?: { avg: number; trend: 'improving' | 'stable' | 'declining' }
  restingHeartRate?: { avg: number; trend: 'improving' | 'stable' | 'declining' }
  temperatureDeviation?: { avg: number }
}

const METRIC_KEYS = [
  'sleep_score',
  'hrv_average',
  'readiness_score',
  'resting_heart_rate',
  'temperature_deviation',
] as const

type MetricKey = typeof METRIC_KEYS[number]

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function trend(firstHalfAvg: number, secondHalfAvg: number): 'improving' | 'stable' | 'declining' {
  const delta = secondHalfAvg - firstHalfAvg
  const pct = Math.abs(delta) / (firstHalfAvg || 1)
  if (pct < 0.05) return 'stable'
  return delta > 0 ? 'improving' : 'declining'
}

// For resting heart rate, lower is better — invert the trend direction
function trendHR(firstHalfAvg: number, secondHalfAvg: number): 'improving' | 'stable' | 'declining' {
  const delta = secondHalfAvg - firstHalfAvg
  const pct = Math.abs(delta) / (firstHalfAvg || 1)
  if (pct < 0.05) return 'stable'
  return delta < 0 ? 'improving' : 'declining'
}

export async function buildWearableSummary(
  patientId: string,
  endDate: Date = new Date()
): Promise<WearableSummary | null> {
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 30)

  const rows = await db
    .select({
      metric_type: wearable_metrics.metric_type,
      metric_date: wearable_metrics.metric_date,
      value: wearable_metrics.value,
    })
    .from(wearable_metrics)
    .where(
      and(
        eq(wearable_metrics.patient_id, patientId),
        gte(wearable_metrics.metric_date, toISODate(startDate)),
        lte(wearable_metrics.metric_date, toISODate(endDate))
      )
    )

  if (!rows.length) return null

  // Group by metric type
  const grouped: Record<string, Array<{ date: string; value: number }>> = {}
  for (const row of rows) {
    if (!grouped[row.metric_type]) grouped[row.metric_type] = []
    grouped[row.metric_type].push({ date: row.metric_date, value: row.value })
  }

  function summarize(
    key: MetricKey,
    invertTrend = false
  ): { avg: number; trend: 'improving' | 'stable' | 'declining' } | undefined {
    const data = grouped[key]
    if (!data?.length) return undefined
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
    const mid = Math.floor(sorted.length / 2)
    const first = sorted.slice(0, mid)
    const second = sorted.slice(mid)
    const avg = (arr: typeof sorted) => arr.reduce((s, r) => s + r.value, 0) / arr.length
    const firstAvg = first.length ? avg(first) : avg(sorted)
    const secondAvg = second.length ? avg(second) : avg(sorted)
    const overallAvg = avg(sorted)
    return {
      avg: Math.round(overallAvg * 10) / 10,
      trend: invertTrend ? trendHR(firstAvg, secondAvg) : trend(firstAvg, secondAvg),
    }
  }

  const summary: WearableSummary = {}

  const sleepScore = summarize('sleep_score')
  if (sleepScore) summary.sleepScore = sleepScore

  const hrv = summarize('hrv_average')
  if (hrv) summary.hrv = hrv

  const readiness = summarize('readiness_score')
  if (readiness) summary.readinessScore = readiness

  const hr = summarize('resting_heart_rate', true)
  if (hr) summary.restingHeartRate = hr

  const tempData = grouped['temperature_deviation']
  if (tempData?.length) {
    const avgTemp = tempData.reduce((s, r) => s + r.value, 0) / tempData.length
    summary.temperatureDeviation = { avg: Math.round(avgTemp * 100) / 100 }
  }

  if (!Object.keys(summary).length) return null
  return summary
}
