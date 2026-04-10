import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 100% of transactions in production for full visibility.
  // Lower to 0.2 (20%) if volume becomes a cost concern.
  tracesSampleRate: 1.0,

  // Session replay: capture 10% of sessions normally, 100% when an error occurs.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
  ],

  // Suppress Sentry debug logs in production
  debug: false,
})
