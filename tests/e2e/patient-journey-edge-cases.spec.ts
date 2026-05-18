/**
 * E2E: Patient journey edge cases
 *
 * Tests realistic failure/re-entry scenarios a patient might hit:
 *   1. Duplicate email on signup → shows inline error
 *   2. Mid-intake drop-off → resume restores progress
 *   3. Re-entry to /intake after submission → redirects to dashboard
 *   4. Back to /signup/resume after payment → no double-pay UI
 *   5. Mobile 390×844 viewport — full happy path
 *
 * Requires ENABLE_TEST_ROUTES=true on the target environment.
 */

import { test, expect, type Page } from '@playwright/test'

// ── Helpers (mirrored from patient-journey.spec.ts) ────────────────────────────

async function next(page: Page) {
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(600)
}

async function cont(page: Page) {
  const btn = page.getByRole('button', { name: 'Continue' })
  await btn.waitFor({ state: 'visible' })
  await page.waitForTimeout(800)
  await btn.click()
  await page.waitForTimeout(600)
}

async function pick(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(500)
}

async function multi(page: Page, labels: string[]) {
  for (const label of labels) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.waitForTimeout(150)
  }
  await next(page)
}

async function fillIntake(page: Page) {
  await expect(page.getByText('Begin Your Intake')).toBeVisible({ timeout: 15_000 })
  await page.locator('input[type="checkbox"]').check()
  await page.waitForTimeout(300)
  await page.getByText('Begin Your Intake').click()
  await page.waitForTimeout(600)

  // About you
  await page.locator('input[type="date"]').waitFor({ state: 'visible', timeout: 15_000 })
  await page.locator('input[type="date"]').fill('1970-03-15')
  await next(page)
  await page.getByPlaceholder('(555) 555-5555').fill('5551234567')
  await next(page)
  await page.getByPlaceholder("e.g. 5'6\"").fill('56')
  await next(page)
  await page.getByPlaceholder('e.g. 150 lb').fill('150 lb')
  await next(page)
  await next(page) // pcp optional
  await page.getByPlaceholder('Name + location').fill('CVS Main St')
  await next(page)

  // Goals
  await cont(page)
  await page.getByPlaceholder('Describe in your own words...').fill('Better sleep and more energy')
  await next(page)
  await multi(page, ['Energy', 'Sleep'])

  // Reproductive history
  await cont(page)
  await pick(page, 'Yes')
  await pick(page, 'Both ovaries present')
  await pick(page, 'No natural period for 12+ months')
  await multi(page, ['None of these'])

  // Health basics
  await cont(page)
  await pick(page, 'No')

  // Medications
  await cont(page)
  await multi(page, ['None of these'])
  await page.locator('textarea').fill('No current medications.')
  await next(page)
  await pick(page, 'No')
  await pick(page, 'No')

  // Medical history
  await cont(page)
  await multi(page, ['None of these'])
  await pick(page, 'Never')
  await pick(page, 'No')
  await multi(page, ['None of these'])

  // Vasomotor
  await cont(page)
  await pick(page, '0 — None')

  // Mood & cognition
  await cont(page)
  await pick(page, 'None')
  await pick(page, 'None')
  await pick(page, 'Mild')
  await pick(page, 'Mild')
  await pick(page, 'None')
  await pick(page, 'No')
  await pick(page, 'None')
  await pick(page, 'None')
  await pick(page, 'Mild')
  await pick(page, 'Mild')
  await pick(page, 'Mild')
  await pick(page, 'Mild')

  // Vaginal & bladder
  await cont(page)
  await multi(page, ['None of these'])
  await pick(page, 'None')
  await pick(page, 'None')

  // Body & bone
  await cont(page)
  await pick(page, 'No')
  await pick(page, 'No')
  await next(page) // protein optional
  await next(page) // alcohol optional
  await pick(page, 'No')
  await pick(page, 'No')
  await pick(page, 'No')
  await pick(page, 'Never had one')

  // Treatment preferences
  await cont(page)
  await pick(page, 'It does not matter')
  await page.locator('textarea').fill('Have not tried any treatments yet.')
  await next(page)
  await multi(page, ['Not sure yet'])
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Submit' }).click()
}

