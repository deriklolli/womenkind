// @ts-check
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vszdbblhxdjxzmnkakhu.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Your Sentry organization and project slugs (from sentry.io → Settings → General)
  org: 'lolliprojects',
  project: 'womenkind',

  // Suppress source map upload logs during build
  silent: !process.env.CI,

  // Upload larger source maps for better stack traces in production
  widenClientFileUpload: true,

  // Hide source maps from the client bundle (security best practice)
  hideSourceMaps: true,

  // Remove Sentry logger statements from the production bundle
  disableLogger: true,

  // Automatically instrument Vercel Cron Monitors
  automaticVercelMonitors: true,
})
