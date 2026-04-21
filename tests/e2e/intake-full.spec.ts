/**
 * E2E: Full intake form → payment page
 *
 * Walks through every required question as an unauthenticated patient.
 * API routes are stubbed so no Supabase or Stripe calls are made.
 * Chosen answers minimise conditional questions:
 *   - menstrual = "No natural period for 12+ months" → skips lmp, cycle_changes
 *   - hf_freq   = "0 — None"                        → skips all vasomotor follow-ups
 *   - bp_known  = "No"                              → skips bp_sys, bp_dia
 *   - allergies = "No"                              → skips allergy_detail
 *   - cancer    = "No"                              → skips cancer_detail
 *   - strength  = "No"                              → skips strength_days
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3001'
const INTAKE_ID = 'test-intake-00000000'

// Helper: click Next button
async function next(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(600)
}

// Helper: dismiss a section intro or safety frame
async function cont(page: import('@playwright/test').Page) {
  const btn = page.getByRole('button', { name: 'Continue' })
  await btn.waitFor({ state: 'visible' })
  await page.waitForTimeout(800) // let 700ms slide-in animation settle
  await btn.click()
  await page.waitForTimeout(600)
}

// Helper: click a single-select option (auto-advances after 350 ms)
async function pick(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(500)
}

// Helper: click one or more multi-select options, then click Next
async function multi(page: import('@playwright/test').Page, labels: string[]) {
  for (const label of labels) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.waitForTimeout(150)
  }
  await next(page)
}

test('full intake → payment page (stubbed APIs)', async ({ page }) => {
  test.setTimeout(120_000)
  // ── Stub API routes ────────────────────────────────────────────────────────
  await page.route('**/api/intake/save', (route) =>
    route.fulfill({ json: { intakeId: INTAKE_ID } })
  )
  await page.route('**/api/intake/submit', (route) =>
    route.fulfill({ json: { intakeId: INTAKE_ID } })
  )
  await page.route('**/api/stripe/checkout', (route) =>
    route.fulfill({ json: { url: `${BASE}/intake/payment?intake_id=${INTAKE_ID}&stubbed=1` } })
  )

  // ── Welcome ────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/intake`)
  await expect(page.getByText('Begin Your Intake')).toBeVisible()
  await page.getByText('Begin Your Intake').click()
  await page.waitForTimeout(600)

  // ── About you ─────────────────────────────────────────────────────────────
  await expect(page.getByPlaceholder('First and last name')).toBeVisible()
  await page.getByPlaceholder('First and last name').fill('Jane Test')
  await next(page)

  await page.locator('input[type="date"]').fill('1970-03-15')
  await next(page)

  await page.getByPlaceholder('you@example.com').fill('jane.test@example.com')
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

  // ── Your goals ────────────────────────────────────────────────────────────
  await cont(page)
  await page.getByPlaceholder('Describe in your own words...').fill('Better sleep and more energy')
  await next(page)

  await multi(page, ['Energy', 'Sleep'])

  // ── Reproductive history ──────────────────────────────────────────────────
  await cont(page)
  await pick(page, 'Yes') // uterus
  await pick(page, 'Both ovaries present') // ovaries
  await pick(page, 'No natural period for 12+ months') // menstrual → skips lmp + cycle_changes
  await multi(page, ['None of these']) // abnormal_bleeding

  // ── Health basics ─────────────────────────────────────────────────────────
  await cont(page)
  await pick(page, 'No') // bp_known → skips bp_sys, bp_dia

  // ── Medications ───────────────────────────────────────────────────────────
  await cont(page)
  await multi(page, ['None of these']) // current_meds
  await page.locator('textarea').fill('No current medications.')
  await next(page)
  await pick(page, 'No') // allergies → skips allergy_detail
  await pick(page, 'No') // peanut

  // ── Medical history ───────────────────────────────────────────────────────
  await cont(page)
  await multi(page, ['None of these']) // cardio
  await pick(page, 'Never') // smoking
  await pick(page, 'No') // cancer → skips cancer_detail
  await multi(page, ['None of these']) // other_conditions

  // ── Vasomotor ─────────────────────────────────────────────────────────────
  await cont(page)
  await pick(page, '0 \u2014 None') // hf_freq → skips all 5 follow-ups

  // ── Mood & cognition (single screen — safety frame replaces intro) ─────────
  await cont(page)
  await pick(page, 'None') // palpitations
  await pick(page, 'None') // joint_pain
  await pick(page, 'Mild') // sleep_falling
  await pick(page, 'Mild') // sleep_waking
  await pick(page, 'None') // wired_tired
  await pick(page, 'None') // low_mood
  await pick(page, 'None') // irritability
  await pick(page, 'Mild') // anxiety
  await pick(page, 'Mild') // brain_fog
  await pick(page, 'Mild') // fatigue
  await pick(page, 'Mild') // sexual_change

  // ── Vaginal & bladder (single screen — safety frame replaces intro) ────────
  await cont(page)
  await multi(page, ['None of these']) // gsm
  await pick(page, 'None') // bladder_sev
  await pick(page, 'None') // vaginal_sev

  // ── Body & bone ───────────────────────────────────────────────────────────
  await cont(page)
  await pick(page, 'No')  // midsection
  await pick(page, 'No')  // strength → skips strength_days
  // protein — optional, skip
  await next(page)
  // alcohol — optional, skip
  await next(page)
  await pick(page, 'No')  // fracture
  await pick(page, 'No')  // parent_hip
  await pick(page, 'No')  // family_osteo
  await pick(page, 'Never had one') // dexa

  // ── Treatment preferences ─────────────────────────────────────────────────
  await cont(page)
  await pick(page, 'It does not matter') // bc_need
  await page.locator('textarea').fill('Have not tried any treatments yet.')
  await next(page)
  await multi(page, ['Not sure yet']) // tx_openness
  // dosing_pref — optional, skip (single-select with no value — use Next hint)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(600)
  // open_notes — optional textarea, skip
  await page.getByRole('button', { name: 'Submit' }).click()

  // ── Assert: payment page ──────────────────────────────────────────────────
  await expect(page).toHaveURL(/\/intake\/payment/, { timeout: 10_000 })
  await expect(page.getByRole('button', { name: /Continue to Payment/i })).toBeVisible()
})
