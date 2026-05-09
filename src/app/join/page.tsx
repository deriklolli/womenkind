// src/app/join/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type Plan = {
  key: string
  name: string
  tag: string
  entryPrice: string
  entryLabel: string
  price: string
  prepay: string
  entry: string
  who: string
  includesLabel: string
  features: string[]
  highlighted?: boolean
  badge?: string
}

const PLANS: Plan[] = [
  {
    key: 'foundations',
    name: 'Foundations',
    tag: 'Tier 1',
    entryPrice: '$295',
    entryLabel: 'Discovery visit',
    price: '$129',
    prepay: '$1,290 annual prepay — 2 months free',
    entry: '$295 Discovery visit (15-min intake review & care plan preview)',
    who: 'For the woman in early perimenopause who wants a midlife specialist relationship before symptoms escalate — or before she\'s ready for HRT.',
    includesLabel: 'Includes',
    features: [
      'One 15-min telehealth check-in per quarter',
      'Secure messaging via the Womenkind platform',
      'Symptom tracker',
      'Personalized care presentation tailored to your intake',
      'Oura integration — patient-facing dashboard',
      'Member discount (25%) on supplement protocols via Fullscript',
    ],
  },
  {
    key: 'vitality',
    name: 'Vitality',
    tag: 'Tier 2 · Core',
    entryPrice: '$600',
    entryLabel: 'Initial consultation',
    price: '$249',
    prepay: '$2,490 annual prepay — 2 months free',
    entry: '$600 comprehensive consultation (1–2 hr with Dr. Urban)',
    who: 'For the woman ready for HRT, or already on it, who wants ongoing specialty care with predictable costs and a clinician who actually knows her.',
    includesLabel: 'Includes',
    features: [
      'One 30-min visit per quarter (video or in-office)',
      'Unlimited secure messaging — 1 business day response',
      'Full HRT prescription management',
      'Annual hormone & wellness panel included',
      'Negotiated cash lab pricing (40–60% under retail)',
      'Oura data flows into your chart — Dr. Urban reviews before each visit',
      'Personalized care plan, updated after each consultation',
      'Member discount (25%) on supplement protocols via Fullscript',
    ],
    highlighted: true,
    badge: 'Most members',
  },
  {
    key: 'concierge',
    name: 'Concierge',
    tag: 'Tier 3 · Premium',
    entryPrice: '$750',
    entryLabel: 'Initial consultation',
    price: '$549',
    prepay: '$5,490 annual prepay — 2 months free',
    entry: '$750 comprehensive consultation (1–2 hr with Dr. Urban)',
    who: 'For the Park City patient considering Cenegenics. Same depth of access, focused on what actually matters for midlife women — at a third of the price.',
    includesLabel: 'Everything in Vitality, plus',
    features: [
      'One 60-min visit per month with Dr. Urban',
      'Same-day messaging response',
      'Two comprehensive panels per year + reactive labs at cost',
      'Active Oura monitoring — outreach when patterns shift',
      'Quarterly hormone-correlation review with biometric data',
      'Priority scheduling & in-office availability',
      'Annual longevity review & 12-month plan',
      'Partner/spouse may join consultations',
    ],
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
    if (['unverified', 'verified', 'paid'].includes(patient?.onboarding_status ?? '')) {
      redirect('/signup/resume')
    }
  }

  return (
    <>
    <style>{`
      .join-btn { transition: opacity 0.15s, transform 0.15s; }
      .join-btn:hover { opacity: 0.85; transform: scale(1.02); }
    `}</style>
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f3ee',
      fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      padding: '48px 24px',
    }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
            <Image src="/womenkind-logo-dark.png" alt="Womenkind" width={216} height={48} style={{ objectFit: 'contain' }} />
          </div>
          <h1 style={{ margin: '0 0 16px', fontSize: '36px', fontWeight: 400, color: '#280f49', lineHeight: 1.2 }}>
            Choose your membership
          </h1>
          <p style={{ margin: 0, fontSize: '18px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
            All memberships include a personalized intake and access to Dr. Urban.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
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
                boxShadow: plan.highlighted ? '0 8px 32px rgba(40,15,73,0.18)' : '0 4px 20px rgba(66,42,31,0.08)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}>
                {plan.badge && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '32px',
                    backgroundColor: '#944fed',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '5px 12px',
                    borderRadius: '4px',
                  }}>
                    {plan.badge}
                  </div>
                )}

                <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: plan.highlighted ? 'rgba(255,255,255,0.5)' : 'rgba(66,42,31,0.45)' }}>
                  {plan.tag}
                </p>
                <p style={{ margin: '0 0 16px', fontSize: '28px', fontWeight: 400, color: plan.highlighted ? '#ffffff' : '#280f49', letterSpacing: '-0.01em' }}>
                  {plan.name}
                </p>

                {/* Upfront charge — shown large */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '48px', fontWeight: 400, color: plan.highlighted ? '#ffffff' : '#280f49', lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {plan.entryPrice}
                  </span>
                  <span style={{ fontSize: '13px', color: plan.highlighted ? 'rgba(255,255,255,0.55)' : 'rgba(66,42,31,0.5)' }}>
                    {plan.entryLabel}
                  </span>
                </div>

                {/* Monthly + first month free */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '15px', color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'rgba(66,42,31,0.6)' }}>
                    then {plan.price}/mo
                  </span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    backgroundColor: plan.highlighted ? 'rgba(148,79,237,0.35)' : 'rgba(148,79,237,0.12)',
                    color: plan.highlighted ? '#d4a8ff' : '#944fed',
                    padding: '3px 8px',
                    borderRadius: '100px',
                  }}>
                    First month free
                  </span>
                </div>

                <div style={{
                  padding: '12px 0',
                  borderTop: `1px solid ${plan.highlighted ? 'rgba(255,255,255,0.15)' : 'rgba(66,42,31,0.1)'}`,
                  borderBottom: `1px solid ${plan.highlighted ? 'rgba(255,255,255,0.15)' : 'rgba(66,42,31,0.1)'}`,
                  marginBottom: '20px',
                  fontSize: '12px',
                  color: plan.highlighted ? 'rgba(255,255,255,0.65)' : 'rgba(66,42,31,0.6)',
                  lineHeight: 1.5,
                }}>
                  <span style={{ fontWeight: 600, color: plan.highlighted ? 'rgba(255,255,255,0.85)' : 'rgba(66,42,31,0.8)' }}>Entry visit: </span>
                  {plan.entry}
                </div>

                <p style={{ margin: '0 0 20px', fontSize: '14px', fontStyle: 'italic', color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'rgba(66,42,31,0.6)', lineHeight: 1.55 }}>
                  {plan.who}
                </p>

                <p style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: plan.highlighted ? 'rgba(255,255,255,0.5)' : 'rgba(66,42,31,0.4)' }}>
                  {plan.includesLabel}
                </p>
                <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{
                      marginBottom: '0',
                      padding: '8px 0 8px 16px',
                      fontSize: '13.5px',
                      color: plan.highlighted ? 'rgba(255,255,255,0.8)' : 'rgba(66,42,31,0.75)',
                      lineHeight: 1.5,
                      borderBottom: `1px solid ${plan.highlighted ? 'rgba(255,255,255,0.08)' : 'rgba(66,42,31,0.06)'}`,
                      position: 'relative',
                    }}>
                      <span style={{ position: 'absolute', left: 0, color: '#944fed', fontWeight: 600, fontSize: '12px' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="join-btn" style={{
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
    </>
  )
}
