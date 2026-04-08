'use client'

import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

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

/* ── Test info descriptions ──────────────────────────────────────────── */

const _INFO: Record<string, { summary: string; relevance: string }> = {
  // ── Hormone Panel ──
  FSH: {
    summary: 'Follicle-stimulating hormone is produced by the pituitary gland and stimulates ovarian follicle growth.',
    relevance: 'Rising FSH is one of the earliest and most reliable indicators of perimenopause. Elevated levels signal that the ovaries are becoming less responsive to hormonal signals.',
  },
  LH: {
    summary: 'Luteinizing hormone triggers ovulation and supports the menstrual cycle.',
    relevance: 'LH rises alongside FSH during menopause. The FSH-to-LH ratio helps confirm menopausal transition versus other hormonal conditions.',
  },
  E2: {
    summary: 'Estradiol is the primary form of estrogen produced by the ovaries.',
    relevance: 'Declining estradiol drives most menopausal symptoms — hot flashes, sleep disruption, mood changes, and bone density loss. This value helps guide hormone therapy decisions.',
  },
  TESTO: {
    summary: 'Testosterone supports energy, libido, muscle mass, and mood in women.',
    relevance: 'Testosterone declines gradually through perimenopause. Low levels can contribute to fatigue, reduced libido, and difficulty maintaining muscle mass.',
  },
  PROG: {
    summary: 'Progesterone is produced after ovulation and supports the uterine lining.',
    relevance: 'Low progesterone in perimenopause leads to irregular cycles and can contribute to sleep problems and anxiety. It is also essential for endometrial protection during estrogen therapy.',
  },
  'DHEA-S': {
    summary: 'DHEA sulfate is an adrenal hormone that serves as a precursor to both estrogen and testosterone.',
    relevance: 'DHEA-S declines steadily with age and drops more sharply during menopause. Low levels are associated with fatigue, reduced libido, and diminished sense of well-being.',
  },
  // ── Thyroid Panel ──
  TSH: {
    summary: 'Thyroid-stimulating hormone regulates your thyroid gland, which controls metabolism.',
    relevance: 'Thyroid dysfunction can mimic menopausal symptoms (fatigue, weight changes, mood swings). Testing TSH helps rule out or identify a thyroid condition that may need separate treatment.',
  },
  FT4: {
    summary: 'Free T4 is the active form of the main thyroid hormone thyroxine.',
    relevance: 'Measured alongside TSH to distinguish between different types of thyroid dysfunction and assess how well the thyroid is actually functioning.',
  },
  FT3: {
    summary: 'Free T3 is the most active thyroid hormone, converted from T4 in the body.',
    relevance: 'Low FT3 with normal TSH can indicate conversion issues that cause fatigue and brain fog — symptoms often mistakenly attributed to menopause alone.',
  },
  // ── Lipid Panel ──
  TCHOL: {
    summary: 'Total cholesterol is the combined measure of all cholesterol types in your blood.',
    relevance: 'Cholesterol often rises after menopause due to declining estrogen, which previously helped keep LDL in check. Monitoring helps assess cardiovascular risk.',
  },
  TC: {
    summary: 'Total cholesterol is the combined measure of all cholesterol types in your blood.',
    relevance: 'Cholesterol often rises after menopause due to declining estrogen, which previously helped keep LDL in check. Monitoring helps assess cardiovascular risk.',
  },
  LDL: {
    summary: 'LDL ("bad") cholesterol can build up in artery walls over time.',
    relevance: 'Estrogen decline in menopause removes a protective effect on LDL levels. Elevated LDL is a key cardiovascular risk factor to watch during this transition.',
  },
  HDL: {
    summary: 'HDL ("good") cholesterol helps remove other cholesterol from the bloodstream.',
    relevance: 'Higher HDL is protective. Menopause can lower HDL, so tracking it helps your provider assess whether lifestyle changes or treatment adjustments are needed.',
  },
  TRIG: {
    summary: 'Triglycerides are a type of fat in your blood, influenced by diet and metabolism.',
    relevance: 'Elevated triglycerides increase cardiovascular risk, especially in combination with other lipid changes during menopause.',
  },
  TG: {
    summary: 'Triglycerides are a type of fat in your blood, influenced by diet and metabolism.',
    relevance: 'Elevated triglycerides increase cardiovascular risk, especially in combination with other lipid changes during menopause.',
  },
  // ── Metabolic Panel ──
  GLU: {
    summary: 'Fasting glucose measures blood sugar levels after an overnight fast.',
    relevance: 'Insulin resistance becomes more common during menopause due to hormonal shifts. Elevated fasting glucose is an early sign that metabolic health needs attention.',
  },
  HBA1C: {
    summary: 'Hemoglobin A1c reflects your average blood sugar over the past 2-3 months.',
    relevance: 'Provides a longer-term picture of blood sugar control than a single fasting glucose test. Helps catch prediabetes, which becomes more common after menopause.',
  },
  INS: {
    summary: 'Fasting insulin measures how much insulin your body needs to manage blood sugar.',
    relevance: 'High fasting insulin (even with normal glucose) suggests early insulin resistance — a metabolic shift that can accelerate weight gain, inflammation, and cardiovascular risk during menopause.',
  },
  BUN: {
    summary: 'Blood urea nitrogen measures how well your kidneys are filtering waste from your blood.',
    relevance: 'Kidney function is part of a baseline metabolic assessment. Abnormal BUN can signal dehydration or kidney issues that may affect medication dosing for hormone therapy.',
  },
  CREAT: {
    summary: 'Creatinine is a waste product from muscle metabolism, filtered by the kidneys.',
    relevance: 'Used alongside BUN to assess kidney function. Important for establishing a baseline before starting any new medications or hormone therapy.',
  },
  // ── Bone Health ──
  VITD: {
    summary: 'Vitamin D supports calcium absorption, bone health, and immune function.',
    relevance: 'Vitamin D deficiency is very common and worsens the bone loss that accelerates after menopause. Adequate levels are essential for maintaining bone density.',
  },
  CA: {
    summary: 'Calcium is the primary mineral in bones and teeth.',
    relevance: 'Blood calcium levels are tightly regulated, but abnormal values can signal parathyroid issues or other conditions that compound menopausal bone loss.',
  },
  CTX: {
    summary: 'C-telopeptide is a bone breakdown marker — it measures how fast bone is being resorbed.',
    relevance: 'Elevated CTX indicates accelerated bone loss, which is common in the years around menopause. This helps your provider decide if bone-protective treatment is needed.',
  },
  // ── CBC + Iron ──
  CBC: {
    summary: 'A complete blood count measures red cells, white cells, and platelets.',
    relevance: 'Heavy or irregular periods during perimenopause can cause anemia. A CBC screens for this and provides a baseline for overall blood health.',
  },
  WBC: {
    summary: 'White blood cells are your immune system\'s primary defense against infection.',
    relevance: 'Included as part of a complete blood count to screen for infection, inflammation, or immune system issues that could complicate treatment.',
  },
  HGB: {
    summary: 'Hemoglobin is the protein in red blood cells that carries oxygen throughout your body.',
    relevance: 'Low hemoglobin indicates anemia, which is common in perimenopausal women with heavy or irregular periods and causes fatigue often mistaken for menopausal symptoms.',
  },
  HCT: {
    summary: 'Hematocrit measures the percentage of your blood volume made up of red blood cells.',
    relevance: 'Works alongside hemoglobin to assess for anemia. Low hematocrit from heavy perimenopausal bleeding can cause dizziness, fatigue, and shortness of breath.',
  },
  PLT: {
    summary: 'Platelets are cell fragments that help your blood clot when you have an injury.',
    relevance: 'Platelet count is part of a baseline blood health assessment. Abnormal levels are important to identify before starting hormone therapy, which can affect clotting.',
  },
  FE: {
    summary: 'Serum iron measures the amount of circulating iron in your blood.',
    relevance: 'Iron deficiency from heavy perimenopausal bleeding causes fatigue that can overlap with menopausal symptoms. Testing helps identify a treatable cause.',
  },
  FER: {
    summary: 'Ferritin reflects your body\'s stored iron reserves.',
    relevance: 'Ferritin drops before serum iron does, making it an early warning sign. Low ferritin is one of the most common and overlooked causes of exhaustion in perimenopausal women.',
  },
  FERR: {
    summary: 'Ferritin reflects your body\'s stored iron reserves.',
    relevance: 'Ferritin drops before serum iron does, making it an early warning sign. Low ferritin is one of the most common and overlooked causes of exhaustion in perimenopausal women.',
  },
  TIBC: {
    summary: 'Total iron binding capacity measures how much iron your blood could carry.',
    relevance: 'High TIBC suggests your body is trying to compensate for low iron stores. Combined with ferritin and serum iron, it gives a complete picture of iron status.',
  },
  // ── Vitamins ──
  B12: {
    summary: 'Vitamin B12 is essential for nerve function, red blood cell production, and DNA synthesis.',
    relevance: 'B12 deficiency causes fatigue, brain fog, and numbness that can mimic or worsen menopausal symptoms. Absorption decreases with age, making screening important.',
  },
}

