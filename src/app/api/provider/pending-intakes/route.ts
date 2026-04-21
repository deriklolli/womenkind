import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'

/**
 * GET /api/provider/pending-intakes
 *
 * Returns the count of intakes with status = 'submitted'.
 * Used by ProviderNav to display the intake queue badge.
 */
export async function GET() {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'provider' || !session.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await db
    .select({ count: count() })
    .from(intakes)
    .where(eq(intakes.status, 'submitted'))

  const pendingCount = result[0]?.count ?? 0

  return NextResponse.json({ count: pendingCount })
}
