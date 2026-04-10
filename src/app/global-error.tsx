'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Global error boundary for the Next.js App Router.
 * Catches unhandled errors at the root layout level and reports them to Sentry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f7f3ee',
          color: '#280f49',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#8e7f79', marginBottom: '1.5rem', maxWidth: '400px' }}>
          An unexpected error occurred. Our team has been notified. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: '#944fed',
            color: '#fff',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
