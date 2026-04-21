import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { providers, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const rows = await db
    .select({
      id: providers.id,
      profile_id: providers.profile_id,
      is_active: providers.is_active,
      created_at: providers.created_at,
      email: profiles.email,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
    })
    .from(providers)
    .leftJoin(profiles, eq(providers.profile_id, profiles.id))

  return NextResponse.json({ providers: rows })
}
