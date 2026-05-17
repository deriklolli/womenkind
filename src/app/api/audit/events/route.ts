import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole } from '@/lib/requireStaffRole'
import type { StaffRole } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { audit_events } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

const ALLOWED: StaffRole[] = ['md', 'np', 'admin']

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  const roleError = requireStaffRole(session, ALLOWED)
  if (roleError) return roleError

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)

  const rows = await db.query.audit_events.findMany({
    where: patientId ? eq(audit_events.patient_id, patientId) : undefined,
    orderBy: [desc(audit_events.created_at)],
    limit,
  })

  return NextResponse.json({ events: rows })
}
