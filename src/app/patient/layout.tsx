'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Login page doesn't need protection
    if (pathname === '/patient/login') {
      setAuthorized(true)
      setChecking(false)
      return
    }

    const checkAccess = async () => {
      // Check demo session first
      const demo = localStorage.getItem('womenkind_demo_patient')
      if (demo) {
        setAuthorized(true)
        setChecking(false)
        return
      }

      // Check Supabase auth
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (profile?.role === 'patient') {
          setAuthorized(true)
          setChecking(false)
          return
        }
      }

      // Not authorized — redirect to login
      router.replace('/patient/login')
    }

    checkAccess()
  }, [pathname, router])

  if (checking && pathname !== '/patient/login') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet/20 border-t-violet rounded-full animate-spin" />
      </div>
    )
  }

  if (!authorized && pathname !== '/patient/login') return null

  return <>{children}</>
}
