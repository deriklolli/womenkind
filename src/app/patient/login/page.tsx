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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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

      // Verify patient role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile?.role !== 'patient') {
        await supabase.auth.signOut()
        throw new Error('This account is not a patient account. Please use the provider login.')
      }

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
      if (!data.session) {
        setMessage('Check your email for a confirmation link.')
        return
      }

      router.push('/patient/dashboard')
    } catch (err: any) {
      setError(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  // Demo login — skip auth for investor demo
  const handleDemoLogin = () => {
    localStorage.setItem(
      'womenkind_demo_patient',
      JSON.stringify({
        id: 'demo-patient',
        name: 'Sarah Mitchell',
        email: 'sarah@example.com',
      })
    )
    router.push('/patient/dashboard')
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
          <p className="text-sm font-sans text-aubergine/50 mt-3">Patient Portal</p>
        </div>

        {/* Login/Signup card */}
        <div className="bg-white rounded-card shadow-lg shadow-aubergine/5 p-8">
          <h2 className="font-serif text-xl text-aubergine mb-6">
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
              <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-brand border border-aubergine/10 text-aubergine
                           placeholder:text-aubergine/30 font-sans text-sm
                           focus:outline-none focus:border-violet focus:ring-1 focus:ring-violet/20
                           transition-colors"
              />
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-aubergine/10" />
            <span className="text-xs font-sans text-aubergine/30">OR</span>
            <div className="flex-1 h-px bg-aubergine/10" />
          </div>

          {/* Demo access */}
          <button
            onClick={handleDemoLogin}
            className="w-full py-3 rounded-full font-sans text-sm font-semibold
                       border-2 border-violet/20 text-violet hover:bg-violet/5
                       transition-colors"
          >
            Enter Demo Mode
          </button>
          <p className="text-xs text-aubergine/30 font-sans text-center mt-3">
            Demo mode uses sample data — no account needed
          </p>
        </div>
      </div>
    </div>
  )
}
