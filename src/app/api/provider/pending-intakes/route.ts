import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, ALL_STAFF } from '@/lib/requireStaffRole'
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

  const roleError = requireStaffRole(session, ALL_STAFF)
  if (roleError) return roleError

  const result = await db
    .select({ count: count() })
    .from(intakes)
    .where(eq(intakes.status, 'submitted'))

  const pendingCount = result[0]?.count ?? 0

  return NextResponse.json({ count: pendingCount })
}
