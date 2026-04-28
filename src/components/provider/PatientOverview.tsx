'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { Flame, Moon, Zap, SmilePlus, Droplets, Brain, Shield, Scale, Heart, Activity } from 'lucide-react'
import DailyCheckinModal from '@/components/patient/DailyCheckinModal'

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
  view?: 'patient' | 'provider'
  latestIntake?: {
    ai_brief?: {
      metadata?: { symptom_burden?: string; menopausal_stage?: string }
      summary?: string
      patient_blueprint?: { overview?: string }
      symptom_summary?: { overview?: string }
    }
    wmi_scores?: WMIScores | null
  } | null
  onCheckinComplete?: () => void
  showCheckin?: boolean
}

const ALL_DOMAINS = [
  { key: 'vasomotor', label: 'Vasomotor',     Icon: Flame,     color: '#d85623', subtitle: 'Hot-flash frequency',    improvesDown: true,  tags: { improving: 'Slow taper',      watch: 'Increasing',      steady: 'Holding steady' } },
  { key: 'sleep',     label: 'Sleep',          Icon: Moon,      color: '#5d9ed5', subtitle: 'Sleep quality score',    improvesDown: false, tags: { improving: 'Deeper cycles',   watch: 'Disrupted',       steady: 'Consistent'     } },
  { key: 'energy',    label: 'Energy',         Icon: Zap,       color: '#e8a838', subtitle: 'Daily energy level',     improvesDown: false, tags: { improving: 'Rising steadily', watch: 'Fatigue rising',  steady: 'Steady energy'  } },
  { key: 'mood',      label: 'Mood',           Icon: SmilePlus, color: '#944fed', subtitle: 'Self-rated, journaled',  improvesDown: false, tags: { improving: 'Steadier days',   watch: 'More variable',   steady: 'Consistent'     } },
  { key: 'gsm',       label: 'Hormonal',       Icon: Droplets,  color: '#c2796d', subtitle: 'GSM symptom score',      improvesDown: true,  tags: { improving: 'On target',       watch: 'Watch closely',   steady: 'Stable'         } },
  { key: 'cognition', label: 'Cognition',      Icon: Brain,     color: '#6366f1', subtitle: 'Brain fog & clarity',    improvesDown: false, tags: { improving: 'Clearer focus',   watch: 'More fog',        steady: 'Consistent'     } },
  { key: 'bone',      label: 'Bone Health',    Icon: Shield,    color: '#78716c', subtitle: 'Density indicators',     improvesDown: false, tags: { improving: 'Strengthening',   watch: 'Monitor closely', steady: 'Stable'         } },
  { key: 'weight',    label: 'Metabolism',     Icon: Scale,     color: '#0891b2', subtitle: 'Weight & metabolic',     improvesDown: false, tags: { improving: 'Trending well',   watch: 'Needs attention', steady: 'Holding steady' } },
  { key: 'libido',    label: 'Libido',         Icon: Heart,     color: '#e879f9', subtitle: 'Self-rated intimacy',    improvesDown: false, tags: { improving: 'Improving',       watch: 'Watch closely',   steady: 'Consistent'     } },
  { key: 'cardio',    label: 'Cardiovascular', Icon: Activity,  color: '#ef4444', subtitle: 'Heart & circulation',    improvesDown: false, tags: { improving: 'Improving',       watch: 'Monitor closely', steady: 'Stable'         } },
]

const DEFAULT_DOMAIN_KEYS = ['vasomotor', 'sleep', 'energy', 'mood']

function getStatus(delta: number | null, improvesDown: boolean): 'improving' | 'watch' | 'steady' {
  if (delta === null || delta === 0) return 'steady'
  return (improvesDown ? delta < 0 : delta > 0) ? 'improving' : 'watch'
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return d
}

