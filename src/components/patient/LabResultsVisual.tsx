'use client'

import { useMemo } from 'react'

interface LabResultItem {
  testCode: string
  testName: string
  value: string
  unit: string
  referenceRange: string
  flag: 'normal' | 'high' | 'low' | 'critical' | null
}

interface LabResultsVisualProps {
  results: LabResultItem[]
}

/* ── helpers ─────────────────────────────────────────────────────────── */

/** Parse "23-116 mIU/mL" → { low: 23, high: 116 } */
function parseRange(range: string): { low: number; high: number } | null {
  const m = range.match(/([\d.]+)\s*[-–]\s*([\d.]+)/)
  if (!m) return null
  return { low: parseFloat(m[1]), high: parseFloat(m[2]) }
}

/** Strip the unit from a reference range string → "3.5-12.5" */
function rangeNumbers(range: string): string {
  const m = range.match(/([\d.]+\s*[-–]\s*[\d.]+)/)
  return m ? m[1] : range
}

/** Returns 0-1 position within the visible bar (35 % padding each side). */
function normalise(value: number, rangeLow: number, rangeHigh: number): number {
  const span = rangeHigh - rangeLow
  const pad = span * 0.35
  const min = rangeLow - pad
  const max = rangeHigh + pad
  const clamped = Math.min(Math.max(value, min), max)
  return (clamped - min) / (max - min)
}

/* ── colour helpers ──────────────────────────────────────────────────── */

const FLAG_META: Record<string, { color: string; glow: string; label: string }> = {
  normal:   { color: '#944fed', glow: 'rgba(148,79,237,0.2)',  label: 'In Range' },
  high:     { color: '#d85623', glow: 'rgba(216,86,35,0.25)',  label: 'High' },
  low:      { color: '#d85623', glow: 'rgba(216,86,35,0.25)',  label: 'Low' },
  critical: { color: '#dc2626', glow: 'rgba(220,38,38,0.3)',   label: 'Critical' },
}

function getMeta(flag: string | null) {
  return FLAG_META[flag || 'normal'] || FLAG_META.normal
}

/* ── Single range row ────────────────────────────────────────────────── */

function RangeRow({ result }: { result: LabResultItem }) {
  const range = parseRange(result.referenceRange)
  const numVal = parseFloat(result.value)

  if (!range || isNaN(numVal)) return null

  const pct = normalise(numVal, range.low, range.high)
  const flag = result.flag || 'normal'
  const meta = getMeta(flag)
  const isFlagged = flag !== 'normal'

  // Where the "normal zone" sits on the bar
  const zonePctLeft = normalise(range.low, range.low, range.high)
  const zonePctRight = normalise(range.high, range.low, range.high)

  return (
    <div className={`rounded-brand px-4 py-3 ${isFlagged ? 'bg-aubergine/[0.02]' : ''}`}>
      {/* Top line — test name + value + flag */}
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm font-sans font-medium text-aubergine">
          {result.testName}
        </span>
        <div className="flex items-baseline gap-2 flex-shrink-0">
          <span
            className="text-sm font-sans font-semibold tabular-nums"
            style={{ color: meta.color }}
          >
            {result.value}
            <span className="text-[11px] font-normal text-aubergine/30 ml-0.5">{result.unit}</span>
          </span>
          {isFlagged && (
            <span
              className="text-[10px] font-sans font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-pill"
              style={{ color: meta.color, backgroundColor: `${meta.color}10` }}
            >
              {meta.label}
            </span>
          )}
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-[14px]">
        {/* Track */}
        <div className="absolute inset-y-[5px] left-0 right-0 rounded-full bg-aubergine/[0.04]" />

        {/* Normal zone */}
        <div
          className="absolute inset-y-[3px] rounded-full"
          style={{
            left: `${zonePctLeft * 100}%`,
            right: `${(1 - zonePctRight) * 100}%`,
            backgroundColor: '#ede5fb',
          }}
        />

        {/* Dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[12px] h-[12px] rounded-full transition-all duration-500"
          style={{
            left: `${pct * 100}%`,
            backgroundColor: meta.color,
          }}
        />
      </div>

      {/* Reference range label */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-sans text-aubergine/40">
          Normal: {rangeNumbers(result.referenceRange)} {result.unit}
        </span>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function LabResultsVisual({ results }: LabResultsVisualProps) {
  const visualisable = useMemo(
    () => results.filter((r) => parseRange(r.referenceRange) && !isNaN(parseFloat(r.value))),
    [results],
  )

  if (visualisable.length === 0) return null

  return (
    <div>
      {/* Range rows */}
      <div className="space-y-1">
        {visualisable.map((r) => (
          <RangeRow key={r.testCode} result={r} />
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-5 p-4 rounded-brand bg-violet/5 border border-violet/10">
        <p className="text-xs font-sans text-violet/70 leading-relaxed">
          These results have been reviewed by Dr. Urban. Flagged values are highlighted
          for your awareness — they don&apos;t necessarily indicate a problem. Your provider
          will discuss any findings during your next visit.
        </p>
      </div>
    </div>
  )
}
