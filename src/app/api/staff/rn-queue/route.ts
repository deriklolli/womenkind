import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, RN_STAFF } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { and, inArray, notInArray } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, RN_STAFF)
  if (roleError) return roleError

  const rows = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.priority, ['orange', 'yellow']),
      notInArray(tasks.status, ['resolved', 'closed']),
    ),
    orderBy: (t, { asc }) => [
      sql`CASE ${t.priority} WHEN 'orange' THEN 0 ELSE 1 END`,
      asc(t.due_at),
    ],
    limit: 100,
  })

  return NextResponse.json({ tasks: rows })
}
