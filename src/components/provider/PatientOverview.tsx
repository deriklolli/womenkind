'use client'

import { useMemo } from 'react'
import { Flame, Moon, Zap, SmilePlus, Droplets } from 'lucide-react'

interface Visit {
  id: string
  visit_type: string
  visit_date: string
  symptom_scores?: Record<string, number>
  provider_notes?: string | null
  treatment_updates?: string | null
}

interface Prescription {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  status: string
}

interface WMIScores {
  wmi: number
  wmi_label: string
  wmi_message: string
  wmi_band: string
  phenotype: string
  safety_flags: string[]
  vms: number; sleep: number; mams: number; cog: number
  gsm: number; hsdd: number; cardio: number; msk: number
}

interface PatientOverviewProps {
  visits: Visit[]
  prescriptions: Prescription[]
  latestIntake?: {
    ai_brief?: {
      metadata?: { symptom_burden?: string; menopausal_stage?: string }
      summary?: string
    }
    wmi_scores?: WMIScores | null
  } | null
}

const DOMAINS = [
  {
    key: 'vasomotor', label: 'Vasomotor', Icon: Flame, color: '#d85623',
    subtitle: 'Hot-flash frequency',
    improvesDown: true,
    tags: { improving: 'Slow taper', watch: 'Increasing', steady: 'Holding steady' },
  },
  {
    key: 'sleep', label: 'Sleep', Icon: Moon, color: '#5d9ed5',
    subtitle: 'Sleep quality score',
    improvesDown: false,
    tags: { improving: 'Deeper cycles', watch: 'Disrupted', steady: 'Consistent' },
  },
  {
    key: 'energy', label: 'Energy', Icon: Zap, color: '#e8a838',
    subtitle: 'Daily energy level',
    improvesDown: false,
    tags: { improving: 'Rising steadily', watch: 'Fatigue rising', steady: 'Steady energy' },
  },
  {
    key: 'mood', label: 'Mood', Icon: SmilePlus, color: '#944fed',
    subtitle: 'Self-rated, journaled',
    improvesDown: false,
    tags: { improving: 'Steadier days', watch: 'More variable', steady: 'Consistent' },
  },
  {
    key: 'gsm', label: 'Hormonal', Icon: Droplets, color: '#c2796d',
    subtitle: 'GSM symptom score',
    improvesDown: true,
    tags: { improving: 'On target', watch: 'Watch closely', steady: 'Stable' },
  },
]

function getStatus(delta: number | null, improvesDown: boolean): 'improving' | 'watch' | 'steady' {
  if (delta === null || delta === 0) return 'steady'
  return (improvesDown ? delta < 0 : delta > 0) ? 'improving' : 'watch'
}

