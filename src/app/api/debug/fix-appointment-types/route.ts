import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointment_types, providers, profiles } from '@/lib/db/schema'
import { eq, ilike } from 'drizzle-orm'

export async function POST() {
  // Find the real provider
  const providerRows = await db
    .select({ id: providers.id })
    .from(providers)
    .innerJoin(profiles, eq(providers.profile_id, profiles.id))
    .where(eq(providers.is_active, true))
    .orderBy(providers.created_at)
    .limit(1)

  const provider = providerRows[0]
  if (!provider) return NextResponse.json({ error: 'No provider found' }, { status: 404 })

  const providerId = provider.id

  // Get all current types
  const existing = await db.query.appointment_types.findMany({
    where: eq(appointment_types.provider_id, providerId),
  })

  const results: any[] = []

  for (const t of existing) {
    const nameLower = t.name.toLowerCase()

    if (nameLower.includes('hormone')) {
      // Replace Hormone Review → Touch Base Call
      const [updated] = await db
        .update(appointment_types)
        .set({ name: 'Touch Base Call', duration_minutes: 15, price_cents: 0 })
        .where(eq(appointment_types.id, t.id))
        .returning()
      results.push({ action: 'renamed', from: t.name, to: updated.name })
    } else {
      results.push({ action: 'kept', name: t.name, duration_minutes: t.duration_minutes })
    }
  }

  // If no types exist yet, seed the standard three
  if (existing.length === 0) {
    const seeded = await db.insert(appointment_types).values([
      { provider_id: providerId, name: 'Initial Consultation', duration_minutes: 60, price_cents: 0 },
      { provider_id: providerId, name: 'Follow Up Visit', duration_minutes: 30, price_cents: 0 },
      { provider_id: providerId, name: 'Touch Base Call', duration_minutes: 15, price_cents: 0 },
    ]).returning()
    results.push(...seeded.map(t => ({ action: 'seeded', name: t.name })))
  }

  return NextResponse.json({ ok: true, results })
}
