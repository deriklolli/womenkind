import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointment_types } from '@/lib/db/schema'
import { eq, asc, and } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

/**
 * GET /api/scheduling/appointment-types?providerId=xxx
 * Returns active appointment types for a provider.
 *
 * POST /api/scheduling/appointment-types
 * Create or update an appointment type (provider only).
 */
export async function GET(req: NextRequest) {
  try {
    const providerId = req.nextUrl.searchParams.get('providerId')

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
    }

    const data = await db.query.appointment_types.findMany({
      where: eq(appointment_types.provider_id, providerId),
      orderBy: [asc(appointment_types.created_at)],
    })

    return NextResponse.json({ appointmentTypes: data })
  } catch (err: any) {
    console.error('Failed to fetch appointment types:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { id, providerId, name, durationMinutes, priceCents, color } = body

    if (!providerId || !name || !durationMinutes) {
      return NextResponse.json({ error: 'providerId, name, and durationMinutes are required' }, { status: 400 })
    }

    if (id) {
      // Update existing
      const [data] = await db
        .update(appointment_types)
        .set({
          name,
          duration_minutes: durationMinutes,
          price_cents: priceCents ?? 0,
          color: color ?? '#944fed',
        })
        .where(and(eq(appointment_types.id, id), eq(appointment_types.provider_id, providerId)))
        .returning()

      if (!data) {
        return NextResponse.json({ error: 'Appointment type not found' }, { status: 404 })
      }
      return NextResponse.json({ appointmentType: data })
    } else {
      // Create new
      const [data] = await db
        .insert(appointment_types)
        .values({
          provider_id: providerId,
          name,
          duration_minutes: durationMinutes,
          price_cents: priceCents ?? 0,
          color: color ?? '#944fed',
        })
        .returning()

      return NextResponse.json({ appointmentType: data })
    }
  } catch (err: any) {
    console.error('Failed to save appointment type:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