function GradientSparkline({ data, color, domainKey }: { data: number[]; color: string; domainKey: string }) {
  if (data.length < 1) return null
  const W = 200, H = 40
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i): [number, number] => [
    data.length === 1 ? W / 2 : (i / (data.length - 1)) * W,
    H - ((v - min) / range) * (H - 8) - 4,
  ])
  const gradId = `grad-${domainKey}`
  const last = pts[pts.length - 1]
  const linePath = smoothPath(pts)
  const areaPath = data.length >= 2 ? `${linePath} L${W},${H} L0,${H} Z` : ''

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      {data.length >= 2 && <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />}
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} stroke="white" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function PatientOverview({ visits, prescriptions, latestIntake, view = 'patient', onCheckinComplete, showCheckin = false }: PatientOverviewProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(DEFAULT_DOMAIN_KEYS)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [checkinModal, setCheckinModal] = useState(false)
  const [todayCheckedIn, setTodayCheckedIn] = useState<boolean | null>(null)
  const [checkinDismissed, setCheckinDismissed] = useState(false)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  useEffect(() => {
    if (view !== 'patient') return
    fetch('/api/daily-checkin')
      .then(r => r.json())
      .then(d => setTodayCheckedIn(!!d.checkedIn))
      .catch(() => setTodayCheckedIn(false))
  }, [view])

  const toggleKey = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const activeDomains = ALL_DOMAINS.filter(d => selectedKeys.includes(d.key))

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
  const body = view === 'provider'
    ? latestIntake?.ai_brief?.symptom_summary?.overview
    : latestIntake?.ai_brief?.patient_blueprint?.overview ?? latestIntake?.ai_brief?.summary

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

  const isInitialState = visits.length === 0

  const wmiHeadline = wmiScores && wmiScores.wmi >= 60
    ? { prefix: "You're in a solid position.", suffix: "Let's build from here." }
    : { prefix: 'Real symptoms.', suffix: 'Real solutions ahead.' }



  // Count-up animation for the score display
  const [displayScore, setDisplayScore] = useState(0)
  useEffect(() => {
    if (overallNow === undefined) return
    const target = overallNow
    const duration = 1200
    const start = performance.now()
    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [overallNow])

  const capitalize = (s: string) =>
    s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  const burdenColor = burden === 'severe' ? 'text-red-600 bg-red-50 border-red-200'
    : burden === 'high'     ? 'text-orange-600 bg-orange-50 border-orange-200'
    : burden === 'moderate' ? 'text-amber-600 bg-amber-50 border-amber-200'
    :                         'text-emerald-600 bg-emerald-50 border-emerald-200'

  return (
    <div className="space-y-8">

      {/* ── Daily check-in CTA (symptom tracker only) ── */}
      {showCheckin && todayCheckedIn !== null && !checkinDismissed && (
        <div className={`rounded-2xl px-5 py-4 flex items-center justify-between gap-4 border ${
          todayCheckedIn
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-violet/5 border-violet/15'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              todayCheckedIn ? 'bg-emerald-100' : 'bg-violet/10'
            }`}>
              {todayCheckedIn ? (
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className={`font-sans text-sm font-semibold truncate ${todayCheckedIn ? 'text-emerald-700' : 'text-aubergine'}`}>
                {todayCheckedIn ? 'Checked in today' : "Log today's symptoms"}
              </p>
              <p className={`font-sans text-xs ${todayCheckedIn ? 'text-emerald-600/70' : 'text-aubergine/40'}`}>
                {todayCheckedIn ? 'Your tracker is up to date' : "Track how you're feeling — 2 minutes"}
              </p>
            </div>
          </div>
          {todayCheckedIn ? (
            <button
              onClick={() => setCheckinDismissed(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-emerald-100 transition-colors shrink-0 text-emerald-600/60 hover:text-emerald-700"
              aria-label="Dismiss"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setCheckinModal(true)}
              className="font-sans font-semibold text-xs text-white bg-aubergine rounded-full px-4 py-2 hover:bg-aubergine/90 transition-colors shrink-0"
            >
              Start
            </button>
          )}
        </div>
      )}

      {/* Daily check-in modal */}
      {checkinModal && (
        <DailyCheckinModal
          onClose={() => setCheckinModal(false)}
          onSuccess={() => {
            setCheckinModal(false)
            setTodayCheckedIn(true)
            onCheckinComplete?.()
          }}
        />
      )}

      {/* ── Score header ─────────────────────────────────────────── */}
      <div className="bg-white rounded-card shadow-sm border border-aubergine/5 px-7 pt-4 pb-7">
        <div className="flex flex-col items-center text-center">
          <p className="text-[10px] font-sans tracking-widest text-aubergine/55 uppercase mt-4 -mb-2">
            Your Womenkind Score
          </p>

          <div className="flex items-end gap-2 mb-3">
            {overallNow !== undefined ? (
              <>
                <span className="font-serif font-normal text-[100px] leading-none text-aubergine">{displayScore}</span>
                <span className="font-serif text-xl mb-1.5 italic" style={{ color: '#C4A87A' }}>/100</span>
              </>
            ) : (
              <span className="font-serif text-6xl leading-none text-aubergine/20">—</span>
            )}
          </div>

          {isInitialState && wmiScores ? (
            <div className="flex flex-wrap justify-center items-center gap-2 mb-4">
              <span className="inline-flex items-center text-xs font-sans px-3 py-1 rounded-pill bg-violet/8 text-violet">
                Based on WMI
              </span>
            </div>
          ) : overallDelta !== null ? (
            <span className={`inline-flex items-center gap-1.5 text-xs font-sans px-3 py-1 rounded-pill mb-4 ${
              overallStatus === 'improving' ? 'bg-emerald-50 text-emerald-700' :
              overallStatus === 'watch'     ? 'bg-amber-50 text-amber-700' :
                                             'bg-aubergine/5 text-aubergine/50'
            }`}>
              {overallStatus === 'improving' ? '↑' : overallStatus === 'watch' ? '↓' : '→'}
              {Math.abs(overallDelta)} since last visit
            </span>
          ) : wmiScores ? (
            <div className="flex flex-wrap justify-center items-center gap-2 mb-4">
              <span className="inline-flex items-center text-xs font-sans px-3 py-1 rounded-pill bg-violet/8 text-violet">
                {wmiScores.wmi_label}
              </span>
              {wmiScores.phenotype && (
                <span className="inline-flex items-center text-xs font-sans px-3 py-1 rounded-pill bg-aubergine/5 text-aubergine/55">
                  {wmiScores.phenotype}
                </span>
              )}
            </div>
          ) : null}

          {isInitialState && wmiScores ? (
            <>
              <p className="font-serif text-2xl text-aubergine mb-2">
                {wmiHeadline.prefix} <span className="italic text-violet">{wmiHeadline.suffix}</span>
              </p>
              {body && <p className="text-sm font-sans text-aubergine/50 leading-relaxed max-w-lg">{body}</p>}
            </>
          ) : (
            <>
              <p className="font-serif text-2xl text-aubergine mb-2">
                {headline.prefix} <span className="italic text-violet">{headline.suffix}</span>
              </p>
              {body && <p className="text-sm font-sans text-aubergine/50 leading-relaxed max-w-lg">{body}</p>}
            </>
          )}
        </div>
      </div>

      {/* ── Symptom Tracker ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="font-serif text-xl text-aubergine">
            Symptom <span className="italic text-violet">Tracker</span>
          </p>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="w-8 h-8 rounded-full border-2 border-aubergine/20 flex items-center justify-center text-aubergine/40 hover:border-violet hover:text-violet transition-colors"
              title="Customize topics"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-10 z-50 w-56 bg-white rounded-card shadow-xl shadow-aubergine/10 border border-aubergine/10 py-2 overflow-hidden">
                <p className="text-[10px] font-sans font-semibold text-aubergine/40 uppercase tracking-wider px-4 pb-2 pt-1">
                  Topics to monitor
                </p>
                {ALL_DOMAINS.map(domain => (
                  <button
                    key={domain.key}
                    onClick={() => toggleKey(domain.key)}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-aubergine/3 transition-colors text-left"
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        selectedKeys.includes(domain.key)
                          ? 'border-transparent'
                          : 'border-aubergine/20 bg-transparent'
                      }`}
                      style={selectedKeys.includes(domain.key) ? { backgroundColor: domain.color } : {}}
                    >
                      {selectedKeys.includes(domain.key) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <domain.Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: domain.color }} />
                      <span className="text-sm font-sans text-aubergine/80 truncate">{domain.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`grid gap-3 ${activeDomains.length <= 3 ? 'grid-cols-3' : activeDomains.length === 4 ? 'grid-cols-4' : 'grid-cols-4'}`}>
          {activeDomains.map((domain) => {
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
                    {data.length >= 1
                      ? <GradientSparkline data={data} color={domain.color} domainKey={domain.key} />
                      : <div className="h-9 flex items-center">
                          <p className="text-xs font-sans text-aubergine/25 italic">Check in to start tracking</p>
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
