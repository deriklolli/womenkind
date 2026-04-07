import { supabase } from '@/lib/supabase-browser'

const DEMO_PROVIDER_ID = 'b0000000-0000-0000-0000-000000000001'

export interface ProviderSession {
  providerId: string
  providerName: string
  isDemo: boolean
}

/**
 * Resolves the current provider's session — from demo localStorage or real Supabase auth.
 * Returns null if the user is not authenticated as a provider.
 */
export async function getProviderSession(): Promise<ProviderSession | null> {
  // 1. Demo mode
  if (typeof window !== 'undefined') {
    const demo = localStorage.getItem('womenkind_demo_provider')
    if (demo) {
      try {
        const parsed = JSON.parse(demo)
        return {
          providerId: DEMO_PROVIDER_ID,
          providerName: parsed.name || 'Dr. Urban',
          isDemo: true,
        }
      } catch {}
    }
  }

  // 2. Real Supabase auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Build display name from metadata first (fastest)
  const meta = user.user_metadata || {}
  let providerName = ''
  if (meta.first_name || meta.last_name) {
    providerName = `Dr. ${meta.first_name || ''} ${meta.last_name || ''}`.trim()
  }

  // Look up provider record by profile_id
  const { data: provider } = await supabase
    .from('providers')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!provider) return null

  // If name not in metadata, fetch from profiles table
  if (!providerName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()
    if (profile) {
      providerName = `Dr. ${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    }
  }

  return {
    providerId: provider.id,
    providerName,
    isDemo: false,
  }
}
