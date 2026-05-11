'use client'

import { useState } from 'react'

const PLAN_LABELS: Record<string, { name: string; entryPrice: string; price: string }> = {
  foundations: { name: 'Foundations', entryPrice: '$295', price: '$129' },
  vitality:    { name: 'Vitality',    entryPrice: '$600', price: '$249' },
  concierge:   { name: 'Concierge',   entryPrice: '$750', price: '$549' },
}

export default function QuickCheckoutButton({ plan }: { plan: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const info = PLAN_LABELS[plan] ?? PLAN_LABELS.vitality

  async function handleClick() {
    setLoading(true)
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
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{
        backgroundColor: '#f7f3ee',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>
            Selected plan
          </p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 400, color: '#280f49' }}>{info.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 2px', fontSize: '22px', fontWeight: 400, color: '#280f49', letterSpacing: '-0.02em' }}>{info.entryPrice}</p>
          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(66,42,31,0.5)' }}>then {info.price}/mo</p>
        </div>
      </div>
      {error && <p style={{ fontSize: '14px', color: '#c0392b', marginBottom: '12px' }}>{error}</p>}
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'block',
          width: '100%',
          backgroundColor: loading ? 'rgba(148,79,237,0.6)' : '#944fed',
          color: '#ffffff',
          padding: '16px 32px',
          borderRadius: '100px',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: '16px',
          fontFamily: 'inherit',
          marginBottom: '16px',
        }}
      >
        {loading ? 'Redirecting…' : 'Continue to payment'}
      </button>
      <p style={{ textAlign: 'center', margin: 0 }}>
        <a href="/join" style={{ fontSize: '13px', color: 'rgba(66,42,31,0.5)', textDecoration: 'underline' }}>
          Choose a different plan
        </a>
      </p>
    </div>
  )
}
