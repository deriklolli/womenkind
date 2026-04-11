import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase-server'

export interface ServerSession {
  userId: string
  patientId: string | null
  providerId: string | null
  role: 'patient' | 'provider' | 'unknown'
}

/**
 * Verifies the current request's Supabase session from cookies.
 * Returns null if the user is not authenticated.
 * Returns a ServerSession with their role and patient/provider ID if authenticated.
 *
 * Usage in API routes:
 *   const session = await getServerSession()
 *   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const cookieStore = await cookies()

  // Use the anon key with cookie-based session storage to verify the JWT
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore errors when called from Server Components
          }
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  // Use the service client for DB lookups so RLS doesn't block the role resolution
  const db = getServiceSupabase()

  // Check if this user is a patient
  const { data: patient } = await db
    .from('patients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (patient) {
    return {
      userId: user.id,
      patientId: patient.id,
      providerId: null,
      role: 'patient',
    }
  }

  // Check if this user is a provider
  const { data: provider } = await db
    .from('providers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (provider) {
    return {
      userId: user.id,
      patientId: null,
      providerId: provider.id,
      role: 'provider',
    }
  }

  // Authenticated but role not yet assigned (e.g. mid-signup)
  return {
    userId: user.id,
    patientId: null,
    providerId: null,
    role: 'unknown',
  }
}
