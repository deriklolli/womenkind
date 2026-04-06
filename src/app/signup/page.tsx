'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

export default function SignUpPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const passwordValid = password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!passwordValid) {
      setError('Password must be at least 8 characters with one uppercase letter, one lowercase letter, and one number.')
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: 'patient',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/signup/verified`,
        },
      })

      if (signUpError) throw signUpError

      // If email confirmation is required (no session returned)
      if (!data.session) {
        // Send welcome email via our API
        await fetch('/api/auth/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            firstName,
          }),
        })
        setEmailSent(true)
        return
      }

      // If auto-confirmed, go straight to intake
      router.push('/intake')
    } catch (err: any) {
      setError(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  // Email sent confirmation view
  if (emailSent) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Image
              src="/womenkind-logo-dark.png"
              alt="Womenkind"
              width={600}
              height={135}
              className="h-[120px] w-auto mx-auto mb-2"
              priority
            />
          </div>

          <div className="bg-white rounded-card shadow-lg shadow-aubergine/5 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet/10 border-2 border-violet/20 mb-5">
              <svg className="w-8 h-8 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>

            <h2 className="font-serif text-xl text-aubergine mb-3">
              Check your email
            </h2>
            <p className="text-sm font-sans text-aubergine/50 leading-relaxed mb-2">
              We sent a verification link to
            </p>
            <p className="text-sm font-sans font-semibold text-aubergine/70 mb-6">
              {email}
            </p>
            <p className="text-xs font-sans text-aubergine/35 leading-relaxed">
              Click the link in the email to verify your account and start your intake survey. The link will expire in 24 hours.
            </p>
          </div>

          <p className="text-xs text-aubergine/30 font-sans text-center mt-6">
            Already verified?{' '}
            <button
              onClick={() => router.push('/patient/login')}
              className="text-violet font-semibold hover:text-violet/80 transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/womenkind-logo-dark.png"
            alt="Womenkind"
            width={600}
            height={135}
            className="h-[120px] w-auto mx-auto mb-2"
            priority
          />
        </div>

        {/* Signup card */}
        <div className="bg-white rounded-card shadow-lg shadow-aubergine/5 p-8">
          <h2 className="font-serif text-xl text-aubergine mb-2">
            Create your account
          </h2>
          <p className="text-sm font-sans text-aubergine/45 mb-6 leading-relaxed">
            Start your personalized health journey with Womenkind.
          </p>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                  className="w-full px-4 py-3 rounded-brand border border-aubergine/10 text-aubergine
                             placeholder:text-aubergine/30 font-sans text-sm
                             focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                             transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                  className="w-full px-4 py-3 rounded-brand border border-aubergine/10 text-aubergine
                             placeholder:text-aubergine/30 font-sans text-sm
                             focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                             transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full px-4 py-3 rounded-brand border border-aubergine/10 text-aubergine
                           placeholder:text-aubergine/30 font-sans text-sm
                           focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                           transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  minLength={8}
                  className="w-full px-4 py-3 pr-12 rounded-brand border border-aubergine/10 text-aubergine
                             placeholder:text-aubergine/30 font-sans text-sm
                             focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                             transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-aubergine/30 hover:text-aubergine/50 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className={`text-xs font-sans ${password.length >= 8 ? 'text-violet' : 'text-aubergine/30'}`}>
                    {password.length >= 8 ? '\u2713' : '\u2022'} At least 8 characters
                  </p>
                  <p className={`text-xs font-sans ${/[A-Z]/.test(password) ? 'text-violet' : 'text-aubergine/30'}`}>
                    {/[A-Z]/.test(password) ? '\u2713' : '\u2022'} One uppercase letter
                  </p>
                  <p className={`text-xs font-sans ${/[a-z]/.test(password) ? 'text-violet' : 'text-aubergine/30'}`}>
                    {/[a-z]/.test(password) ? '\u2713' : '\u2022'} One lowercase letter
                  </p>
                  <p className={`text-xs font-sans ${/[0-9]/.test(password) ? 'text-violet' : 'text-aubergine/30'}`}>
                    {/[0-9]/.test(password) ? '\u2713' : '\u2022'} One number
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 font-sans bg-red-50 px-3 py-2 rounded-brand">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full font-sans text-sm font-semibold
                         bg-violet text-white hover:bg-violet/90
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-sm text-center text-aubergine/40 font-sans mt-5">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/patient/login')}
              className="text-violet font-semibold hover:text-violet/80 transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
