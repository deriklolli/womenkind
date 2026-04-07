'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-browser'

function UpdatePasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exchanging, setExchanging] = useState(true)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')

    if (code) {
      // PKCE flow — exchange code for session
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchError }) => {
        setExchanging(false)
        if (exchError) {
          setError('This reset link has expired or has already been used. Please request a new one.')
        } else {
          setReady(true)
        }
      })
      return
    }

    // Implicit flow — token arrives in URL hash (#access_token=...&type=recovery)
    // Supabase JS auto-processes the hash and fires PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setExchanging(false)
        setReady(true)
      }
    })

    // Also check if session is already available (hash processed before listener registered)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setExchanging(false)
        setReady(true)
      } else if (typeof window !== 'undefined' && !window.location.hash.includes('access_token')) {
        // No code, no hash token, no session — invalid link
        setExchanging(false)
        setError('Invalid or expired reset link. Please request a new one.')
      }
      // else: hash token present, waiting for PASSWORD_RECOVERY event above
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
    } else {
      // Determine user type from DB rather than URL param
      const { data: { user } } = await supabase.auth.getUser()
      const { data: providerRow } = await supabase
        .from('providers')
        .select('id')
        .eq('profile_id', user?.id)
        .maybeSingle()
      const loginPath = providerRow ? '/provider/login' : '/patient/login'
      router.push(`${loginPath}?reset=success`)
    }
  }

  return (
    <div className="bg-white rounded-card shadow-lg shadow-aubergine/5 p-8">
      <h2 className="font-sans font-semibold text-xl text-aubergine mb-2">Set New Password</h2>
      <p className="text-sm font-sans text-aubergine/50 mb-6">
        Choose a strong password for your account.
      </p>

      {error && (
        <div className="mb-5 px-3 py-2.5 rounded-brand bg-red-50 border border-red-100">
          <p className="text-sm font-sans text-red-600">{error}</p>
          <button
            onClick={() => router.push(from === 'patient' ? '/patient/login' : '/provider/login')}
            className="text-xs font-sans text-violet mt-1 hover:underline"
          >
            Back to login
          </button>
        </div>
      )}

      {exchanging && !error && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin mx-auto" />
          <p className="text-sm font-sans text-aubergine/40 mt-4">Verifying reset link...</p>
        </div>
      )}

      {ready && (
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className="w-full px-4 py-3 pr-11 rounded-brand border border-aubergine/10 text-aubergine
                           placeholder:text-aubergine/30 font-sans text-sm
                           focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                           transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-aubergine/30 hover:text-aubergine/60 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              required
              className="w-full px-4 py-3 rounded-brand border border-aubergine/10 text-aubergine
                         placeholder:text-aubergine/30 font-sans text-sm
                         focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                         transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 font-sans bg-red-50 px-3 py-2 rounded-brand">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full font-sans text-sm font-semibold
                       bg-violet text-white hover:bg-violet-dark shadow-lg shadow-violet/20
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-300"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/womenkind-logo-dark.png"
            alt="Womenkind"
            width={600}
            height={135}
            className="h-[80px] w-auto mx-auto"
            priority
          />
        </div>
        <Suspense fallback={
          <div className="bg-white rounded-card shadow-lg p-8 text-center">
            <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin mx-auto" />
          </div>
        }>
          <UpdatePasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
