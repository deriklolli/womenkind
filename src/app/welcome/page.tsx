// src/app/welcome/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function WelcomePage() {
  const session = await getServerSession()
  if (!session || session.role !== 'patient') {
    redirect('/patient/login?next=/welcome')
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, session.patientId!),
    columns: { onboarding_status: true },
  })

  const status = patient?.onboarding_status
  if (status === 'active') redirect('/patient/dashboard')
  if (status !== 'paid') redirect('/signup/resume')

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f3ee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '48px',
        maxWidth: '520px',
        width: '100%',
        textAlign: 'center',
      }}>
        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>
          Womenkind Health
        </p>
        <h1 style={{ margin: '0 0 20px', fontSize: '30px', fontWeight: 400, color: '#280f49', lineHeight: 1.3 }}>
          Your intake takes about 15 minutes
        </h1>
        <p style={{ margin: '0 0 40px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
          Everything you share goes directly to Dr. Urban to prepare your first visit. Your answers are private and secure.
        </p>
        <Link
          href="/intake"
          style={{
            display: 'inline-block',
            backgroundColor: '#944fed',
            color: '#ffffff',
            padding: '16px 40px',
            borderRadius: '100px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '16px',
          }}
        >
          Begin intake
        </Link>
      </div>
    </div>
  )
}
