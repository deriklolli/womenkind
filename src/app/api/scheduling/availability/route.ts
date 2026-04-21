import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { appointment_types, availability_overrides, provider_availability, appointments } from '@/lib/db/schema'
import { eq, and, gte, lte, ne } from 'drizzle-orm'
import { computeAvailableSlots, getDayOfWeek } from '@/lib/scheduling'
import { getProviderBusyTimes } from '@/lib/google-calendar'

export const dynamic = 'force-dynamic'

/**
 * GET /api/scheduling/availability?providerId=xxx&date=YYYY-MM-DD&appointmentTypeId=xxx
 *
 * Returns available time slots for a provider on a given date,
 * accounting for weekly availability, overrides, booked appointments,
 * and Google Calendar busy times.
 */
export async function GET(req: NextRequest) {
  try {
    const providerId = req.nextUrl.searchParams.get('providerId')
    const date = req.nextUrl.searchParams.get('date')
    const appointmentTypeId = req.nextUrl.searchParams.get('appointmentTypeId')

    if (!providerId || !date || !appointmentTypeId) {
      return NextResponse.json(
        { error: 'providerId, date, and appointmentTypeId are required' },
        { status: 400 }
      )
    }

    // 1. Get the appointment type for its duration
    const appointmentType = await db.query.appointment_types.findFirst({
      where: eq(appointment_types.id, appointmentTypeId),
    })

    if (!appointmentType) {
      return NextResponse.json({ error: 'Appointment type not found' }, { status: 404 })
    }

    // 2. Get day of week for the requested date
    const dayOfWeek = getDayOfWeek(date)

    // 3. Check for date-specific overrides
    const overrides = await db.query.availability_overrides.findMany({
      where: and(
        eq(availability_overrides.provider_id, providerId),
        eq(availability_overrides.date, date)
      ),
    })

    const override = overrides?.[0]

    // If the day is marked unavailable (is_available = false with no hours), return empty
    if (override && !override.is_available && !override.start_time) {
      return NextResponse.json({ slots: [] })
    }

    // 4. Get recurring availability for this day of week
    const availability = await db.query.provider_availability.findMany({
      where: and(
        eq(provider_availability.provider_id, providerId),
        eq(provider_availability.day_of_week, dayOfWeek),
        eq(provider_availability.is_active, true)
      ),
    })

    // If override has custom hours, use those instead
    let windows = availability?.map(a => ({
      start_time: a.start_time,
      end_time: a.end_time,
    })) || []

    if (override?.start_time && override?.end_time) {
      windows = [{ start_time: override.start_time, end_time: override.end_time }]
    }

    if (windows.length === 0) {
      return NextResponse.json({ slots: [] })
    }

    // 5. Get booked appointments for this date (non-canceled)
    const dayStart = new Date(`${date}T00:00:00`)
    const dayEnd = new Date(`${date}T23:59:59`)

    const bookedAppointments = await db.query.appointments.findMany({
      where: and(
        eq(appointments.provider_id, providerId),
        ne(appointments.status, 'canceled'),
        gte(appointments.starts_at, dayStart),
        lte(appointments.starts_at, dayEnd)
      ),
    })

    const bookedSlots = bookedAppointments?.map(a => ({
      starts_at: a.starts_at.toISOString(),
      ends_at: a.ends_at.toISOString(),
    })) || []

    // 6. Get Google Calendar busy times (pass YYYY-MM-DD format)
    const busyTimes = await getProviderBusyTimes(providerId, date, date)

    // 7. Compute available slots
    const slots = computeAvailableSlots({
      date,
      durationMinutes: appointmentType.duration_minutes,
      availabilityWindows: windows,
      bookedSlots,
      busyTimes,
    })

    // 8. Filter out past slots if the date is today
    const now = new Date()
    const filteredSlots = slots.filter(slot => new Date(slot.start) > now)

    return NextResponse.json({ slots: filteredSlots })
  } catch (err: any) {
    console.error('Availability error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
