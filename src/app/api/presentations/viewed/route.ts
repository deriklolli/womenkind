import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'

/**
 * PATCH /api/presentations/viewed
 * Marks a care presentation as viewed. Uses service role to bypass RLS
 * (patients are not permitted to update care_presentations directly).
 * Body: { presentationId: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const { presentationId } = await req.json()

    if (!presentationId) {
      return NextResponse.json({ error: 'presentationId is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('care_presentations')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('id', presentationId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Failed to mark presentation viewed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
