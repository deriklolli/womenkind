import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { requireStaffRole, ALL_STAFF } from '@/lib/requireStaffRole'
import { db } from '@/lib/db'
import { provider_notes } from '@/lib/db/schema'

/**
 * POST /api/provider/notes
 *
 * Inserts a new provider_note record into RDS.
 * Body: { patient_id, content, note_type }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession()

  const roleError = requireStaffRole(session, ALL_STAFF)
  if (roleError) return roleError
  if (!session!.providerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { patient_id, content, note_type } = body

  if (!patient_id || !content) {
    return NextResponse.json({ error: 'patient_id and content are required' }, { status: 400 })
  }

  const [note] = await db
    .insert(provider_notes)
    .values({
      patient_id,
      provider_id: session!.providerId!,
      content: content.trim(),
      note_type: note_type || 'general',
    })
    .returning({ id: provider_notes.id })

  return NextResponse.json({ id: note.id }, { status: 201 })
}
