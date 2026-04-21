import { test, expect } from '@playwright/test'

test('intake smoke — first 5 questions', async ({ page }) => {
  await page.goto('http://localhost:3001/intake')

  // Welcome screen
  await expect(page.getByText('Begin Your Intake')).toBeVisible()
  await page.getByText('Begin Your Intake').click()

  // Q1: Full name
  await expect(page.getByPlaceholder('First and last name')).toBeVisible()
  await page.getByPlaceholder('First and last name').fill('Jane Doe')
  await page.getByRole('button', { name: 'Next' }).click()

  // Q2: Date of birth
  await page.waitForTimeout(600)
  await page.locator('input[type="date"]').fill('1975-06-15')
  await page.getByRole('button', { name: 'Next' }).click()

  // Q3: Email
  await page.waitForTimeout(600)
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  await page.getByPlaceholder('you@example.com').fill('jane.doe@example.com')
  await page.getByRole('button', { name: 'Next' }).click()

  // Q4: Phone
  await page.waitForTimeout(600)
  await expect(page.getByPlaceholder('(555) 555-5555')).toBeVisible()
  await page.getByPlaceholder('(555) 555-5555').fill('5551234567')
  await page.getByRole('button', { name: 'Next' }).click()

  // Q5: Height
  await page.waitForTimeout(600)
  await expect(page.getByPlaceholder("e.g. 5'6\"")).toBeVisible()
  await page.getByPlaceholder("e.g. 5'6\"").fill('56')

  // Verify we made it to question 5
  await expect(page.getByPlaceholder("e.g. 5'6\"")).toHaveValue("5'6\"")
})
