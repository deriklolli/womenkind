import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const session = await getServerSession()
  if (!session || session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Try to get name from RDS profiles table
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, session.userId),
    columns: { first_name: true, last_name: true },
  })

  // Fall back to Supabase auth metadata for name
  let providerName = ''
  if (profile?.first_name || profile?.last_name) {
    providerName = `Dr. ${profile.first_name || ''} ${profile.last_name || ''}`.trim()
  } else {
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
    const meta = user?.user_metadata || {}
    if (meta.first_name || meta.last_name) {
      providerName = `Dr. ${meta.first_name || ''} ${meta.last_name || ''}`.trim()
    }
  }

  return NextResponse.json({
    providerId: session.providerId,
    providerName: providerName || 'Dr. Urban',
  })
}
