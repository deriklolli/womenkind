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
  },
  {
    key: 'vitality',
    name: 'Vitality',
    tag: 'Tier 2 · Core',
    entryPrice: '$600',
    entryLabel: 'Initial consultation',
    price: '$249',
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
    <div>
      {error && (
        <p style={{ fontSize: '14px', color: '#c0392b', marginBottom: '16px', textAlign: 'center' }}>{error}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            style={{
              backgroundColor: plan.highlighted ? '#280f49' : '#f7f3ee',
              borderRadius: '16px',
              padding: '20px 24px',
              border: plan.highlighted ? 'none' : '1px solid rgba(66,42,31,0.1)',
              position: 'relative',
            }}
          >
            {plan.badge && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '24px',
                backgroundColor: '#944fed',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '4px',
              }}>
                {plan.badge}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: plan.highlighted ? 'rgba(255,255,255,0.5)' : 'rgba(66,42,31,0.45)' }}>
                  {plan.tag}
                </p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 400, color: plan.highlighted ? '#ffffff' : '#280f49' }}>
                  {plan.name}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 2px', fontSize: '22px', fontWeight: 400, color: plan.highlighted ? '#ffffff' : '#280f49', letterSpacing: '-0.02em' }}>
                  {plan.entryPrice}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: plan.highlighted ? 'rgba(255,255,255,0.55)' : 'rgba(66,42,31,0.5)' }}>
                  {plan.entryLabel} · then {plan.price}/mo
                </p>
              </div>
            </div>
            <button
              onClick={() => handleSelect(plan.key)}
              disabled={loadingPlan !== null}
              style={{
                display: 'block',
                width: '100%',
                backgroundColor: loadingPlan === plan.key
                  ? 'rgba(148,79,237,0.6)'
                  : plan.highlighted ? '#944fed' : '#280f49',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '100px',
                border: 'none',
                cursor: loadingPlan !== null ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            >
              {loadingPlan === plan.key ? 'Redirecting…' : 'Select this plan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
