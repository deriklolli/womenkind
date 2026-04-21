const DEMO_PROVIDER_ID = 'b0000000-0000-0000-0000-000000000001'

export interface ProviderSession {
  providerId: string
  providerName: string
  isDemo: boolean
}

/**
 * Resolves the current provider's session — from demo localStorage or server API.
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

  // 2. Real auth — look up provider record via server API (queries RDS)
  const res = await fetch('/api/auth/provider-session')
  if (!res.ok) return null

  const data = await res.json()
  return {
    providerId: data.providerId,
    providerName: data.providerName,
    isDemo: false,
  }
}
