import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'
import CheckoutButton from '@/components/onboarding/CheckoutButton'

interface Props {
  searchParams: { session_id?: string }
}

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
        await db
          .update(patients)
          .set({ onboarding_status: 'paid' })
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
        maxWidth: '480px',
        width: '100%',
      }}>
        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>
          Womenkind Health
        </p>

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

        {status === 'verified' && (
          <>
            <h1 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>
              Complete your membership
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
              Your email is verified. Set up your membership to access the intake form and schedule your first visit.
            </p>
            <CheckoutButton />
          </>
        )}

        {status === 'paid' && (
          <>
            <h1 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>
              You're ready to begin
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
              Your membership is active. Complete your intake form so Dr. Urban can prepare for your first visit.
            </p>
            <Link
              href="/welcome"
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
