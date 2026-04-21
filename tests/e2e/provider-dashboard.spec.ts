/**
 * E2E: Provider dashboard flows
 *
 * Tests key provider-side journeys:
 *   1. Log in as a provider
 *   2. View the patient intake queue
 *   3. Open a patient's AI clinical brief
 *   4. Navigate to the schedule tab and view upcoming appointments
 *   5. View a patient's profile in the directory
 *
 * Prerequisites:
 *   - `npm run dev` must be running at localhost:3000
 *   - .env.test must exist with TEST_PROVIDER_EMAIL and TEST_PROVIDER_PASSWORD
 *   - At least one submitted intake must exist in the database
 */

import { test, expect } from '@playwright/test'

const PROVIDER_EMAIL = process.env.TEST_PROVIDER_EMAIL ?? ''
const PROVIDER_PASSWORD = process.env.TEST_PROVIDER_PASSWORD ?? ''

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsProvider(page: import('@playwright/test').Page) {
  await page.goto('/provider/login')
  await page.getByLabel(/email/i).fill(PROVIDER_EMAIL)
  await page.getByLabel(/password/i).fill(PROVIDER_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  // Wait for redirect to provider dashboard
  await page.waitForURL('**/provider/**', { timeout: 10_000 })
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Provider dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsProvider(page)
  })

  test('provider dashboard loads without errors', async ({ page }) => {
    // Should not show a generic error page or redirect to login
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).not.toContainText(/500|something went wrong/i)
  })

  test('intake queue tab is visible', async ({ page }) => {
    const queueTab = page.getByRole('link', { name: /intake queue|patients|queue/i }).first()
    await expect(queueTab).toBeVisible({ timeout: 8_000 })
  })

  test('patient intake queue renders a list', async ({ page }) => {
    // Navigate to the intake queue (may already be the default view)
    const intakeLink = page.getByRole('link', { name: /intake queue/i })
    if (await intakeLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await intakeLink.click()
    }

    // Either shows patient cards or an empty-state message
    const queueContent = page
      .locator('[data-testid="intake-queue"], .intake-queue, .patient-card')
      .or(page.getByText(/no intakes|no patients|empty/i))
      .first()

    await expect(queueContent).toBeVisible({ timeout: 8_000 })
  })

  test('schedule tab is accessible from provider nav', async ({ page }) => {
    const scheduleLink = page.getByRole('link', { name: /schedule/i }).first()
    await expect(scheduleLink).toBeVisible({ timeout: 8_000 })

    await scheduleLink.click()
    await expect(page).toHaveURL(/schedule/, { timeout: 8_000 })
  })

  test('provider schedule page shows appointment types or availability editor', async ({ page }) => {
    await page.goto('/provider/schedule')

    const content = page
      .getByText(/appointment type|availability|follow-up visit|initial consultation/i)
      .first()

    await expect(content).toBeVisible({ timeout: 8_000 })
  })

  test('patients tab shows the patient directory', async ({ page }) => {
    const patientsLink = page.getByRole('link', { name: /my patients|patients/i }).first()
    if (await patientsLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await patientsLink.click()
      // Either shows patient rows or empty state
      const directory = page
        .locator('[data-testid="patient-directory"], .patient-directory')
        .or(page.getByText(/no patients yet|patient directory/i))
        .first()
      await expect(directory).toBeVisible({ timeout: 8_000 })
    }
  })

  test('AI clinical brief tab is visible when a patient intake exists', async ({ page }) => {
    // Navigate to first patient in queue if possible
    const firstPatient = page
      .locator('[data-testid="patient-row"], .patient-card, tr.patient')
      .first()

    if (await firstPatient.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPatient.click()
      // After opening a patient, the brief viewer tabs should be visible
      const briefTab = page.getByRole('tab', { name: /brief|summary|risk|treatment/i }).first()
      await expect(briefTab).toBeVisible({ timeout: 8_000 })
    } else {
      // No patients yet — verify the empty state is friendly
      const emptyState = page.getByText(/no patients|no intakes|get started/i).first()
      await expect(emptyState).toBeVisible({ timeout: 5_000 })
    }
  })
})
