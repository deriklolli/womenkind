import { NextResponse } from 'next/server'
import type { ServerSession, StaffRole } from '@/lib/getServerSession'

export function requireStaffRole(
  session: ServerSession | null,
  allowed: StaffRole[],
): NextResponse | null {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!session.staffRole || !allowed.includes(session.staffRole)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 })
  }
  return null
}

export const ALL_STAFF: StaffRole[] = ['md', 'np', 'rn', 'ma', 'admin', 'concierge']
export const CLINICAL_STAFF: StaffRole[] = ['md', 'np', 'rn', 'ma']
export const MD_NP: StaffRole[] = ['md', 'np']
export const RN_STAFF: StaffRole[] = ['rn', 'np', 'ma']
export const ADMIN_STAFF: StaffRole[] = ['admin', 'concierge']
export const CAN_ESCALATE: StaffRole[] = ['rn', 'ma']
