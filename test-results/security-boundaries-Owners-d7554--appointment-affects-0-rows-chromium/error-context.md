# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security-boundaries.spec.ts >> Ownership checks — requires TEST_PROVIDER_EMAIL in .env.test >> H-NEW-3: appointments — PATCH on unrelated appointment affects 0 rows
- Location: tests/e2e/security-boundaries.spec.ts:186:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 401
Received array: [404, 400]
```

# Test source

```ts
  98  |   test('PATCH /api/scheduling/appointments — no session → 401', async ({ request }) => {
  99  |     const res = await request.patch('/api/scheduling/appointments', {
  100 |       data: { appointmentId: 'anything', status: 'completed' },
  101 |     })
  102 |     expect(res.status()).toBe(401)
  103 |   })
  104 | 
  105 |   test('POST /api/presentation/generate — no session → 401', async ({ request }) => {
  106 |     const res = await request.post('/api/presentation/generate', {
  107 |       data: { patientId: 'anything', selectedComponents: ['summary'] },
  108 |     })
  109 |     expect(res.status()).toBe(401)
  110 |   })
  111 | 
  112 |   test('GET /api/messages — no session → 401', async ({ request }) => {
  113 |     const res = await request.get('/api/messages?patientId=anything')
  114 |     expect(res.status()).toBe(401)
  115 |   })
  116 | 
  117 |   test('GET /api/wearables/metrics — no session → 401', async ({ request }) => {
  118 |     const res = await request.get('/api/wearables/metrics?patientId=anything')
  119 |     expect(res.status()).toBe(401)
  120 |   })
  121 | 
  122 |   test('GET /api/refill-requests — no session → 401', async ({ request }) => {
  123 |     const res = await request.get('/api/refill-requests?patientId=anything')
  124 |     expect(res.status()).toBe(401)
  125 |   })
  126 | })
  127 | 
  128 | test.describe('Seed route security (H-NEW-5)', () => {
  129 | 
  130 |   test('POST /api/seed-patients — no secret → 401', async ({ request }) => {
  131 |     const res = await request.post('/api/seed-patients', {
  132 |       data: {},
  133 |     })
  134 |     expect(res.status()).toBe(401)
  135 |   })
  136 | 
  137 |   test('POST /api/seed-patients — wrong secret → 401', async ({ request }) => {
  138 |     const res = await request.post('/api/seed-patients', {
  139 |       data: { secret: 'womenkind-seed-2026' },
  140 |     })
  141 |     // Old hardcoded secret no longer works
  142 |     expect(res.status()).toBe(401)
  143 |   })
  144 | 
  145 |   test('POST /api/seed-patients — random string secret → 401', async ({ request }) => {
  146 |     const res = await request.post('/api/seed-patients', {
  147 |       data: { secret: 'hunter2' },
  148 |     })
  149 |     expect(res.status()).toBe(401)
  150 |   })
  151 | 
  152 |   test('POST /api/seed-labs — no secret → 401 or 404', async ({ request }) => {
  153 |     const res = await request.post('/api/seed-labs', {
  154 |       data: {},
  155 |     })
  156 |     // seed-labs should also be gated
  157 |     expect([401, 404, 405]).toContain(res.status())
  158 |   })
  159 | })
  160 | 
  161 | // ── Tier 2: Requires provider credentials ────────────────────────────────────
  162 | 
  163 | test.describe('Ownership checks — requires TEST_PROVIDER_EMAIL in .env.test', () => {
  164 | 
  165 |   test.beforeEach(async ({}, testInfo) => {
  166 |     if (!hasProviderCreds) {
  167 |       testInfo.skip(true,
  168 |         'Skipped: add TEST_PROVIDER_EMAIL, TEST_PROVIDER_PASSWORD, and TEST_UNRELATED_PATIENT_ID to .env.test to run ownership tests'
  169 |       )
  170 |     }
  171 |   })
  172 | 
  173 |   test('H-NEW-1: chat — provider blocked from accessing unrelated patient (403)', async ({ page, request }) => {
  174 |     await loginAsProvider(page)
  175 |     const cookies = await page.context().cookies()
  176 |     const res = await request.post('/api/chat', {
  177 |       headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
  178 |       data: {
  179 |         messages: [{ role: 'user', content: 'summarise this patient' }],
  180 |         context: { page: 'provider', patientId: UNRELATED_PATIENT_ID },
  181 |       },
  182 |     })
  183 |     expect(res.status()).toBe(403)
  184 |   })
  185 | 
  186 |   test('H-NEW-3: appointments — PATCH on unrelated appointment affects 0 rows', async ({ page, request }) => {
  187 |     await loginAsProvider(page)
  188 |     const cookies = await page.context().cookies()
  189 |     const res = await request.patch('/api/scheduling/appointments', {
  190 |       headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
  191 |       data: { appointmentId: FAKE_APPOINTMENT_ID, status: 'completed' },
  192 |     })
  193 |     // Either 404 or 200 with null/empty appointment — never succeeds on a foreign appointment
  194 |     if (res.status() === 200) {
  195 |       const body = await res.json()
  196 |       expect(body.appointment).toBeFalsy()
  197 |     } else {
> 198 |       expect([404, 400]).toContain(res.status())
      |                          ^ Error: expect(received).toContain(expected) // indexOf
  199 |     }
  200 |   })
  201 | 
  202 |   test('H-NEW-4: prescribe — provider blocked from prescribing to unrelated patient (403)', async ({ page, request }) => {
  203 |     await loginAsProvider(page)
  204 |     const cookies = await page.context().cookies()
  205 |     const res = await request.post('/api/canvas/prescribe', {
  206 |       headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
  207 |       data: {
  208 |         patientId: UNRELATED_PATIENT_ID,
  209 |         medication: 'Estradiol',
  210 |         dosage: '1mg',
  211 |         frequency: 'daily',
  212 |         instructions: 'Take with food',
  213 |       },
  214 |     })
  215 |     expect(res.status()).toBe(403)
  216 |   })
  217 | 
  218 |   test('M-NEW-1: presentation — created record uses session provider, not body provider', async ({ page, request }) => {
  219 |     await loginAsProvider(page)
  220 |     const cookies = await page.context().cookies()
  221 |     const FORGED_PROVIDER_ID = '00000000-0000-0000-0000-000000000001'
  222 |     const res = await request.post('/api/presentation/generate', {
  223 |       headers: { Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') },
  224 |       data: {
  225 |         patientId: UNRELATED_PATIENT_ID,
  226 |         providerId: FORGED_PROVIDER_ID,
  227 |         selectedComponents: ['summary'],
  228 |       },
  229 |     })
  230 |     // If the patient relationship check blocks it first, we get 403 — that's fine too
  231 |     if (res.status() === 200) {
  232 |       const body = await res.json()
  233 |       // The presentation should NOT be attributed to the forged provider
  234 |       expect(body.providerId).not.toBe(FORGED_PROVIDER_ID)
  235 |     } else {
  236 |       expect([403, 404]).toContain(res.status())
  237 |     }
  238 |   })
  239 | })
  240 | 
```