// Sign up → verify → mock payment, return the email used
async function signupAndPay(page: Page, email: string, firstName: string) {
  await page.goto('/signup?plan=vitality')
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  await page.getByPlaceholder('Jane').fill(firstName)
  await page.getByPlaceholder('Smith').fill('Test')
  await page.getByPlaceholder('you@email.com').fill(email)
  await page.getByPlaceholder('Create a password').fill('TestPatient2026!')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page).toHaveURL(/\/signup\/verify/, { timeout: 15_000 })

  const verifyRes = await page.request.get(
    `/api/debug/verification-url?email=${encodeURIComponent(email)}`
  )
  expect(verifyRes.ok(), `verification-url returned ${verifyRes.status()}`).toBeTruthy()
  const { verifyUrl } = await verifyRes.json()
  const verifyPath = new URL(verifyUrl).pathname + new URL(verifyUrl).search
  await page.goto(verifyPath)
  await expect(page).toHaveURL(/\/signup\/resume/, { timeout: 15_000 })

  const payRes = await page.request.post('/api/debug/mock-payment')
  expect(payRes.ok(), `mock-payment returned ${payRes.status()}`).toBeTruthy()
}

async function cleanup(page: Page, email: string) {
  try {
    await page.request.delete(`/api/debug/cleanup-test-patient?email=${encodeURIComponent(email)}`)
  } catch {
    // best-effort
  }
}

// ── Test setup ─────────────────────────────────────────────────────────────────

const RUN_ID = Date.now()

function testEmail(n: number) {
  return `wk-edge-${RUN_ID}-${n}@womenkind.dev`
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test('signup — duplicate email shows inline error, does not crash', async ({ page }) => {
  test.setTimeout(60_000)
  const email = testEmail(1)

  // Seed the account directly via API
  const seedRes = await page.request.post('/api/auth/signup', {
    data: { firstName: 'Jane', lastName: 'Test', email, password: 'TestPatient2026!', plan: 'vitality' },
  })
  expect(seedRes.ok(), `seed signup returned ${seedRes.status()}`).toBeTruthy()

  // Now try to sign up with the same email via UI
  await page.goto('/signup?plan=vitality')
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  await page.getByPlaceholder('Jane').fill('Jane')
  await page.getByPlaceholder('Smith').fill('Test')
  await page.getByPlaceholder('you@email.com').fill(email)
  await page.getByPlaceholder('Create a password').fill('TestPatient2026!')
  await page.getByRole('button', { name: 'Create Account' }).click()

  // Should stay on /signup, not redirect to /verify
  await page.waitForTimeout(3_000)
  await expect(page).toHaveURL(/\/signup(?!\/verify)/, { timeout: 10_000 })

  // Inline error should mention the account already exists
  await expect(page.locator('p.text-red-600')).toContainText('already', { timeout: 5_000 })

  await cleanup(page, email)
})

test.afterEach(async ({ page }, testInfo) => {
  // Per-test cleanup is done inline above; this is a safety net for unexpected failures
  if (testInfo.status !== 'passed') {
    // RUN_ID-based emails for tests 2–5 are cleaned up in their own afterEach blocks below
  }
})

test('intake — returning to /intake after partial completion resumes mid-form', async ({ page }) => {
  test.setTimeout(180_000)
  const email = testEmail(2)

  try {
    await signupAndPay(page, email, 'Jane2')

    await page.goto('/intake')
    await expect(page).toHaveURL(/\/intake/, { timeout: 15_000 })

    // Start the intake
    await expect(page.getByText('Begin Your Intake')).toBeVisible({ timeout: 15_000 })
    await page.locator('input[type="checkbox"]').check()
    await page.waitForTimeout(300)
    await page.getByText('Begin Your Intake').click()
    await page.waitForTimeout(600)

    // Answer 6 questions (DOB, phone, height, weight, skip pcp, pharmacy)
    await page.locator('input[type="date"]').waitFor({ state: 'visible', timeout: 15_000 })
    await page.locator('input[type="date"]').fill('1970-03-15')
    await next(page)
    await page.getByPlaceholder('(555) 555-5555').fill('5551234567')
    await next(page)
    await page.getByPlaceholder("e.g. 5'6\"").fill('56')
    await next(page)
    await page.getByPlaceholder('e.g. 150 lb').fill('150 lb')
    await next(page)
    await next(page) // pcp optional
    await page.getByPlaceholder('Name + location').fill('CVS Main St')
    await next(page)

    // Wait for auto-save debounce to flush (2s debounce + buffer)
    await page.waitForTimeout(3_500)

    // Simulate drop-off by navigating away and clearing client state
    await page.goto('about:blank')
    await page.waitForTimeout(500)

    // Return to /intake
    await page.goto('/intake')
    await expect(page).toHaveURL(/\/intake/, { timeout: 15_000 })

    // Should NOT be on the welcome screen
    await page.waitForTimeout(3_000) // let auth check + resume fetch complete
    const beginButton = page.getByText('Begin Your Intake')
    await expect(beginButton).not.toBeVisible({ timeout: 5_000 })

    // Should be mid-form: Back button or Next button visible
    const backButton = page.getByRole('button', { name: 'Back' })
    const nextButton = page.getByRole('button', { name: 'Next' })
    const eitherVisible =
      (await backButton.isVisible().catch(() => false)) ||
      (await nextButton.isVisible().catch(() => false))
    expect(eitherVisible, 'Expected Back or Next button to be visible (mid-form resume)').toBeTruthy()
  } finally {
    await cleanup(page, email)
  }
})

test('intake — navigating to /intake after submission redirects to /patient/dashboard', async ({ page }) => {
  test.setTimeout(300_000)
  const email = testEmail(3)

  try {
    await signupAndPay(page, email, 'Jane3')

    await page.goto('/intake')
    await expect(page).toHaveURL(/\/intake/, { timeout: 15_000 })
    await fillIntake(page)

    await expect(page).toHaveURL(/\/intake\/complete/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/patient\/dashboard/, { timeout: 20_000 })

    // Navigate back to /intake — active patient should be redirected away
    await page.goto('/intake')
    await expect(page).toHaveURL(/\/patient\/dashboard/, { timeout: 15_000 })
  } finally {
    await cleanup(page, email)
  }
})

test('signup/resume — navigating back after payment shows paid state, not payment UI', async ({ page }) => {
  test.setTimeout(60_000)
  const email = testEmail(4)

  try {
    await signupAndPay(page, email, 'Jane4')

    // First load — should show paid state
    await page.goto('/signup/resume')
    await expect(page).toHaveURL(/\/signup\/resume/, { timeout: 15_000 })
    await expect(page.getByText("You're ready to begin")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: 'Start your intake' })).toBeVisible()

    // Second load (simulate browser back / re-navigation) — still no payment UI
    await page.goto('/signup/resume')
    await expect(page).toHaveURL(/\/signup\/resume/, { timeout: 15_000 })
    await expect(page.getByText('Choose your membership')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText("You're ready to begin")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: 'Start your intake' })).toBeVisible()
  } finally {
    await cleanup(page, email)
  }
})

