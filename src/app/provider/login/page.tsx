'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

export default function ProviderLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

      // Check if user has provider role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile?.role !== 'provider') {
        await supabase.auth.signOut()
        throw new Error('This account does not have provider access.')
      }

      router.push('/provider/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // Demo login — skip auth for investor demo
  const handleDemoLogin = () => {
    // Store demo session in localStorage
    localStorage.setItem('womenkind_demo_provider', JSON.stringify({
      id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Dr. Joseph Urban Jr.',
      credentials: 'MD, Neurosurgery',
      email: 'dr.urban@womenkind.com',
    }))
    router.push('/provider/dashboard')
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
          <p className="text-sm font-sans text-aubergine/50 mt-3">Provider Portal</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-card shadow-lg shadow-aubergine/5 p-8">
          <h2 className="font-serif text-xl text-aubergine mb-6">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-sans font-medium text-aubergine/70 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

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
            Demo mode uses sample patient data — no account needed
          </p>
        </div>
      </div>
    </div>
  )
}
