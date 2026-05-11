'use client'

import { useState } from 'react'

const PLANS = [
  {
    key: 'foundations',
    name: 'Foundations',
    tag: 'Tier 1',
    entryPrice: '$295',
    entryLabel: 'Discovery visit',
    price: '$129',
    prepay: '$1,290 annual prepay — 2 months free',
    entry: '$295 Discovery visit (15-min intake review & care plan preview)',
    who: "For the woman in early perimenopause who wants a midlife specialist relationship before symptoms escalate — or before she's ready for HRT.",
    includesLabel: 'Includes',
    features: [
      'One 15-min telehealth check-in per quarter',
      'Secure messaging via the Womenkind platform',
      'Symptom tracker',
      'Personalized care presentation tailored to your intake',
      'Oura integration — patient-facing dashboard',
      'Member discount (25%) on supplement protocols via Fullscript',
    ],
  },
  {
    key: 'vitality',
    name: 'Vitality',
    tag: 'Tier 2 · Core',
    entryPrice: '$600',
    entryLabel: 'Initial consultation',
    price: '$249',
    prepay: '$2,490 annual prepay — 2 months free',
    entry: '$600 comprehensive consultation (1–2 hr with Dr. Urban)',
    who: 'For the woman ready for HRT, or already on it, who wants ongoing specialty care with predictable costs and a clinician who actually knows her.',
    includesLabel: 'Everything in Foundations, plus',
    features: [
      '30-min visits quarterly — video or in-office',
      'Unlimited secure messaging — 1 business day response',
      'Full HRT prescription management',
      'Annual hormone & wellness panel included',
      'Negotiated cash lab pricing (40–60% under retail)',
      'Oura data flows into your chart — Dr. Urban reviews trends before each visit',
    ],
    highlighted: true,
    badge: 'Most members',
  },
  {
    key: 'concierge',
    name: 'Concierge',
    tag: 'Tier 3 · Premium',
    entryPrice: '$750',
    entryLabel: 'Initial consultation',
    price: '$549',
    prepay: '$5,490 annual prepay — 2 months free',
    entry: '$750 comprehensive consultation (1–2 hr with Dr. Urban)',
    who: 'For the Park City patient considering Cenegenics. Same depth of access, focused on what actually matters for midlife women — at a third of the price.',
    includesLabel: 'Everything in Vitality, plus',
    features: [
      'Up to 3 quarterly visits with Dr. Urban',
      'Same-day messaging response',
      'Two comprehensive panels per year + reactive labs at cost',
      'Active Oura monitoring — outreach when patterns shift',
      'Priority scheduling & in-office availability',
      'Annual longevity review & 12-month plan',
    ],
  },
]

