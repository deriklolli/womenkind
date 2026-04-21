import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { profiles, providers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = user.user_metadata || {}
  if (meta.role !== 'provider') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ensure profiles record exists in RDS
  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  })
  if (!existingProfile) {
    await db.insert(profiles).values({
      id: user.id,
      first_name: meta.first_name || null,
      last_name: meta.last_name || null,
      email: user.email || null,
    }).onConflictDoNothing()
  }

  // Ensure providers record exists in RDS (idempotent)
  let provider = await db.query.providers.findFirst({
    where: eq(providers.profile_id, user.id),
    columns: { id: true },
  })
  if (!provider) {
    const [created] = await db.insert(providers)
      .values({ profile_id: user.id })
      .onConflictDoNothing()
      .returning({ id: providers.id })
    provider = created
  }

  if (!provider) return NextResponse.json({ error: 'Failed to resolve provider' }, { status: 500 })

  const firstName = existingProfile?.first_name || meta.first_name || ''
  const lastName = existingProfile?.last_name || meta.last_name || ''
  const providerName = (firstName || lastName)
    ? `Dr. ${firstName} ${lastName}`.trim()
    : 'Dr. Urban'

  return NextResponse.json({ providerId: provider.id, providerName })
}