test('mobile 390×844 — full journey: signup → verify → payment → intake → dashboard', async ({ page }) => {
  test.setTimeout(300_000)
  const email = testEmail(5)

  await page.setViewportSize({ width: 390, height: 844 })

  try {
    // Signup
    await page.goto('/signup?plan=vitality')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 15_000 })
    await page.getByPlaceholder('Jane').fill('Jane5')
    await page.getByPlaceholder('Smith').fill('Test')
    await page.getByPlaceholder('you@email.com').fill(email)
    await page.getByPlaceholder('Create a password').fill('TestPatient2026!')
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL(/\/signup\/verify/, { timeout: 15_000 })

    // Verify
    const verifyRes = await page.request.get(
      `/api/debug/verification-url?email=${encodeURIComponent(email)}`
    )
    expect(verifyRes.ok(), `verification-url returned ${verifyRes.status()}`).toBeTruthy()
    const { verifyUrl } = await verifyRes.json()
    const verifyPath = new URL(verifyUrl).pathname + new URL(verifyUrl).search
    await page.goto(verifyPath)
    await expect(page).toHaveURL(/\/signup\/resume/, { timeout: 15_000 })

    // Mock payment
    const payRes = await page.request.post('/api/debug/mock-payment')
    expect(payRes.ok(), `mock-payment returned ${payRes.status()}`).toBeTruthy()

    // Resume page — verify paid state visible at mobile width
    await page.goto('/signup/resume')
    await expect(page.getByText("You're ready to begin")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: 'Start your intake' })).toBeVisible()

    // Intake
    await page.getByRole('link', { name: 'Start your intake' }).click()
    await expect(page).toHaveURL(/\/intake/, { timeout: 15_000 })
    await fillIntake(page)

    // Dashboard
    await expect(page).toHaveURL(/\/intake\/complete/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/patient\/dashboard/, { timeout: 20_000 })
    await expect(page.getByText('Jane5', { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  } finally {
    await cleanup(page, email)
  }
})
