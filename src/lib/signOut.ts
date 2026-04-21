import { supabase } from '@/lib/supabase-browser'

export type SignOutReason = 'idle'

/**
 * Centralized sign-out flow used by manual logout buttons and the idle-timeout
 * hook. Clears any demo-mode localStorage, ends the Supabase session, and
 * performs a hard navigation to the appropriate login page. A hard navigation
 * (not router.push) is intentional so in-flight client state is discarded.
 *
 * Pass `reason: 'idle'` to append ?reason=idle to the login URL so the login
 * page can surface a "signed out due to inactivity" message if desired.
 */
async function performSignOut(
  demoKey: string,
  loginPath: string,
  reason?: SignOutReason
) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(demoKey)
    }
    await supabase.auth.signOut()
  } finally {
    if (typeof window !== 'undefined') {
      const url = reason ? `${loginPath}?reason=${reason}` : loginPath
      window.location.href = url
    }
  }
}

export function signOutPatient(reason?: SignOutReason) {
  return performSignOut('womenkind_demo_patient', '/patient/login', reason)
}

export function signOutProvider(reason?: SignOutReason) {
  return performSignOut('womenkind_demo_provider', '/provider/login', reason)
}
