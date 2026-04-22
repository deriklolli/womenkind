import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const [updated] = await db
    .update(profiles)
    .set({ last_name: 'Urban' })
    .where(eq(profiles.email, 'josephurbanmd@gmail.com'))
    .returning({ email: profiles.email, last_name: profiles.last_name })

  if (!updated) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  return NextResponse.json({ ok: true, ...updated })
}
