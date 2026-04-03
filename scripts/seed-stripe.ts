/**
 * Stripe Product Seed Script
 *
 * Run once to create Womenkind products in Stripe test mode:
 *   npx tsx scripts/seed-stripe.ts
 *
 * Then copy the output price IDs into .env.local:
 *   STRIPE_PRICE_INTAKE=price_xxx
 *   STRIPE_PRICE_MEMBERSHIP=price_xxx
 */

import Stripe from 'stripe'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Load .env.local manually (no dotenv dependency needed)
const envPath = resolve(__dirname, '../.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex)
      const value = trimmed.slice(eqIndex + 1)
      if (!process.env[key]) process.env[key] = value
    }
  }
} catch {}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    console.error('❌ STRIPE_SECRET_KEY not found in .env.local')
    console.error('   Add your Stripe test secret key first: sk_test_xxx')
    process.exit(1)
  }

  const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' })

  console.log('Creating Womenkind products in Stripe test mode...\n')

  // Intake product
  const intakeProduct = await stripe.products.create({
    name: 'Womenkind Intake Assessment',
    description:
      'Comprehensive AI-powered clinical intake with personalized provider brief. Includes initial provider consultation.',
    metadata: { type: 'intake', brand: 'womenkind' },
  })

  const intakePrice = await stripe.prices.create({
    product: intakeProduct.id,
    unit_amount: 65000,
    currency: 'usd',
    metadata: { type: 'intake' },
  })

  console.log('✅ Intake Assessment')
  console.log(`   Product: ${intakeProduct.id}`)
  console.log(`   Price:   ${intakePrice.id} ($650 one-time)\n`)

  // Membership product
  const membershipProduct = await stripe.products.create({
    name: 'Womenkind Membership',
    description:
      'Ongoing menopause care membership. Includes follow-up visits, progress tracking, and prescription management.',
    metadata: { type: 'membership', brand: 'womenkind' },
  })

  const membershipPrice = await stripe.prices.create({
    product: membershipProduct.id,
    unit_amount: 20000,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { type: 'membership' },
  })

  console.log('✅ Membership')
  console.log(`   Product: ${membershipProduct.id}`)
  console.log(`   Price:   ${membershipPrice.id} ($200/month)\n`)

  console.log('─────────────────────────────────────────')
  console.log('Add these to your .env.local:\n')
  console.log(`STRIPE_PRICE_INTAKE=${intakePrice.id}`)
  console.log(`STRIPE_PRICE_MEMBERSHIP=${membershipPrice.id}`)
  console.log('─────────────────────────────────────────')
}

main().catch(console.error)
