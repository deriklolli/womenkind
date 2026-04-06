import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/notifications?patientId=...
export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId')
  if (!patientId) {
    return NextResponse.json({ error: 'patientId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('patient_id', patientId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: data })
}

// PATCH /api/notifications  — body: { id, is_read?, dismissed? } or { patientId, markAllRead: true }
export async function PATCH(req: NextRequest) {
  const body = await req.json()

  // Bulk mark all read
  if (body.patientId && body.markAllRead) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('patient_id', body.patientId)
      .eq('is_read', false)
      .eq('dismissed', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Single notification update
  if (!body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const updates: Record<string, boolean> = {}
  if (typeof body.is_read === 'boolean') updates.is_read = body.is_read
  if (typeof body.dismissed === 'boolean') updates.dismissed = body.dismissed

  const { error } = await supabase
    .from('notifications')
    .update(updates)
    .eq('id', body.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
