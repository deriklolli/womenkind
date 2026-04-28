import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { patients, providers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export interface ServerSession {
  userId: string
  patientId: string | null
  providerId: string | null
  role: 'patient' | 'provider' | 'unknown'
}

export async function getServerSession(): Promise<ServerSession | null> {
  // Dev bypass — RDS is not reachable outside Vercel's network
  if (process.env.NODE_ENV === 'development') {
    return {
      userId: 'dev-user-id',
      patientId: null,
      providerId: 'b0000000-0000-0000-0000-000000000001',
      role: 'provider',
    }
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const patient = await db.query.patients.findFirst({
    where: eq(patients.profile_id, user.id),
    columns: { id: true },
  })

  if (patient) {
    return { userId: user.id, patientId: patient.id, providerId: null, role: 'patient' }
  }

  const provider = await db.query.providers.findFirst({
    where: eq(providers.profile_id, user.id),
    columns: { id: true },
  })

  if (provider) {
    return { userId: user.id, patientId: null, providerId: provider.id, role: 'provider' }
  }

  return { userId: user.id, patientId: null, providerId: null, role: 'unknown' }
}
