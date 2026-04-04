import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/scheduling/appointment-types?providerId=xxx
 * Returns active appointment types for a provider.
 *
 * POST /api/scheduling/appointment-types
 * Create or update an appointment type (provider only).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const providerId = req.nextUrl.searchParams.get('providerId')

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('appointment_types')
      .select('*')
      .eq('provider_id', providerId)
      .eq('is_active', true)
      .order('sort_order')

    if (error) throw error

    return NextResponse.json({ appointmentTypes: data })
  } catch (err: any) {
    console.error('Failed to fetch appointment types:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const body = await req.json()
    const { id, providerId, name, description, durationMinutes, priceCents, color, sortOrder } = body

    if (!providerId || !name || !durationMinutes) {
      return NextResponse.json({ error: 'providerId, name, and durationMinutes are required' }, { status: 400 })
    }

    if (id) {
      // Update existing
      const { data, error } = await supabase
        .from('appointment_types')
        .update({
          name,
          description,
          duration_minutes: durationMinutes,
          price_cents: priceCents ?? 0,
          color: color ?? '#944fed',
          sort_order: sortOrder ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ appointmentType: data })
    } else {
      // Create new
      const { data, error } = await supabase
        .from('appointment_types')
        .insert({
          provider_id: providerId,
          name,
          description,
          duration_minutes: durationMinutes,
          price_cents: priceCents ?? 0,
          color: color ?? '#944fed',
          sort_order: sortOrder ?? 0,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ appointmentType: data })
    }
  } catch (err: any) {
    console.error('Failed to save appointment type:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
