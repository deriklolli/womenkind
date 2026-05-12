import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'
import TierCheckoutCards from '@/components/onboarding/TierCheckoutCards'
import QuickCheckoutButton from '@/components/onboarding/QuickCheckoutButton'

interface Props {
  searchParams: { session_id?: string }
}

const PAGE_SHELL: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#f7f3ee',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
  padding: '40px 24px',
}

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '20px',
  padding: '48px',
  maxWidth: '480px',
  width: '100%',
}

const LOGO = <img src="/womenkind-logo-dark.png" alt="Womenkind" style={{ height: '96px', marginBottom: '32px' }} />

export default async function ResumePage({ searchParams }: Props) {
  const session = await getServerSession()

  if (!session || session.role !== 'patient' || !session.patientId) {
    redirect('/patient/login?next=/signup/resume')
  }

  // Synchronously confirm Stripe session if redirected from checkout
  if (searchParams.session_id) {
    try {
      const stripe = getStripe()
      const stripeSession = await stripe.checkout.sessions.retrieve(searchParams.session_id)
      if (
        stripeSession.payment_status === 'paid' ||
        stripeSession.status === 'complete'
      ) {
        const plan = stripeSession.metadata?.plan || null
        await db
          .update(patients)
          .set({
            onboarding_status: 'paid',
            ...(plan ? { membership_plan: plan } : {}),
          })
          .where(eq(patients.id, session.patientId))
      }
    } catch (err) {
      console.error('[resume] Stripe session confirm failed:', err)
    }
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, session.patientId),
    columns: { onboarding_status: true },
  })

  const status = patient?.onboarding_status

  if (status === 'active') {
    redirect('/patient/dashboard')
  }

  // Read plan cookie set during signup
  const cookieStore = await cookies()
  const selectedPlan = cookieStore.get('wk_selected_plan')?.value

  // Verified state — if plan cookie present, go straight to payment; otherwise show tier cards
  if (status === 'verified') {
    if (selectedPlan) {
      return (
        <div style={PAGE_SHELL}>
          {LOGO}
          <div style={CARD}>
            <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>
              Complete your membership
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: '15px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
              Your email is verified. You'll be charged for the entry visit today — first month free.
            </p>
            <QuickCheckoutButton plan={selectedPlan} />
          </div>
        </div>
      )
    }

    // No cookie (e.g. verified on a different device) — show full tier layout
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f7f3ee',
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
        padding: '48px 24px',
      }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <img src="/womenkind-logo-dark.png" alt="Womenkind" style={{ height: '96px', marginBottom: '24px' }} />
            <h1 style={{ margin: '0 0 12px', fontSize: '36px', fontWeight: 400, color: '#280f49' }}>
              Choose your membership
            </h1>
            <p style={{ margin: 0, fontSize: '18px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
              Your email is verified. Select a plan — you'll be charged for the entry visit today, with your first month free.
            </p>
          </div>
          <TierCheckoutCards />
        </div>
      </div>
    )
  }

  return (
    <div style={PAGE_SHELL}>
      {LOGO}
      <div style={CARD}>
        {status === 'unverified' && (
          <>
            <h1 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>
              Please verify your email
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
              We sent a verification link to your email address. Click it to continue — check your spam folder if you don't see it.
            </p>
            <Link
              href="/signup/verify"
              style={{
                display: 'block',
                backgroundColor: '#944fed',
                color: '#ffffff',
                padding: '16px 32px',
                borderRadius: '100px',
                textAlign: 'center',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '16px',
              }}
            >
              Resend verification email
            </Link>
          </>
        )}

        {status === 'paid' && (
          <>
            <h1 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>
              You&apos;re ready to begin
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
              Your membership is active. Complete your intake form so Dr. Urban can prepare for your first visit.
            </p>
            <Link
              href="/intake"
              style={{
                display: 'block',
                backgroundColor: '#944fed',
                color: '#ffffff',
                padding: '16px 32px',
                borderRadius: '100px',
                textAlign: 'center',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '16px',
              }}
            >
              Start your intake
            </Link>
          </>
        )}

        {!status && (
          <p style={{ color: 'rgba(66,42,31,0.7)' }}>
            Something went wrong. Please <Link href="/patient/login" style={{ color: '#944fed' }}>sign in</Link> again.
          </p>
        )}
      </div>
    </div>
  )
}
