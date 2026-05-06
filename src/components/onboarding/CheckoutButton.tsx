'use client'

import { useState } from 'react'

export default function CheckoutButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const plan = typeof document !== 'undefined'
        ? document.cookie.split('; ').find(r => r.startsWith('wk_selected_plan='))?.split('=')[1]
        : undefined

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'onboarding_membership', plan: plan ? decodeURIComponent(plan) : undefined }),
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
      {error && (
        <p style={{ fontSize: '14px', color: '#c0392b', marginBottom: '12px', textAlign: 'center' }}>{error}</p>
      )}
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
        }}
      >
        {loading ? 'Redirecting to payment…' : 'Complete membership'}
      </button>
    </div>
  )
}
