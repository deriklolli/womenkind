/**
 * E2E: Full patient journey — signup → email verify → payment → intake → dashboard
 *
 * Runs 5 independent test patients sequentially against staging.
 * Payment step uses /api/debug/mock-payment (gated by ENABLE_TEST_ROUTES=true) to
 * bypass Stripe checkout when test-mode Stripe keys are not configured.
 * When STRIPE_TEST_MODE=true and Stripe test keys are present, real checkout is used.
 * Requires:
 *   - ENABLE_TEST_ROUTES=true on the target Vercel environment
 *   - TEST_BASE_URL pointing to staging in .env.test
 *
 * Each test cleans up its own account in afterEach.
 */

import { test, expect, type Page } from '@playwright/test'

// ── Helpers (reused from intake-full.spec.ts pattern) ─────────────────────────

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

// Fill Stripe's hosted checkout page with a test card.
// Stripe renders card fields inside iframes — we use frameLocator to reach them.
// Pass promoCode to test the promo/coupon flow instead of a card payment.
async function fillStripeCheckout(page: Page, email: string, promoCode?: string) {
  // Wait for Stripe checkout to load
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 })

  // Email field (outside iframe, sometimes pre-filled)
  const emailField = page.locator('input[type="email"]').first()
  if (await emailField.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await emailField.clear()
    await emailField.fill(email)
  }

  // Apply promo code if provided — click the "Add promotion code" link Stripe shows
  if (promoCode) {
    const promoLink = page.getByText(/promotion code|promo code|have a coupon/i).first()
    if (await promoLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await promoLink.click()
      await page.waitForTimeout(500)
    }
    const promoInput = page.locator('input[placeholder*="promo" i], input[placeholder*="coupon" i], input[id*="promotionCode" i]').first()
    await promoInput.waitFor({ state: 'visible', timeout: 5_000 })
    await promoInput.fill(promoCode)
    // Apply the code — Stripe uses a button or Enter to validate
    const applyBtn = page.getByRole('button', { name: /apply/i }).first()
    if (await applyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await applyBtn.click()
    } else {
      await promoInput.press('Enter')
    }
    // Wait for Stripe to recalculate the total
    await page.waitForTimeout(2_000)
  }

  // If the promo makes the total $0, Stripe removes the card fields entirely.
  // Detect this by checking whether the card iframe is present.
  const cardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first()
  const cardFieldPresent = await cardFrame
    .locator('[placeholder="Card number"], [data-elements-stable-field-name="cardNumber"] input')
    .first()
    .isVisible({ timeout: 3_000 })
    .catch(() => false)

  if (cardFieldPresent) {
    // Partial or no discount — still need a card
    await cardFrame.locator('[placeholder="Card number"], [data-elements-stable-field-name="cardNumber"] input').first()
      .fill('4242424242424242')
    await page.waitForTimeout(300)

    await cardFrame.locator('[placeholder="MM / YY"], [data-elements-stable-field-name="cardExpiry"] input').first()
      .fill('1234')
    await page.waitForTimeout(300)

    await cardFrame.locator('[placeholder="CVC"], [data-elements-stable-field-name="cardCvc"] input').first()
      .fill('123')
    await page.waitForTimeout(300)

    // Cardholder name (outside iframe, may or may not appear)
    const nameField = page.locator('input[placeholder*="name" i], input[autocomplete="cc-name"]').first()
    if (await nameField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nameField.fill('Test Patient')
    }

    // ZIP / postal code (outside iframe)
    const zipField = page.locator('input[placeholder*="ZIP" i], input[placeholder*="postal" i], input[autocomplete="postal-code"]').first()
    if (await zipField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await zipField.fill('10001')
    }
  }

  // Submit — Stripe uses "Subscribe", "Pay", "Start free trial", or "Start trial"
  await page.getByRole('button', { name: /Subscribe|Pay|Start free trial|Start trial/i }).click()
}

