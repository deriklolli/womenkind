import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { profiles, providers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-migration-secret')
  return secret === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email query param required' }, { status: 400 })
  }

  const profile = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1)
    .then(rows => rows[0] ?? null)

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const providerRow = await db
    .select({ id: providers.id })
    .from(providers)
    .where(eq(providers.profile_id, profile.id))
    .limit(1)
    .then(rows => rows[0] ?? null)

  return NextResponse.json({
    profileId: profile.id,
    email: profile.email,
    hasProviderRow: providerRow !== null,
  })
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email query param required' }, { status: 400 })
  }

  const profile = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1)
    .then(rows => rows[0] ?? null)

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const deleted = await db
    .delete(providers)
    .where(eq(providers.profile_id, profile.id))
    .returning({ id: providers.id })

  return NextResponse.json({
    profileId: profile.id,
    email: profile.email,
    deletedCount: deleted.length,
    deletedIds: deleted.map(r => r.id),
  })
}
