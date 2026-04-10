import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 100% of server-side transactions.
  // Critical for catching errors in API routes (payments, bookings, webhooks).
  tracesSampleRate: 1.0,

  debug: false,
})