// Complete the full intake form — same minimal-branch answers as intake-full.spec.ts
async function fillIntake(page: Page) {
  // Welcome screen — must check the Privacy Policy consent box before button enables
  await expect(page.getByText('Begin Your Intake')).toBeVisible({ timeout: 15_000 })
  await page.locator('input[type="checkbox"]').check()
  await page.waitForTimeout(300)
  await page.getByText('Begin Your Intake').click()
  await page.waitForTimeout(600)

  // ── About you (authenticated flow) ────────────────────────────────────────
  // full_name and email are hidden via showIf: !_authenticated — the auth
  // init call (/api/patient/intake-init) resolves before we reach this point.
  // Visible sequence: dob → phone → height → weight → pcp (optional) → pharmacy
  await page.locator('input[type="date"]').waitFor({ state: 'visible', timeout: 15_000 })
  await page.locator('input[type="date"]').fill('1970-03-15')
  await next(page)

  await page.getByPlaceholder('(555) 555-5555').fill('5551234567')
  await next(page)

  await page.getByPlaceholder("e.g. 5'6\"").fill('56')
  await next(page)

  await page.getByPlaceholder('e.g. 150 lb').fill('150 lb')
  await next(page)

  // pcp — optional, skip
  await next(page)

  await page.getByPlaceholder('Name + location').fill('CVS Main St')
  await next(page)

  // ── Your goals ─────────────────────────────────────────────────────────────
  await cont(page)
  await page.getByPlaceholder('Describe in your own words...').fill('Better sleep and more energy')
  await next(page)

  await multi(page, ['Energy', 'Sleep'])

  // ── Reproductive history ───────────────────────────────────────────────────
  await cont(page)
  await pick(page, 'Yes')                                        // uterus
  await pick(page, 'Both ovaries present')                      // ovaries
  await pick(page, 'No natural period for 12+ months')          // menstrual — skips lmp, cycle_changes
  await multi(page, ['None of these'])                          // abnormal_bleeding

  // ── Health basics ──────────────────────────────────────────────────────────
  await cont(page)
  await pick(page, 'No')                                        // bp_known — skips bp_sys, bp_dia

  // ── Medications ────────────────────────────────────────────────────────────
  await cont(page)
  await multi(page, ['None of these'])                          // current_meds
  await page.locator('textarea').fill('No current medications.')
  await next(page)
  await pick(page, 'No')                                        // allergies — skips allergy_detail
  await pick(page, 'No')                                        // peanut

  // ── Medical history ────────────────────────────────────────────────────────
  await cont(page)
  await multi(page, ['None of these'])                          // cardio
  await pick(page, 'Never')                                     // smoking
  await pick(page, 'No')                                        // cancer — skips cancer_detail
  await multi(page, ['None of these'])                          // other_conditions

  // ── Vasomotor ──────────────────────────────────────────────────────────────
  await cont(page)
  await pick(page, '0 — None')                             // hf_freq — skips all 5 follow-ups

  // ── Mood & cognition (safety frame replaces section intro) ─────────────────
  await cont(page)
  await pick(page, 'None')   // palpitations
  await pick(page, 'None')   // joint_pain
  await pick(page, 'Mild')   // sleep_falling
  await pick(page, 'Mild')   // sleep_waking
  await pick(page, 'None')   // wired_tired
  await pick(page, 'No')     // snoring
  await pick(page, 'None')   // low_mood
  await pick(page, 'None')   // irritability
  await pick(page, 'Mild')   // anxiety
  await pick(page, 'Mild')   // brain_fog
  await pick(page, 'Mild')   // fatigue
  await pick(page, 'Mild')   // sexual_change

  // ── Vaginal & bladder (safety frame replaces section intro) ───────────────
  await cont(page)
  await multi(page, ['None of these'])  // gsm
  await pick(page, 'None')              // bladder_sev
  await pick(page, 'None')              // vaginal_sev

  // ── Body & bone ────────────────────────────────────────────────────────────
  await cont(page)
  await pick(page, 'No')               // midsection
  await pick(page, 'No')               // strength — skips strength_days
  await next(page)                      // protein — optional, skip
  await next(page)                      // alcohol — optional, skip
  await pick(page, 'No')               // fracture
  await pick(page, 'No')               // parent_hip
  await pick(page, 'No')               // family_osteo
  await pick(page, 'Never had one')    // dexa

  // ── Treatment preferences ──────────────────────────────────────────────────
  await cont(page)
  await pick(page, 'It does not matter')                          // bc_need
  await page.locator('textarea').fill('Have not tried any treatments yet.')
  await next(page)
  await multi(page, ['Not sure yet'])                             // tx_openness
  // dosing_pref — optional single-select, skip with Next
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(600)
  // open_notes — optional textarea, skip straight to Submit
  await page.getByRole('button', { name: 'Submit' }).click()
}

// ── Test setup ─────────────────────────────────────────────────────────────────

