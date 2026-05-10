// src/app/api/debug/delete-account/route.ts
// Temporary — deletes a patient account by email (Supabase auth + RDS rows).
// Protected by CRON_SECRET. Delete after use.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Find profile
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.email, email) })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Delete RDS rows (patients first due to FK)
  await db.delete(patients).where(eq(patients.profile_id, profile.id))
  await db.delete(profiles).where(eq(profiles.id, profile.id))

  // Delete Supabase auth user
  const { error } = await adminClient.auth.admin.deleteUser(profile.id)
  if (error) {
    return NextResponse.json({ error: `Supabase delete failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ deleted: email })
}
