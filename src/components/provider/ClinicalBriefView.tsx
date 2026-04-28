'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChatContext } from '@/lib/chat-context'
import { QUESTIONS, SECTIONS } from '@/lib/intake-questions'
import { devFixtures } from '@/lib/dev-fixtures'

type Tab = 'command' | 'soap' | 'symptoms' | 'risks' | 'treatment' | 'questions' | 'intake'

interface Intake {
  id: string
  status: string
  answers: Record<string, any>
  ai_brief: any
  provider_notes: string | null
  submitted_at: string
  reviewed_at: string | null
  patient_id?: string
}

interface Props {
  intakeId: string
  /** When true, render header (patient name, badges, Create Care Presentation). Default true. */
  showHeader?: boolean
}

export default function ClinicalBriefView({ intakeId, showHeader = true }: Props) {
  const router = useRouter()
  const [intake, setIntake] = useState<Intake | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('command')
  const [isMember, setIsMember] = useState(false)
  const { setPageContext } = useChatContext()

  useEffect(() => {
    loadIntake()
  }, [intakeId])

  const loadIntake = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/provider/intakes/${intakeId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { intake: data, isMember: member } = await res.json()

      setIntake(data)
      setIsMember(member)

      setPageContext({
        page: 'brief',
        patientId: data.patient_id,
        patientName: data.answers?.full_name || 'Unknown Patient',
        intakeId: data.id,
        intakeStatus: data.status,
      })

      if (data.status === 'submitted') {
        await fetch(`/api/provider/intakes/${intakeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'reviewed' }),
        })
      }
    } catch (err) {
      // Dev fallback — find this intake inside any patientProfile fixture
      if (process.env.NODE_ENV === 'development') {
        for (const pid of Object.keys(devFixtures.patientProfile)) {
          const fx = devFixtures.patientProfile[pid]
          const found = (fx.intakes || []).find((i: any) => i.id === intakeId)
          if (found) {
            setIntake({ ...found, patient_id: pid })
            setIsMember(
              (fx.subscriptions || []).some(
                (s: any) => s.plan_type === 'membership' && s.status === 'active'
              )
            )
            setLoading(false)
            return
          }
        }
      }
      console.error('Failed to load intake:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (!intake || !intake.ai_brief) {
    return (
      <div className="bg-white rounded-card shadow-sm p-12 text-center">
        <p className="font-sans font-semibold text-lg text-aubergine/40">No clinical brief available yet</p>
        <p className="text-sm font-sans text-aubergine/30 mt-2">A brief is generated automatically once an intake is submitted.</p>
      </div>
    )
  }

  const brief = intake.ai_brief
  const answers = intake.answers || {}
  const age = answers.dob
    ? Math.floor((Date.now() - new Date(answers.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const hasMDCommand = !!brief.md_command

  const printClinicalSummary = () => {
    const cmd = brief.md_command
    const soap = brief.soap_note
    const patientName = answers.full_name || 'Unknown Patient'
    const printDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    const safeList = (arr: string[] | undefined) =>
      arr?.length ? arr.map(i => `<li>${i}</li>`).join('') : '<li>None</li>'

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Clinical Summary — ${patientName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; color: #1a0a2e; padding: 48px; max-width: 760px; margin: 0 auto; font-size: 13px; line-height: 1.6; }
  .header { border-bottom: 2px solid #1a0a2e; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
  .header .meta { font-family: -apple-system, sans-serif; font-size: 11px; color: #666; }
  .badges { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .badge { font-family: -apple-system, sans-serif; font-size: 10px; border: 1px solid #ccc; border-radius: 20px; padding: 2px 8px; text-transform: uppercase; letter-spacing: 0.05em; }
  h2 { font-family: -apple-system, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #7c3aed; border-bottom: 1px solid #ede9fe; padding-bottom: 4px; margin: 24px 0 12px; }
  h3 { font-family: -apple-system, sans-serif; font-size: 11px; font-weight: 600; color: #1a0a2e; margin: 12px 0 6px; }
  .box { border: 1px solid #e8e3f0; border-radius: 6px; padding: 12px; margin-bottom: 10px; }
  .box.violet { background: #f5f0ff; border-color: #ddd6fe; }
  .box.cream { background: #faf7f4; border-color: #ede9e5; }
  .box.green { background: #f0fdf4; border-color: #bbf7d0; }
  .box.red { background: #fef2f2; border-color: #fecaca; }
  .box.amber { background: #fffbeb; border-color: #fde68a; }
  .box.blue { background: #eff6ff; border-color: #bfdbfe; }
  .box.yellow { background: #fefce8; border-color: #fef08a; }
  .label { font-family: -apple-system, sans-serif; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 4px; }
  .value { font-size: 14px; font-weight: bold; }
  ul { padding-left: 16px; }
  li { margin-bottom: 3px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .hrt-eligible { font-family: -apple-system, sans-serif; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-bottom: 8px; }
  .soap-section { margin-bottom: 10px; }
  .soap-label { font-family: -apple-system, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-family: -apple-system, sans-serif; font-size: 10px; color: #aaa; text-align: center; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
<div class="header">
  <h1>${patientName}</h1>
  <div class="meta">
    ${age ? `${age} years old` : ''}${answers.height ? ` &bull; ${answers.height}` : ''}${answers.weight ? ` &bull; ${answers.weight}` : ''} &bull; Printed ${printDate}
  </div>
  ${brief.metadata ? `<div class="badges">
    ${brief.metadata.menopausal_stage ? `<span class="badge">${brief.metadata.menopausal_stage}</span>` : ''}
    ${brief.metadata.symptom_burden ? `<span class="badge">${brief.metadata.symptom_burden} Burden</span>` : ''}
    ${brief.metadata.complexity ? `<span class="badge">${brief.metadata.complexity} Complexity</span>` : ''}
  </div>` : ''}
</div>

${cmd ? `
<h2>MD Command Center</h2>
<div class="two-col">
  <div class="box violet">
    <div class="label">Phenotype</div>
    <div class="value">${cmd.phenotype || '—'}</div>
  </div>
  <div class="box cream">
    <div class="label">WMI Interpretation</div>
    <p>${cmd.wmi_interpretation || '—'}</p>
  </div>
</div>

${cmd.safety_decision ? `
<h3>Safety Decision</h3>
<div class="${cmd.safety_decision.hrt_eligible ? 'box green' : 'box red'}">
  <span class="hrt-eligible">${cmd.safety_decision.hrt_eligible ? '✓ HRT Eligible' : '✗ HRT Contraindicated'}</span>
  ${cmd.safety_decision.contraindications?.length ? `<div class="label">Contraindications</div><ul>${safeList(cmd.safety_decision.contraindications)}</ul>` : ''}
  ${cmd.safety_decision.cautions?.length ? `<div class="label" style="margin-top:8px">Cautions</div><ul>${safeList(cmd.safety_decision.cautions)}</ul>` : ''}
</div>` : ''}

${cmd.treatment_options?.length ? `
<h3>Treatment Recommendations</h3>
${cmd.treatment_options.map((opt: any, i: number) => `
<div class="box">
  <strong>${opt.rank || i + 1}. ${opt.therapy}</strong>
  ${opt.rationale ? `<p style="margin-top:4px;color:#555">${opt.rationale}</p>` : ''}
  ${opt.monitoring ? `<p style="margin-top:4px;font-size:11px;color:#888"><em>Monitor: ${opt.monitoring}</em></p>` : ''}
</div>`).join('')}` : ''}

<div class="two-col">
  ${cmd.labs_to_order?.length ? `
  <div>
    <h3>Labs to Order</h3>
    <ul>${safeList(cmd.labs_to_order)}</ul>
  </div>` : ''}
  ${cmd.follow_up ? `
  <div>
    <h3>Follow-up</h3>
    <p>${cmd.follow_up}</p>
  </div>` : ''}
</div>
` : ''}

${soap ? `
<h2>SOAP Note</h2>
${[
  { key: 'subjective', label: 'S — Subjective', cls: 'violet' },
  { key: 'objective',  label: 'O — Objective',  cls: 'blue' },
  { key: 'assessment', label: 'A — Assessment', cls: 'yellow' },
  { key: 'plan',       label: 'P — Plan',        cls: 'green' },
].filter(s => soap[s.key]).map(s => `
<div class="box ${s.cls} soap-section">
  <div class="soap-label">${s.label}</div>
  <p style="white-space:pre-wrap">${soap[s.key]}</p>
</div>`).join('')}
` : ''}

<div class="footer">Womenkind — AI-generated pre-visit clinical summary. Provider reviews and makes all clinical decisions.</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=860,height=1000')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    ...(hasMDCommand ? [
      { key: 'command' as Tab, label: 'MD Command', icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' },
      { key: 'soap' as Tab, label: 'SOAP Note', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ] : []),
    { key: 'symptoms', label: 'Symptoms', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'risks', label: 'Risk Flags', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
    { key: 'treatment', label: 'Treatment', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { key: 'questions', label: 'Questions', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'intake', label: 'Intake', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  ]

  return (
    <div>
      {showHeader && (
        <div className="bg-white rounded-card shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-sans font-semibold text-2xl text-aubergine">{answers.full_name || 'Unknown Patient'}</h1>
                {isMember && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-xs font-sans text-aubergine/50 font-medium">Member</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm font-sans text-aubergine/50">
                {age && <span>{age} years old</span>}
                {answers.height && <span>{answers.height}</span>}
                {answers.weight && <span>{answers.weight}</span>}
              </div>
              {brief.metadata && (
                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-xs font-sans px-2.5 py-1 rounded-pill border
                    ${brief.metadata.symptom_burden === 'severe' ? 'text-red-600 bg-red-50 border-red-200' :
                      brief.metadata.symptom_burden === 'high' ? 'text-orange-600 bg-orange-50 border-orange-200' :
                      'text-amber-600 bg-amber-50 border-amber-200'}`}
                  >
                    {brief.metadata.symptom_burden?.charAt(0).toUpperCase() + brief.metadata.symptom_burden?.slice(1)} Burden
                  </span>
                  {brief.metadata.menopausal_stage && (
                    <span className="text-xs font-sans px-2.5 py-1 rounded-pill border text-violet bg-violet/5 border-violet/20">
                      {brief.metadata.menopausal_stage?.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  )}
                  {brief.metadata.complexity && (
                    <span className="text-xs font-sans px-2.5 py-1 rounded-pill border text-aubergine/50 bg-aubergine/5 border-aubergine/10">
                      {brief.metadata.complexity?.charAt(0).toUpperCase() + brief.metadata.complexity?.slice(1)} Complexity
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasMDCommand && (
                <button
                  onClick={printClinicalSummary}
                  className="text-sm font-sans font-medium text-aubergine/60 bg-white px-4 py-2.5 rounded-brand border border-aubergine/15 hover:bg-aubergine/5 hover:text-aubergine transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Summary
                </button>
              )}
              {intake.patient_id && (
                <button
                  onClick={() => router.push(`/provider/presentation/create/${intake.patient_id}`)}
                  className="text-sm font-sans font-medium text-violet bg-white px-5 py-2.5 rounded-brand border border-violet/30 hover:bg-violet/5 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create Care Presentation
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      <div className="grid grid-cols-[160px_1fr] gap-6">
        <div className="flex flex-col gap-1 pt-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-brand text-sm font-sans font-medium text-left w-full transition-all
                ${activeTab === tab.key
                  ? 'bg-violet text-white'
                  : 'text-aubergine/50 hover:text-aubergine hover:bg-aubergine/5'
                }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-card shadow-sm p-6">
          {activeTab === 'command' && <MDCommandTab brief={brief} />}
          {activeTab === 'soap' && <SOAPNoteTab brief={brief} />}
          {activeTab === 'symptoms' && <SymptomsTab brief={brief} />}
          {activeTab === 'risks' && <RiskFlagsTab brief={brief} />}
          {activeTab === 'treatment' && <TreatmentTab brief={brief} />}
          {activeTab === 'questions' && <QuestionsTab brief={brief} />}
          {activeTab === 'intake' && <IntakeAnswersTab answers={answers} patientName={answers.full_name || 'Patient'} />}
        </div>
      </div>

      <p className="text-xs font-sans text-aubergine/20 text-center mt-8">
        This is a structured pre-visit summary generated by AI, not a diagnosis. The provider reviews, annotates, and makes all clinical decisions.
      </p>
    </div>
  )
}

/* ───── TAB COMPONENTS ───── */

function MDCommandTab({ brief }: { brief: any }) {
  const cmd = brief.md_command
  if (!cmd) return <p className="text-sm font-sans text-aubergine/40">MD Command Center not available for this intake.</p>

  const safetyColor = cmd.safety_decision?.hrt_eligible
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : 'bg-red-50 border-red-200 text-red-700'

  return (
    <div className="space-y-6">
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">MD Command Center</h2>
      {/* Phenotype + WMI */}
      <div className="space-y-3">
        <div className="w-full p-4 rounded-brand bg-violet/5 border border-violet/10">
          <p className="text-xs font-sans font-semibold text-violet/60 uppercase tracking-wider mb-1">Phenotype</p>
          <p className="font-sans font-semibold text-base text-aubergine">{cmd.phenotype || '—'}</p>
        </div>
        {cmd.wmi_interpretation && (
          <div className="w-full p-4 rounded-brand bg-cream border border-aubergine/5">
            <p className="text-xs font-sans font-semibold text-aubergine/40 uppercase tracking-wider mb-1">WMI Interpretation</p>
            <p className="text-sm font-sans text-aubergine/70 leading-relaxed">{cmd.wmi_interpretation}</p>
          </div>
        )}
      </div>

      {/* Safety Decision */}
      {cmd.safety_decision && (
        <div>
          <h3 className="font-sans font-semibold text-sm text-aubergine mb-3">Safety Decision</h3>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill border text-sm font-sans font-medium mb-3 ${safetyColor}`}>
            {cmd.safety_decision.hrt_eligible
              ? <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> HRT Eligible</>
              : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> HRT Contraindicated</>
            }
          </div>
          {cmd.safety_decision.contraindications?.length > 0 && (
            <div className="mb-3 p-3 rounded-brand bg-red-50 border border-red-100">
              <p className="text-xs font-sans font-semibold text-red-600 mb-1.5">Contraindications</p>
              <ul className="space-y-1">{cmd.safety_decision.contraindications.map((c: string, i: number) => (
                <li key={i} className="text-sm font-sans text-red-700 flex gap-2"><span className="text-red-400 mt-0.5">&#x2022;</span>{c}</li>
              ))}</ul>
            </div>
          )}
          {cmd.safety_decision.cautions?.length > 0 && (
            <div className="mb-3 p-3 rounded-brand bg-amber-50 border border-amber-100">
              <p className="text-xs font-sans font-semibold text-amber-700 mb-1.5">Cautions / Monitor</p>
              <ul className="space-y-1">{cmd.safety_decision.cautions.map((c: string, i: number) => (
                <li key={i} className="text-sm font-sans text-amber-700 flex gap-2"><span className="text-amber-400 mt-0.5">&#x26A0;</span>{c}</li>
              ))}</ul>
            </div>
          )}
          {cmd.safety_decision.flags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cmd.safety_decision.flags.map((f: string, i: number) => (
                <span key={i} className="text-xs font-sans px-2.5 py-1 rounded-pill bg-aubergine/5 text-aubergine/60 border border-aubergine/10">{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Treatment Options */}
      {cmd.treatment_options?.length > 0 && (
        <div>
          <h3 className="font-sans font-semibold text-sm text-aubergine mb-3">Treatment Recommendations</h3>
          <div className="space-y-3">
            {cmd.treatment_options.map((opt: any, i: number) => (
              <div key={i} className="p-4 rounded-brand border border-aubergine/5 bg-cream/30">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet/10 text-violet text-xs font-sans font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {opt.rank || i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-sans font-semibold text-sm text-aubergine mb-1">{opt.therapy}</p>
                    {opt.rationale && <p className="text-sm font-sans text-aubergine/60 leading-relaxed mb-1">{opt.rationale}</p>}
                    {opt.monitoring && <p className="text-xs font-sans text-aubergine/40 leading-relaxed italic">Monitor: {opt.monitoring}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Labs + Follow-up */}
      <div className="grid grid-cols-2 gap-4">
        {cmd.labs_to_order?.length > 0 && (
          <div className="p-4 rounded-brand border border-aubergine/5">
            <h4 className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider mb-2">Labs to Order</h4>
            <ul className="space-y-1.5">
              {cmd.labs_to_order.map((lab: string, i: number) => (
                <li key={i} className="text-sm font-sans text-aubergine/70 flex gap-2"><span className="text-violet/40 mt-0.5">&#x2022;</span>{lab}</li>
              ))}
            </ul>
          </div>
        )}
        {cmd.follow_up && (
          <div className="p-4 rounded-brand border border-aubergine/5">
            <h4 className="text-xs font-sans font-semibold text-aubergine/50 uppercase tracking-wider mb-2">Follow-up</h4>
            <p className="text-sm font-sans text-aubergine/70 leading-relaxed">{cmd.follow_up}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SOAPNoteTab({ brief }: { brief: any }) {
  const soap = brief.soap_note
  if (!soap) return <p className="text-sm font-sans text-aubergine/40">SOAP note not available for this intake.</p>

  const sections = [
    { key: 'subjective', label: 'S — Subjective', color: 'text-violet border-violet/20 bg-violet/5' },
    { key: 'objective',  label: 'O — Objective',  color: 'text-[#5d9ed5] border-[#5d9ed5]/20 bg-[#5d9ed5]/5' },
    { key: 'assessment', label: 'A — Assessment', color: 'text-[#e8a838] border-[#e8a838]/20 bg-[#e8a838]/5' },
    { key: 'plan',       label: 'P — Plan',        color: 'text-emerald-600 border-emerald-200 bg-emerald-50' },
  ] as const

  return (
    <div className="space-y-4">
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">SOAP Note</h2>
      {sections.map(({ key, label, color }) => soap[key] && (
        <div key={key} className={`p-4 rounded-brand border ${color}`}>
          <p className={`text-xs font-sans font-semibold uppercase tracking-wider mb-2 ${color.split(' ')[0]}`}>{label}</p>
          <p className="text-sm font-sans text-aubergine/75 leading-relaxed whitespace-pre-wrap">{soap[key]}</p>
        </div>
      ))}
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase()
  let color = 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (s.includes('severe')) color = 'text-red-600 bg-red-50 border-red-200'
  else if (s.includes('moderate')) color = 'text-amber-600 bg-amber-50 border-amber-200'
  else if (s.includes('mild')) color = 'text-green-600 bg-green-50 border-green-200'

  return (
    <span className={`text-xs font-sans px-2 py-0.5 rounded-pill border uppercase ${color}`}>
      {severity}
    </span>
  )
}

function SymptomsTab({ brief }: { brief: any }) {
  const domains = brief.symptom_summary?.domains || []
  if (domains.length === 0) {
    return <p className="text-sm font-sans text-aubergine/40">No symptom data available.</p>
  }

  return (
    <div>
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">Symptom Summary</h2>
      <div className="space-y-4">
        {domains.map((d: any, i: number) => (
          <div key={i} className="p-4 rounded-brand border border-aubergine/5 bg-cream/50">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-sans font-semibold text-sm text-aubergine">{d.domain}</h3>
              <SeverityBadge severity={d.severity} />
            </div>
            <p className="text-sm font-sans text-aubergine/70 leading-relaxed">{d.findings}</p>
            {d.patient_language && (
              <p className="text-sm font-sans text-violet italic mt-2 pl-3 border-l-2 border-violet/20">
                &ldquo;{d.patient_language}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RiskFlagsTab({ brief }: { brief: any }) {
  const flags = brief.risk_flags || {}

  return (
    <div>
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">Risk Flags</h2>

      {flags.urgent && flags.urgent.length > 0 ? (
        <div className="mb-6 p-4 rounded-brand bg-red-50 border border-red-200">
          <h3 className="font-sans font-semibold text-sm text-red-700 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Urgent
          </h3>
          <ul className="space-y-1.5">
            {flags.urgent.map((item: string, i: number) => (
              <li key={i} className="text-sm font-sans text-red-700 leading-relaxed flex gap-2">
                <span className="text-red-400 mt-0.5">&#x2022;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-brand bg-emerald-50 border border-emerald-200">
          <p className="text-sm font-sans text-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            No urgent flags identified
          </p>
        </div>
      )}

      {flags.contraindications && flags.contraindications.length > 0 && (
        <div className="mb-4">
          <h3 className="font-sans font-semibold text-sm text-aubergine mb-2">Contraindications / Monitoring</h3>
          <ul className="space-y-2">
            {flags.contraindications.map((item: string, i: number) => (
              <li key={i} className="text-sm font-sans text-aubergine/70 leading-relaxed flex gap-2 p-3 rounded-brand bg-amber-50/50 border border-amber-100">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">&#x26A0;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {flags.considerations && flags.considerations.length > 0 && (
        <div>
          <h3 className="font-sans font-semibold text-sm text-aubergine mb-2 mt-5">Clinical Considerations</h3>
          <ul className="space-y-2">
            {flags.considerations.map((item: string, i: number) => (
              <li key={i} className="text-sm font-sans text-aubergine/60 leading-relaxed flex gap-2 p-3 rounded-brand bg-cream/50 border border-aubergine/5">
                <span className="text-aubergine/30 mt-0.5 flex-shrink-0">&#x2022;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TreatmentTab({ brief }: { brief: any }) {
  const pathway = brief.treatment_pathway || {}

  return (
    <div>
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-4">Treatment Pathway</h2>

      {pathway.recommended_approach && (
        <div className="p-4 rounded-brand bg-violet/5 border border-violet/10 mb-6">
          <h3 className="font-sans font-semibold text-sm text-violet mb-2">Recommended Approach</h3>
          <p className="text-sm font-sans text-aubergine/70 leading-relaxed">{pathway.recommended_approach}</p>
        </div>
      )}

      {pathway.options && (
        <div className="space-y-4 mb-6">
          {pathway.options.map((opt: any, i: number) => (
            <div key={i} className="p-4 rounded-brand border border-aubergine/5">
              <h4 className="font-sans font-semibold text-sm text-aubergine mb-2">
                Option {i + 1}: {opt.treatment}
              </h4>
              <div className="space-y-2 text-sm font-sans text-aubergine/60 leading-relaxed">
                <p><span className="font-medium text-aubergine/70">Rationale:</span> {opt.rationale}</p>
                <p><span className="font-medium text-aubergine/70">Considerations:</span> {opt.considerations}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {pathway.patient_preferences && (
        <div className="p-4 rounded-brand bg-cream border border-aubergine/5">
          <h3 className="font-sans font-semibold text-sm text-aubergine/50 mb-2">Patient Preferences</h3>
          <p className="text-sm font-sans text-aubergine/60 leading-relaxed">{pathway.patient_preferences}</p>
        </div>
      )}

      {!pathway.recommended_approach && !pathway.options && !pathway.patient_preferences && (
        <p className="text-sm font-sans text-aubergine/40">No treatment pathway available.</p>
      )}
    </div>
  )
}

function QuestionsTab({ brief }: { brief: any }) {
  const questions = brief.suggested_questions || []
  if (questions.length === 0) {
    return <p className="text-sm font-sans text-aubergine/40">No suggested questions available.</p>
  }

  return (
    <div>
      <h2 className="font-sans font-semibold text-lg text-aubergine mb-1">Suggested Questions</h2>
      <p className="text-xs font-sans text-aubergine/40 mb-5">
        Conversation starters based on the intake data — saves time by not re-asking what&apos;s already covered.
      </p>

      <div className="space-y-4">
        {questions.map((q: any, i: number) => (
          <div key={i} className="p-4 rounded-brand border border-aubergine/5">
            <p className="font-sans font-semibold text-sm text-aubergine leading-relaxed mb-2">
              {i + 1}. {q.question}
            </p>
            <p className="text-xs font-sans text-aubergine/40 leading-relaxed pl-4 border-l-2 border-aubergine/10">
              {q.context}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

const SKIP_FIELDS = new Set(['full_name', 'email', 'phone', '_authenticated'])

function formatAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function IntakeAnswersTab({ answers, patientName }: { answers: Record<string, any>; patientName: string }) {
  const sectionsWithAnswers = SECTIONS.map((section) => {
    const sectionQs = QUESTIONS.filter((q) => q.sec === section && !SKIP_FIELDS.has(q.id))
    const answered = sectionQs.filter((q) => {
      const val = answers[q.id]
      if (val === undefined || val === null || val === '') return false
      if (Array.isArray(val) && val.length === 0) return false
      return true
    })
    return { section, answered }
  }).filter((s) => s.answered.length > 0)

  return (
    <div>
      {sectionsWithAnswers.length === 0 ? (
        <p className="text-sm font-sans text-aubergine/40">No intake responses recorded yet.</p>
      ) : (
        <div id="intake-print-area">
          {sectionsWithAnswers.map(({ section, answered }) => (
            <div key={section} className="mb-6">
              <h3 className="text-xs font-sans font-semibold uppercase tracking-[0.12em] text-violet border-b border-violet/10 pb-2 mb-3">
                {section}
              </h3>
              <div className="space-y-0">
                {answered.map((q) => (
                  <div key={q.id} className="flex gap-4 py-2.5 border-b border-aubergine/[0.04] last:border-0">
                    <p className="flex-[0_0_44%] text-xs font-sans text-aubergine/50 leading-relaxed">{q.label}</p>
                    <p className="flex-1 text-xs font-sans text-aubergine font-medium leading-relaxed whitespace-pre-wrap">
                      {formatAnswer(answers[q.id])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
