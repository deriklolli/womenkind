import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyVerificationToken } from '@/lib/auth-tokens'
import { getServerSession } from '@/lib/getServerSession'

interface Props {
  searchParams: { patientId?: string; token?: string; ts?: string }
}

export default async function VerifiedPage({ searchParams }: Props) {
  const { patientId, token, ts } = searchParams

  if (!patientId || !token || !ts) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7f3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '48px', maxWidth: '480px', textAlign: 'center' }}>
          <h1 style={{ color: '#280f49', fontWeight: 400 }}>Invalid link</h1>
          <p style={{ color: 'rgba(66,42,31,0.7)' }}>This verification link is missing required parameters. Please request a new one.</p>
        </div>
      </div>
    )
  }

  const valid = verifyVerificationToken(patientId, token, ts)

  if (!valid) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7f3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '48px', maxWidth: '480px', textAlign: 'center' }}>
          <h1 style={{ color: '#280f49', fontWeight: 400 }}>Link expired or invalid</h1>
          <p style={{ color: 'rgba(66,42,31,0.7)' }}>Verification links expire after 24 hours. Please sign in and request a new one.</p>
        </div>
      </div>
    )
  }

  // Advance status from unverified → verified (idempotent, before session check
  // so the update persists even if the user isn't logged in on this device)
  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    columns: { onboarding_status: true },
  })

  if (patient?.onboarding_status === 'unverified') {
    await db
      .update(patients)
      .set({ onboarding_status: 'verified' })
      .where(eq(patients.id, patientId))
  }

  // Now ensure the user is logged in before continuing
  const session = await getServerSession()
  if (!session || session.role !== 'patient' || session.patientId !== patientId) {
    redirect('/patient/login?next=/signup/resume')
  }

  redirect('/signup/resume')
}