export default function TierCheckoutCards() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(plan: string) {
    setLoadingPlan(plan)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'onboarding_membership', plan }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Something went wrong. Please try again.')
        return
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <>
      <style>{`
        .tier-btn { transition: opacity 0.15s, transform 0.15s; }
        .tier-btn:hover { opacity: 0.85; transform: scale(1.02); }
        .tier-card { transition: box-shadow 0.2s, transform 0.2s; }
        .tier-card:hover { transform: translateY(-3px); }
        .tier-card-white:hover { box-shadow: 0 12px 40px rgba(66,42,31,0.14); }
        .tier-card-dark:hover { box-shadow: 0 12px 40px rgba(40,15,73,0.32); }
      `}</style>
      {error && (
        <p style={{ fontSize: '14px', color: '#c0392b', marginBottom: '16px', textAlign: 'center' }}>{error}</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px', alignItems: 'start' }}>
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`tier-card ${plan.highlighted ? 'tier-card-dark' : 'tier-card-white'}`}
            style={{
              backgroundColor: plan.highlighted ? '#280f49' : '#ffffff',
              borderRadius: '20px',
              padding: '40px 32px',
              border: plan.highlighted ? 'none' : '1px solid rgba(66,42,31,0.1)',
              boxShadow: plan.highlighted ? '0 8px 32px rgba(40,15,73,0.18)' : '0 4px 20px rgba(66,42,31,0.08)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {plan.badge && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '32px',
                backgroundColor: '#944fed',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '5px 12px',
                borderRadius: '4px',
              }}>
                {plan.badge}
              </div>
            )}

            <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: plan.highlighted ? 'rgba(255,255,255,0.5)' : 'rgba(66,42,31,0.45)' }}>
              {plan.tag}
            </p>
            <p style={{ margin: '0 0 16px', fontSize: '28px', fontWeight: 400, color: plan.highlighted ? '#ffffff' : '#280f49', letterSpacing: '-0.01em' }}>
              {plan.name}
            </p>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '48px', fontWeight: 400, color: plan.highlighted ? '#ffffff' : '#280f49', lineHeight: 1, letterSpacing: '-0.02em' }}>
                {plan.entryPrice}
              </span>
              <span style={{ fontSize: '13px', color: plan.highlighted ? 'rgba(255,255,255,0.55)' : 'rgba(66,42,31,0.5)' }}>
                {plan.entryLabel}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '15px', color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'rgba(66,42,31,0.6)' }}>
                then {plan.price}/mo
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                backgroundColor: plan.highlighted ? 'rgba(148,79,237,0.35)' : 'rgba(148,79,237,0.12)',
                color: plan.highlighted ? '#d4a8ff' : '#944fed',
                padding: '3px 8px',
                borderRadius: '100px',
              }}>
                First month free
              </span>
            </div>

            <div style={{
              padding: '12px 0',
              borderTop: `1px solid ${plan.highlighted ? 'rgba(255,255,255,0.15)' : 'rgba(66,42,31,0.1)'}`,
              borderBottom: `1px solid ${plan.highlighted ? 'rgba(255,255,255,0.15)' : 'rgba(66,42,31,0.1)'}`,
              marginBottom: '20px',
              fontSize: '12px',
              color: plan.highlighted ? 'rgba(255,255,255,0.65)' : 'rgba(66,42,31,0.6)',
              lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 600, color: plan.highlighted ? 'rgba(255,255,255,0.85)' : 'rgba(66,42,31,0.8)' }}>Entry visit: </span>
              {plan.entry}
            </div>

            <p style={{ margin: '0 0 20px', fontSize: '14px', fontStyle: 'italic', color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'rgba(66,42,31,0.6)', lineHeight: 1.55 }}>
              {plan.who}
            </p>

            <p style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: plan.highlighted ? 'rgba(255,255,255,0.5)' : 'rgba(66,42,31,0.4)' }}>
              {plan.includesLabel}
            </p>
            <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', flex: 1 }}>
              {plan.features.map((f) => (
                <li key={f} style={{
                  padding: '8px 0 8px 16px',
                  fontSize: '13.5px',
                  color: plan.highlighted ? 'rgba(255,255,255,0.8)' : 'rgba(66,42,31,0.75)',
                  lineHeight: 1.5,
                  borderBottom: `1px solid ${plan.highlighted ? 'rgba(255,255,255,0.08)' : 'rgba(66,42,31,0.06)'}`,
                  position: 'relative',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: '#944fed', fontWeight: 600, fontSize: '12px' }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              className="tier-btn"
              onClick={() => handleSelect(plan.key)}
              disabled={loadingPlan !== null}
              style={{
                display: 'block',
                width: '100%',
                backgroundColor: loadingPlan === plan.key
                  ? 'rgba(148,79,237,0.6)'
                  : plan.highlighted ? '#944fed' : '#280f49',
                color: '#ffffff',
                padding: '14px 32px',
                borderRadius: '100px',
                border: 'none',
                cursor: loadingPlan !== null ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '15px',
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
            >
              {loadingPlan === plan.key ? 'Redirecting…' : 'Get started'}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
