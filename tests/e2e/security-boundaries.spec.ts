/**
 * E2E: Security boundary tests
 *
 * Verifies the fixes from the post-RDS-migration security audit (April 21, 2026).
 *
 * Tier 1 — No credentials required (runs always):
 *   - Unauthenticated requests to PHI routes return 401
 *   - Seed route blocks wrong/missing secret
 *
 * Tier 2 — Requires TEST_PROVIDER_EMAIL + TEST_PROVIDER_PASSWORD in .env.test:
 *   - Provider cannot access patient they have no appointment with (403)
 *   - Provider cannot update another provider's appointment
 *   - Provider cannot prescribe to an unrelated patient (403)
 *   - care presentation uses session provider, not body provider
 *
 * Setup for Tier 2:
 *   1. Create a test provider account on staging Supabase
 *   2. Create a test patient with NO appointment linked to that provider
 *   3. Add TEST_PROVIDER_EMAIL, TEST_PROVIDER_PASSWORD, and TEST_UNRELATED_PATIENT_ID to .env.test
 */

import { test, expect } from '@playwright/test'

const PROVIDER_EMAIL = process.env.TEST_PROVIDER_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.TEST_PROVIDER_PASSWORD ?? ''
const UNRELATED_PATIENT_ID = process.env.TEST_UNRELATED_PATIENT_ID ?? '00000000-0000-0000-0000-000000000099'
const FAKE_APPOINTMENT_ID = '00000000-0000-0000-0000-000000000099'

const hasProviderCreds = !!(PROVIDER_EMAIL && PROVIDER_PASSWORD)

/**
 * Sign in directly against the Supabase auth API and inject the session cookie
 * into Playwright's browser context. This avoids the Vercel deployment protection
 * gate that intercepts browser navigation to the staging URL.
 */