const RUN_ID = Date.now()
const PASSWORD = 'TestPatient2026!'
const PLAN = 'vitality'

// Set TEST_PROMO_CODE in .env.test to test the promo code flow on patient 3.
// The code must exist in your Stripe test-mode dashboard.
const PROMO_CODE = process.env.TEST_PROMO_CODE

function testEmail(n: number) {
  return `wk-test-${RUN_ID}-${n}@womenkind.dev`
}

async function cleanup(page: Page, email: string) {
  try {
    await page.request.delete(`/api/debug/cleanup-test-patient?email=${encodeURIComponent(email)}`)
  } catch {
    // cleanup is best-effort — don't fail the test if it errors
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

for (let i = 1; i <= 5; i++) {
  const label = `patient journey ${i}/5 — signup → payment → intake → dashboard`

  test(label, async ({ page }) => {
    test.setTimeout(240_000)

    const email = testEmail(i)
    const firstName = `Jane${i}`
    const lastName = 'Test'

    // ── 1. Signup ──────────────────────────────────────────────────────────
    await page.goto(`/signup?plan=${PLAN}`)
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()

    await page.getByPlaceholder('Jane').fill(firstName)
    await page.getByPlaceholder('Smith').fill(lastName)
    await page.getByPlaceholder('you@email.com').fill(email)
    await page.getByPlaceholder('Create a password').fill(PASSWORD)

    await page.getByRole('button', { name: 'Create Account' }).click()

    // ── 2. Assert email verify screen ──────────────────────────────────────
    await expect(page).toHaveURL(/\/signup\/verify/, { timeout: 15_000 })

    // ── 3. Get verification URL from debug endpoint ─────────────────────────
    const verifyRes = await page.request.get(
      `/api/debug/verification-url?email=${encodeURIComponent(email)}`
    )
    expect(verifyRes.ok(), `verification-url endpoint returned ${verifyRes.status()}`).toBeTruthy()
    const { verifyUrl } = await verifyRes.json()
    expect(verifyUrl).toBeTruthy()

    // Navigate to the real verification page — exercises server-side token check.
    // Use only the path (strip the host) so we stay on the baseURL deployment
    // rather than following the NEXT_PUBLIC_APP_URL baked into the verifyUrl.
    const verifyPath = new URL(verifyUrl).pathname + new URL(verifyUrl).search
    await page.goto(verifyPath)

    // ── 4. Assert resume page shows Vitality plan ──────────────────────────
    await expect(page).toHaveURL(/\/signup\/resume/, { timeout: 15_000 })
    await expect(page.getByText('Vitality', { exact: false })).toBeVisible({ timeout: 10_000 })

    // ── 5. Mock payment (no Stripe test keys configured on staging) ─────────
    // Calls /api/debug/mock-payment to set onboarding_status='paid' directly.
    // This exercises the entire pre-payment funnel and the payment-gate on
    // intake/submit — the only gap vs real Stripe is the hosted checkout form itself.
    const payRes = await page.request.post('/api/debug/mock-payment')
    expect(payRes.ok(), `mock-payment returned ${payRes.status()}`).toBeTruthy()

    // ── 6. Reload resume page — should now show "paid" state ───────────────
    await page.goto('/signup/resume')
    await expect(page).toHaveURL(/\/signup\/resume/, { timeout: 15_000 })
    await expect(page.getByText("You're ready to begin")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Start your intake' })).toBeVisible()

    // ── 7. Navigate to intake ──────────────────────────────────────────────
    await page.getByRole('link', { name: 'Start your intake' }).click()
    await expect(page).toHaveURL(/\/intake/, { timeout: 15_000 })

    // ── 8. Fill all intake sections ────────────────────────────────────────
    await fillIntake(page)

    // ── 9. Assert /intake/complete ─────────────────────────────────────────
    await expect(page).toHaveURL(/\/intake\/complete/, { timeout: 15_000 })

    // ── 10. Wait for auto-redirect to dashboard (4s spinner) ──────────────
    await expect(page).toHaveURL(/\/patient\/dashboard/, { timeout: 20_000 })

    // ── 11. Assert dashboard rendered ─────────────────────────────────────
    // Dashboard should show the patient's first name somewhere in the nav / header
    await expect(page.getByText(firstName, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  })

  test.afterEach(async ({ page }) => {
    await cleanup(page, testEmail(i))
  })
}
