import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import { patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateVerificationToken } from '@/lib/auth-tokens'

export async function GET(req: NextRequest) {
  if (process.env.ENABLE_TEST_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const result = await db
    .select({ patientId: patients.id })
    .from(patients)
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(profiles.email, email))
    .limit(1)

  const row = result[0]
  if (!row) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const { token, ts } = generateVerificationToken(row.patientId)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/+$/, '')
  const verifyUrl = `${appUrl}/signup/verified?patientId=${row.patientId}&token=${token}&ts=${ts}`

  return NextResponse.json({ verifyUrl, patientId: row.patientId })
}