async function loginAsProvider(page: import('@playwright/test').Page) {
  const supabaseUrl = process.env.TEST_SUPABASE_URL!
  const supabaseAnonKey = process.env.TEST_SUPABASE_ANON_KEY!

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ email: PROVIDER_EMAIL, password: PROVIDER_PASSWORD }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase sign-in failed (${res.status}): ${body}`)
  }

  const session = await res.json()

  // @supabase/ssr stores the session as a JSON-encoded cookie. The cookie name
  // is derived from the project ref inside the URL.
  const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\./)?.[1] ?? ''
  const cookieName = `sb-${projectRef}-auth-token`
  const cookieValue = JSON.stringify(session)

  const baseUrl = new URL(process.env.TEST_BASE_URL || 'http://localhost:3001')
  await page.context().addCookies([{
    name: cookieName,
    value: cookieValue,
    domain: baseUrl.hostname,
    path: '/',
    httpOnly: false,
    secure: baseUrl.protocol === 'https:',
    sameSite: 'Lax',
  }])
}

// ── Tier 1: No credentials required ─────────────────────────────────────────

test.describe('Unauthenticated access — all PHI routes return 401', () => {

  test('POST /api/chat — no session → 401', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { messages: [{ role: 'user', content: 'hello' }], context: { page: 'provider' } },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/prescriptions — no session → 401', async ({ request }) => {
    const res = await request.get('/api/prescriptions?patientId=anything')
    expect(res.status()).toBe(401)
  })

  test('POST /api/canvas/prescribe — no session → 401', async ({ request }) => {
    const res = await request.post('/api/canvas/prescribe', {
      data: { patientId: 'anything', medication: 'test' },
    })
    expect(res.status()).toBe(401)
  })

  test('PATCH /api/scheduling/appointments — no session → 401', async ({ request }) => {
    const res = await request.patch('/api/scheduling/appointments', {
      data: { appointmentId: 'anything', status: 'completed' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/presentation/generate — no session → 401', async ({ request }) => {
    const res = await request.post('/api/presentation/generate', {
      data: { patientId: 'anything', selectedComponents: ['summary'] },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/messages — no session → 401', async ({ request }) => {
    const res = await request.get('/api/messages?patientId=anything')
    expect(res.status()).toBe(401)
  })

  test('GET /api/wearables/metrics — no session → 401', async ({ request }) => {
    const res = await request.get('/api/wearables/metrics?patientId=anything')
    expect(res.status()).toBe(401)
  })

  test('GET /api/refill-requests — no session → 401', async ({ request }) => {
    const res = await request.get('/api/refill-requests?patientId=anything')
    expect(res.status()).toBe(401)
  })
})

test.describe('Seed route security (H-NEW-5)', () => {

  test('POST /api/seed-patients — no secret → 401', async ({ request }) => {
    const res = await request.post('/api/seed-patients', {
      data: {},
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/seed-patients — wrong secret → 401', async ({ request }) => {
    const res = await request.post('/api/seed-patients', {
      data: { secret: 'womenkind-seed-2026' },
    })
    // Old hardcoded secret no longer works
    expect(res.status()).toBe(401)
  })

  test('POST /api/seed-patients — random string secret → 401', async ({ request }) => {
    const res = await request.post('/api/seed-patients', {
      data: { secret: 'hunter2' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/seed-labs — no secret → 401 or 404', async ({ request }) => {
    const res = await request.post('/api/seed-labs', {
      data: {},
    })
    // seed-labs should also be gated
    expect([401, 404, 405]).toContain(res.status())
  })
})

// ── Tier 2: Requires provider credentials ────────────────────────────────────

test.describe('Ownership checks — requires TEST_PROVIDER_EMAIL in .env.test', () => {

  test.beforeEach(async ({}, testInfo) => {
    if (!hasProviderCreds) {
      testInfo.skip(true,
        'Skipped: add TEST_PROVIDER_EMAIL, TEST_PROVIDER_PASSWORD, and TEST_UNRELATED_PATIENT_ID to .env.test to run ownership tests'
      )
    }
  })

  test('H-NEW-1: chat — provider blocked from accessing unrelated patient (403)', async ({ page, request }) => {
    await loginAsProvider(page)
    const cookies = await page.context().cookies()
    const res = await request.post('/api/chat', {
      headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
      data: {
        messages: [{ role: 'user', content: 'summarise this patient' }],
        context: { page: 'provider', patientId: UNRELATED_PATIENT_ID },
      },
    })
    expect(res.status()).toBe(403)
  })

  test('H-NEW-3: appointments — PATCH on unrelated appointment affects 0 rows', async ({ page, request }) => {
    await loginAsProvider(page)
    const cookies = await page.context().cookies()
    const res = await request.patch('/api/scheduling/appointments', {
      headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
      data: { appointmentId: FAKE_APPOINTMENT_ID, status: 'completed' },
    })
    // Either 404 or 200 with null/empty appointment — never succeeds on a foreign appointment
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.appointment).toBeFalsy()
    } else {
      expect([404, 400]).toContain(res.status())
    }
  })

  test('H-NEW-4: prescribe — provider blocked from prescribing to unrelated patient (403)', async ({ page, request }) => {
    await loginAsProvider(page)
    const cookies = await page.context().cookies()
    const res = await request.post('/api/canvas/prescribe', {
      headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
      data: {
        patientId: UNRELATED_PATIENT_ID,
        medication: 'Estradiol',
        dosage: '1mg',
        frequency: 'daily',
        instructions: 'Take with food',
      },
    })
    expect(res.status()).toBe(403)
  })

  test('M-NEW-1: presentation — created record uses session provider, not body provider', async ({ page, request }) => {
    await loginAsProvider(page)
    const cookies = await page.context().cookies()
    const FORGED_PROVIDER_ID = '00000000-0000-0000-0000-000000000001'
    const res = await request.post('/api/presentation/generate', {
      headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
      data: {
        patientId: UNRELATED_PATIENT_ID,
        providerId: FORGED_PROVIDER_ID,
        selectedComponents: ['summary'],
      },
    })
    // If the patient relationship check blocks it first, we get 403 — that's fine too
    if (res.status() === 200) {
      const body = await res.json()
      // The presentation should NOT be attributed to the forged provider
      expect(body.providerId).not.toBe(FORGED_PROVIDER_ID)
    } else {
      expect([403, 404]).toContain(res.status())
    }
  })
})
