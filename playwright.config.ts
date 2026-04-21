import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

// Load .env.test if it exists (local test credentials — never committed)
config({ path: '.env.test' })

/**
 * Playwright E2E test configuration.
 *
 * Prerequisites before running:
 *   1. npm run dev (the app must be running at localhost:3000)
 *   2. Copy .env.test.example to .env.test and fill in test credentials
 *   3. npx playwright install (first time only — installs browser binaries)
 *
 * Run:
 *   npm run test:e2e          — all E2E tests
 *   npm run test:e2e -- --ui  — interactive UI mode (recommended for debugging)
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Run tests sequentially to avoid race conditions on shared state (e.g. bookings)
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if test.only is accidentally committed
  forbidOnly: !!process.env.CI,

  // Retry on CI to handle flaky network timing
  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI ? 'github' : 'html',

  use: {
    // All tests run against the local dev server (or staging if TEST_BASE_URL is set)
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3001',

    // Bypass Vercel deployment protection on staging — sent on every request/navigation
    ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          },
        }
      : {}),

    // Capture a trace on first retry — viewable with `npx playwright show-trace`
    trace: 'on-first-retry',

    // Screenshot on failure for debugging
    screenshot: 'only-on-failure',

    // Reasonable timeout for network-dependent actions (Supabase auth, staging latency)
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
