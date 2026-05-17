import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, ADMIN_STAFF } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { and, inArray, notInArray } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, ADMIN_STAFF)
  if (roleError) return roleError

  const rows = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.category, ['service', 'admin', 'unable_to_reach']),
      notInArray(tasks.status, ['resolved', 'closed']),
    ),
    limit: 100,
  })

  return NextResponse.json({ tasks: rows })
}