/** Look up test info by code — case-insensitive, trims whitespace. */
function getTestInfo(code: string): { summary: string; relevance: string } | undefined {
  return _INFO[code] || _INFO[code.toUpperCase()] || _INFO[code.trim()]
}

/* ── Audio aliases (duplicate test codes → shared mp3) ───────────────── */

const AUDIO_ALIASES: Record<string, string> = {
  tc:   'tchol',
  tg:   'trig',
  ferr: 'fer',
}

/* ── Audio player tooltip with donut progress ────────────────────────── */

const DONUT_R   = 30
const DONUT_CIRC = 2 * Math.PI * DONUT_R

function LabAudioButton({ testCode }: { testCode: string }) {
  const [open,     setOpen]     = useState(false)
  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [pos,      setPos]      = useState({ x: 0, y: 0 })

  const btnRef   = useRef<HTMLButtonElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef   = useRef<number | null>(null)

  const code = AUDIO_ALIASES[testCode.toLowerCase()] ?? testCode.toLowerCase()
  const src  = `/audio/labs/${code}.mp3`

  const updatePos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top })
  }, [])

  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    updatePos()
    setOpen(o => !o)
  }, [updatePos])

  /* stop + reset audio, close tooltip */
  const close = useCallback(() => {
    setOpen(false)
    setPlaying(false)
    setProgress(0)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [])

  /* RAF progress tracking */
  const tick = useCallback(() => {
    const a = audioRef.current
    if (!a || a.paused) return
    if (a.duration > 0) setProgress(a.currentTime / a.duration)
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioRef.current) {
      audioRef.current = new Audio(src)
      audioRef.current.onended = () => {
        setPlaying(false)
        setProgress(0)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    } else {
      audioRef.current.play().catch(() => setPlaying(false))
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [playing, src, tick])

  useEffect(() => () => {
    audioRef.current?.pause()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const dashOffset = DONUT_CIRC * (1 - progress)

  return (
    <>
      {/* Speaker trigger */}
      <button
        ref={btnRef}
        onClick={handleIconClick}
        title="Listen to explanation"
        className={`inline-flex items-center justify-center w-4 h-4 transition-colors cursor-pointer ${
          open || playing ? 'text-aubergine/60' : 'text-aubergine/25 hover:text-aubergine/50'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </button>

      {open && createPortal(
        <>
          {/* Full-screen backdrop — click outside to dismiss */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={close}
          />

          {/* Player */}
          <div
            className="fixed flex items-center justify-center rounded-2xl bg-aubergine shadow-xl"
            style={{
              width: 104,
              height: 104,
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -100%) translateY(-10px)',
              zIndex: 9999,
            }}
          >
            {/* Donut ring */}
            <svg width="84" height="84" viewBox="0 0 84 84" className="absolute pointer-events-none">
              <circle cx="42" cy="42" r={DONUT_R}
                fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
              <circle cx="42" cy="42" r={DONUT_R}
                fill="none" stroke="white" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={DONUT_CIRC}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 42 42)"
              />
            </svg>

            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="relative z-10 flex items-center justify-center w-9 h-9 text-white hover:opacity-75 transition-opacity"
            >
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

/* ── Info tooltip (matches WearableTrends pattern) ──────────────────── */

function LabInfoTooltip({ info }: { info: { summary: string; relevance: string } }) {
  const [show, setShow] = useState(false)
  const iconRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const updatePos = useCallback(() => {
    if (!iconRef.current) return
    const rect = iconRef.current.getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top })
  }, [])

  const handleEnter = useCallback(() => {
    updatePos()
    setShow(true)
  }, [updatePos])

  const handleLeave = useCallback(() => setShow(false), [])

  // Keep position updated while visible (handles scroll)
  useEffect(() => {
    if (!show) return
    const onScroll = () => updatePos()
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [show, updatePos])

  return (
    <span
      ref={iconRef}
      className="inline-flex flex-shrink-0 relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <svg
        className="w-4 h-4 text-aubergine/25 hover:text-aubergine/40 transition-colors cursor-help"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
      </svg>
      {show && createPortal(
        <span
          className="fixed w-72 px-3.5 py-3 rounded-lg bg-aubergine text-white text-sm font-sans leading-relaxed shadow-lg pointer-events-none"
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            transform: 'translate(-50%, -100%) translateY(-8px)',
            zIndex: 9999,
          }}
        >
          <span className="block mb-1">{info.summary}</span>
          <span className="block text-white/60">
            <span className="text-white/80 font-medium">Why it matters: </span>
            {info.relevance}
          </span>
        </span>,
        document.body
      )}
    </span>
  )
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
  const info = getTestInfo(result.testCode)

  // Where the "normal zone" sits on the bar
  const zonePctLeft = normalise(range.low, range.low, range.high)
  const zonePctRight = normalise(range.high, range.low, range.high)

  return (
    <div className={`rounded-brand px-4 py-3 ${isFlagged ? 'bg-aubergine/[0.02]' : ''}`}>
      {/* Top line — test name + value + flag */}
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm font-sans font-medium text-aubergine flex items-center gap-1.5">
          {result.testName}
          <LabInfoTooltip info={info || { summary: result.testName, relevance: 'Your provider included this test as part of your evaluation. Ask about it at your next visit.' }} />
          <LabAudioButton testCode={result.testCode} />
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
