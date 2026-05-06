// src/app/join/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const PLANS = [
  {
    key: 'standard',
    name: 'Standard',
    price: '$X/mo',
    description: 'Plan description TBD',
    features: ['Feature 1 TBD', 'Feature 2 TBD', 'Feature 3 TBD'],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '$X/mo',
    description: 'Plan description TBD',
    features: ['Everything in Standard', 'Feature 4 TBD', 'Feature 5 TBD'],
    highlighted: true,
  },
  {
    key: 'elite',
    name: 'Elite',
    price: '$X/mo',
    description: 'Plan description TBD',
    features: ['Everything in Premium', 'Feature 6 TBD', 'Feature 7 TBD'],
  },
]

export default async function JoinPage() {
  // Active patients go straight to dashboard
  const session = await getServerSession()
  if (session?.role === 'patient' && session.patientId) {
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, session.patientId),
      columns: { onboarding_status: true },
    })
    if (patient?.onboarding_status === 'active') {
      redirect('/patient/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f3ee',
      fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      padding: '48px 24px',
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>
            Womenkind Health
          </p>
          <h1 style={{ margin: '0 0 16px', fontSize: '36px', fontWeight: 400, color: '#280f49', lineHeight: 1.2 }}>
            Choose your membership
          </h1>
          <p style={{ margin: 0, fontSize: '18px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
            All memberships include your initial intake assessment and access to Dr. Urban.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {PLANS.map((plan) => (
            <Link
              key={plan.key}
              href={`/signup?plan=${plan.key}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                backgroundColor: plan.highlighted ? '#280f49' : '#ffffff',
                borderRadius: '20px',
                padding: '40px 32px',
                border: plan.highlighted ? 'none' : '1px solid rgba(66,42,31,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: plan.highlighted ? 'rgba(255,255,255,0.6)' : 'rgba(66,42,31,0.45)' }}>
                  {plan.name}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '32px', fontWeight: 400, color: plan.highlighted ? '#ffffff' : '#280f49' }}>
                  {plan.price}
                </p>
                <p style={{ margin: '0 0 24px', fontSize: '15px', color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'rgba(66,42,31,0.7)', lineHeight: 1.5 }}>
                  {plan.description}
                </p>
                <ul style={{ margin: '0 0 32px', padding: '0 0 0 20px', listStyle: 'disc', flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ marginBottom: '8px', fontSize: '14px', color: plan.highlighted ? 'rgba(255,255,255,0.85)' : 'rgba(66,42,31,0.8)' }}>
                      {f}
                    </li>
                  ))}
                </ul>
                <div style={{
                  display: 'block',
                  backgroundColor: plan.highlighted ? '#944fed' : '#280f49',
                  color: '#ffffff',
                  padding: '14px 32px',
                  borderRadius: '100px',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '15px',
                }}>
                  Get started
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
