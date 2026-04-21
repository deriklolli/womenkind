'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

export default function PatientLoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.')
      return
    }
    setLoading(true)
    setError('')
    const canonicalOrigin = window.location.origin.replace(/^https?:\/\/www\./, 'https://')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${canonicalOrigin}/auth/update-password`,
    })
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setForgotSent(true)
      setMessage('Password reset link sent — check your email.')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      // Verify patient role from auth metadata
      const role = data.user.user_metadata?.role
      if (role !== 'patient') {
        await supabase.auth.signOut()
        throw new Error('This account is not a patient account. Please use the provider login.')
      }

      // Ensure patient record exists (idempotent — safe to call on every login)
      await fetch('/api/auth/create-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id }),
      })

      localStorage.removeItem('womenkind_demo_patient')
      router.push('/patient/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

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
        },
      })

      if (signUpError) throw signUpError

      // If email confirmation is required
      if (!data.session || !data.user) {
        setMessage('Check your email for a confirmation link.')
        return
      }

      // Ensure patient record exists
      await fetch('/api/auth/create-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id }),
      })

      localStorage.removeItem('womenkind_demo_patient')
      router.push('/patient/dashboard')
    } catch (err: any) {
      setError(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md -mt-[60px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/womenkind-logo-dark.png"
            alt="Womenkind"
            width={600}
            height={135}
            className="h-[102px] w-auto mx-auto mb-2"
            priority
          />
          <p className="text-sm font-sans text-aubergine/50 mt-3">Patient Portal</p>
        </div>

        {/* Login/Signup card */}
        <div className="bg-white rounded-card shadow-lg shadow-aubergine/5 p-8">
          <h2 className="font-serif font-normal text-xl text-aubergine mb-6">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>

          {message && (
            <div className="mb-4 px-3 py-2 rounded-brand bg-[#4ECDC4]/10 border border-[#4ECDC4]/20">
              <p className="text-sm font-sans text-[#4ECDC4]">{message}</p>
            </div>
          )}

          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Sarah"
                    required={isSignUp}
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
                    placeholder="Mitchell"
                    required={isSignUp}
                    className="w-full px-4 py-3 rounded-brand border border-aubergine/10 text-aubergine
                               placeholder:text-aubergine/30 font-sans text-sm
                               focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                               transition-colors"
                  />
                </div>
              </div>
            )}

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-sans font-medium text-aubergine/70">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading || forgotSent}
                    className="text-xs font-sans text-violet hover:text-violet-dark transition-colors disabled:opacity-50"
                  >
                    {forgotSent ? 'Link sent!' : 'Forgot password?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
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

            {error && (
              <p className="text-sm text-red-600 font-sans bg-red-50 px-3 py-2 rounded-brand">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full font-sans text-sm font-semibold
                         bg-violet text-white hover:bg-violet-dark shadow-lg shadow-violet/20
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-300"
            >
              {loading
                ? isSignUp
                  ? 'Creating account...'
                  : 'Signing in...'
                : isSignUp
                ? 'Create Account'
                : 'Sign In'}
            </button>
          </form>

          {/* Toggle sign up / sign in */}
          <p className="text-sm text-center text-aubergine/40 font-sans mt-5">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
                setMessage('')
              }}
              className="text-violet font-semibold hover:text-violet-dark transition-colors"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>

        </div>
      </div>
    </div>
  )
}
