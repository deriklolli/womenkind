// src/app/signup/verify/page.tsx
'use client'

import { useState } from 'react'

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    setLoading(true)
    setError(null)
    try {
      // Read the email cookie set during signup (fallback for when session wasn't established)
      const emailCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('wk_signup_email='))
        ?.split('=')[1]
      const body = emailCookie ? { email: decodeURIComponent(emailCookie) } : {}
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setResent(true)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error === 'Too many requests' ? 'Please wait a few minutes before resending.' : 'Failed to resend. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f3ee',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      padding: '40px 24px',
    }}>
      <img src="/womenkind-logo-dark.png" alt="Womenkind" style={{ height: '44px', marginBottom: '32px' }} />
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '48px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{ margin: '0 0 12px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>
          Check your inbox
        </h1>
        <p style={{ margin: '0 0 8px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
          We sent a verification link to your email address. Click it to continue setting up your account.
        </p>
        <p style={{ margin: '0 0 32px', fontSize: '14px', color: 'rgba(66,42,31,0.45)', lineHeight: 1.6 }}>
          Don't see it? Check your spam or junk folder.
        </p>
        {error && (
          <p style={{ fontSize: '14px', color: '#c0392b', marginBottom: '12px' }}>{error}</p>
        )}
        {resent ? (
          <p style={{ fontSize: '14px', color: '#944fed', fontWeight: 600 }}>
            Email resent — check your inbox (and spam folder).
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#944fed',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {loading ? 'Sending...' : "Didn't get it? Resend the email"}
          </button>
        )}
      </div>
    </div>
  )
}
