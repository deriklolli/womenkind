// src/app/api/debug/gen-verify-link/route.ts
// Temporary debug endpoint — generates a fresh verification link for a given email.
// Protected by CRON_SECRET. Delete after use.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateVerificationToken } from '@/lib/auth-tokens'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.email, email) })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const patient = await db.query.patients.findFirst({ where: eq(patients.profile_id, profile.id) })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Optionally advance status directly
  const advance = req.nextUrl.searchParams.get('advance')
  if (advance && patient.onboarding_status === 'unverified') {
    await db.update(patients).set({ onboarding_status: 'verified' }).where(eq(patients.id, patient.id))
    patient.onboarding_status = 'verified'
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com').replace(/\/+$/, '')
  const { token, ts } = generateVerificationToken(patient.id)
  const url = `${appUrl}/signup/verified?patientId=${patient.id}&token=${token}&ts=${ts}`

  return NextResponse.json({ patientId: patient.id, onboarding_status: patient.onboarding_status, verifyUrl: url })
}
