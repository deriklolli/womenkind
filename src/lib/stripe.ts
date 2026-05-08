import Stripe from 'stripe'

// Server-side Stripe instance
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
  }
  return new Stripe(key, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  })
}

/**
 * Stripe product/price configuration for Womenkind.
 *
 * These IDs should be set as environment variables after creating the products
 * in the Stripe Dashboard (test mode). To create them:
 *
 * 1. Go to https://dashboard.stripe.com/test/products
 * 2. Create "Womenkind Intake Assessment" — $650 one-time
 * 3. Create "Womenkind Membership" — $200/month recurring
 * 4. Copy the price IDs (price_xxx) into .env.local
 *
 * Alternatively, run the seed script: npm run stripe:seed
 */
export const STRIPE_PRICES = {
  intake: process.env.STRIPE_PRICE_INTAKE || '',
  entry: {
    foundations: process.env.STRIPE_PRICE_ENTRY_DISCOVERY || '',
    vitality: process.env.STRIPE_PRICE_ENTRY_VITALITY || '',
    concierge: process.env.STRIPE_PRICE_ENTRY_CONCIERGE || '',
  },
  membership: {
    foundations: process.env.STRIPE_PRICE_MEMBERSHIP_FOUNDATIONS || '',
    vitality: process.env.STRIPE_PRICE_MEMBERSHIP_VITALITY || '',
    concierge: process.env.STRIPE_PRICE_MEMBERSHIP_CONCIERGE || '',
  },
}

export function getMembershipPriceId(plan: string): string {
  const prices = STRIPE_PRICES.membership
  if (plan === 'foundations') return prices.foundations
  if (plan === 'concierge') return prices.concierge
  return prices.vitality
}

// Returns the one-time entry visit price for a given plan.
// Foundations uses a 15-min discovery ($295); all other tiers use the full intake ($650).
export function getEntryVisitPriceId(plan: string): string {
  if (plan === 'foundations') return STRIPE_PRICES.entry.foundations
  if (plan === 'concierge') return STRIPE_PRICES.entry.concierge
  return STRIPE_PRICES.entry.vitality
}

/**
 * Creates Stripe products and prices programmatically.
 * Call this once to set up test mode, then save the IDs to .env.local.
 */
export async function seedStripeProducts() {
  const stripe = getStripe()

  // Create intake product + price
  const intakeProduct = await stripe.products.create({
    name: 'Womenkind Intake Assessment',
    description:
      'Comprehensive AI-powered clinical intake with personalized provider brief. Includes initial provider consultation.',
    metadata: { type: 'intake' },
  })

  const intakePrice = await stripe.prices.create({
    product: intakeProduct.id,
    unit_amount: 65000, // $650.00
    currency: 'usd',
    metadata: { type: 'intake' },
  })

  // Create membership product + price
  const membershipProduct = await stripe.products.create({
    name: 'Womenkind Membership',
    description:
      'Ongoing menopause care membership. Includes follow-up visits, progress tracking, and prescription management.',
    metadata: { type: 'membership' },
  })

  const membershipPrice = await stripe.prices.create({
    product: membershipProduct.id,
    unit_amount: 20000, // $200.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { type: 'membership' },
  })

  return {
    intake: { productId: intakeProduct.id, priceId: intakePrice.id },
    membership: { productId: membershipProduct.id, priceId: membershipPrice.id },
  }
}