function GradientSparkline({ data, color, domainKey }: { data: number[]; color: string; domainKey: string }) {
  if (data.length < 2) return null
  const W = 200, H = 40
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i): [number, number] => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / range) * (H - 8) - 4,
  ])
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`
  const gradId = `grad-${domainKey}`
  const last = pts[pts.length - 1]

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* End dot — use fixed coords in viewBox space, rendered via a second non-stretched layer */}
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} stroke="white" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function PatientOverview({ visits, prescriptions, latestIntake }: PatientOverviewProps) {
  const sortedVisits = useMemo(() =>
    [...visits]
      .filter(v => v.symptom_scores && Object.keys(v.symptom_scores).length > 0)
      .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime()),
    [visits]
  )

  const latest  = sortedVisits[sortedVisits.length - 1]
  const prev    = sortedVisits[sortedVisits.length - 2]
  const activeRx = prescriptions.filter(p => p.status === 'active')

  const stage   = latestIntake?.ai_brief?.metadata?.menopausal_stage
  const burden  = latestIntake?.ai_brief?.metadata?.symptom_burden
  const summary = latestIntake?.ai_brief?.summary

  const wmiScores    = latestIntake?.wmi_scores
  const overallNow   = wmiScores?.wmi ?? latest?.symptom_scores?.overall
  const overallPrev  = prev?.symptom_scores?.overall
  const overallDelta = overallNow !== undefined && overallPrev !== undefined ? overallNow - overallPrev : null

  const overallStatus = getStatus(overallDelta, false)

  const headlineMap = {
    improving: { prefix: 'Responding &', suffix: 'improving' },
    watch:     { prefix: 'Needs attention &', suffix: 'monitoring' },
    steady:    { prefix: 'Stable &', suffix: 'holding' },
  }
  const headline = headlineMap[overallStatus]

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()

  const capitalize = (s: string) =>
    s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  const burdenColor = burden === 'severe' ? 'text-red-600 bg-red-50 border-red-200'
    : burden === 'high'     ? 'text-orange-600 bg-orange-50 border-orange-200'
    : burden === 'moderate' ? 'text-amber-600 bg-amber-50 border-amber-200'
    :                         'text-emerald-600 bg-emerald-50 border-emerald-200'

  return (
    <div className="space-y-8">

      {/* ── Score header ─────────────────────────────────────────── */}
      <div className="bg-white rounded-card shadow-sm border border-aubergine/5 px-7 pt-4 pb-7">
        <div className="flex items-start justify-between gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-sans tracking-widest text-aubergine/55 uppercase mt-4 -mb-2">
              {wmiScores ? 'WMI Score' : 'Overall Score'} · {monthLabel}
            </p>

            <div className="flex items-end gap-2 mb-3">
              {overallNow !== undefined ? (
                <>
                  <span className="font-serif font-normal text-[100px] leading-none text-aubergine">{overallNow}</span>
                  <span className="font-serif text-xl mb-1.5 italic" style={{ color: '#C4A87A' }}>/100</span>
                </>
              ) : (
                <span className="font-serif text-6xl leading-none text-aubergine/20">—</span>
              )}
            </div>

            {wmiScores ? (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="inline-flex items-center text-xs font-sans px-3 py-1 rounded-pill bg-violet/8 text-violet">
                  {wmiScores.wmi_label}
                </span>
                {wmiScores.phenotype && (
                  <span className="inline-flex items-center text-xs font-sans px-3 py-1 rounded-pill bg-aubergine/5 text-aubergine/55">
                    {wmiScores.phenotype}
                  </span>
                )}
              </div>
            ) : overallDelta !== null && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-sans px-3 py-1 rounded-pill mb-4 ${
                overallStatus === 'improving' ? 'bg-emerald-50 text-emerald-700' :
                overallStatus === 'watch'     ? 'bg-amber-50 text-amber-700' :
                                               'bg-aubergine/5 text-aubergine/50'
              }`}>
                {overallStatus === 'improving' ? '↑' : overallStatus === 'watch' ? '↓' : '→'}
                {Math.abs(overallDelta)} since last visit
              </span>
            )}

            {summary ? (
              <>
                <p className="font-serif text-2xl text-aubergine mb-2">
                  {headline.prefix} <span className="italic text-violet">{headline.suffix}</span>
                </p>
                <p className="text-sm font-sans text-aubergine/50 leading-relaxed max-w-lg">{summary}</p>
              </>
            ) : null}
          </div>

        </div>
      </div>

      {/* ── Five pillars ─────────────────────────────────────────── */}
      <div>
        <p className="font-serif text-xl text-aubergine mb-4">
          Patient's <span className="italic text-violet">five pillars</span>
        </p>
        <div className="grid grid-cols-5 gap-3">
          {DOMAINS.map((domain) => {
            const data = sortedVisits
              .filter(v => v.symptom_scores?.[domain.key] !== undefined)
              .map(v => v.symptom_scores![domain.key])
            const current  = data[data.length - 1]
            const previous = data[data.length - 2]
            const delta = previous !== undefined && current !== undefined ? current - previous : null
            const status = getStatus(delta, domain.improvesDown)

            const statusConfig = {
              improving: { label: '↑ Improving', cls: 'bg-emerald-50 text-emerald-700' },
              watch:     { label: '→ Watch',     cls: 'bg-amber-50 text-amber-700' },
              steady:    { label: '→ Steady',    cls: 'bg-aubergine/5 text-aubergine/40' },
            }[status]

            return (
              <div
                key={domain.key}
                className="bg-white rounded-card shadow-sm border border-aubergine/5 overflow-hidden flex flex-col"
                style={{ borderTop: `3px solid ${domain.color}` }}
              >
                <div className="p-4 flex-1 flex flex-col">
                  {/* Icon + label */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${domain.color}18` }}>
                      <domain.Icon className="w-3.5 h-3.5" style={{ color: domain.color }} />
                    </div>
                    <p className="text-xs font-sans font-semibold text-aubergine">{domain.label}</p>
                  </div>

                  {/* Score + subtitle */}
                  <div className="mb-2">
                    {current !== undefined ? (
                      <span className="font-serif text-5xl text-aubergine leading-none">
                        {current}
                        <span className="font-serif text-xl italic ml-0.5" style={{ color: '#C4A87A' }}>/10</span>
                      </span>
                    ) : (
                      <span className="font-serif text-4xl text-aubergine/20 leading-none">—</span>
                    )}
                    <p className="text-xs font-sans text-aubergine/40 mt-1">{domain.subtitle}</p>
                  </div>

                  {/* Sparkline */}
                  <div className="mt-2 mb-3">
                    {data.length >= 2
                      ? <GradientSparkline data={data} color={domain.color} domainKey={domain.key} />
                      : <div className="h-9 flex items-center">
                          <p className="text-xs font-sans text-aubergine/25 italic">Trend after 2nd visit</p>
                        </div>
                    }
                  </div>

                  {/* Bottom: directional chip + qualitative tag */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-aubergine/5">
                    <span className={`text-xs font-sans px-2 py-0.5 rounded-pill ${statusConfig.cls}`}>
                      {statusConfig.label}
                    </span>
                    {data.length >= 2 && (
                      <span className="text-xs font-serif italic text-aubergine/40">
                        {domain.tags[status]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Active treatment ──────────────────────────────────────── */}
      {activeRx.length > 0 && (
        <div>
          <p className="font-serif text-xl text-aubergine mb-4">
            Current <span className="italic text-violet">treatment</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {activeRx.map(rx => (
              <div key={rx.id} className="bg-white rounded-card px-4 py-3 shadow-sm border border-aubergine/5 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-sans font-medium text-aubergine">{rx.medication_name}</p>
                  <p className="text-xs font-sans text-aubergine/40">{rx.dosage} · {rx.frequency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
