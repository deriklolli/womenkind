import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase-server'
import { computeAvailableSlots, getDayOfWeek } from '@/lib/scheduling'
import { getProviderBusyTimes } from '@/lib/google-calendar'

/**
 * GET /api/scheduling/availability?providerId=xxx&date=YYYY-MM-DD&appointmentTypeId=xxx
 *
 * Returns available time slots for a provider on a given date,
 * accounting for weekly availability, overrides, booked appointments,
 * and Google Calendar busy times.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase()
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
    const { data: appointmentType, error: typeError } = await supabase
      .from('appointment_types')
      .select('duration_minutes')
      .eq('id', appointmentTypeId)
      .single()

    if (typeError || !appointmentType) {
      return NextResponse.json({ error: 'Appointment type not found' }, { status: 404 })
    }

    // 2. Get day of week for the requested date
    const dayOfWeek = getDayOfWeek(date)

    // 3. Check for date-specific overrides
    const { data: overrides } = await supabase
      .from('availability_overrides')
      .select('*')
      .eq('provider_id', providerId)
      .eq('override_date', date)

    const override = overrides?.[0]

    // If the day is marked unavailable, return empty
    if (override?.is_unavailable) {
      return NextResponse.json({ slots: [], reason: override.reason || 'Unavailable' })
    }

    // 4. Get recurring availability for this day of week
    const { data: availability } = await supabase
      .from('provider_availability')
      .select('start_time, end_time')
      .eq('provider_id', providerId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)

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
    const dayStart = `${date}T00:00:00`
    const dayEnd = `${date}T23:59:59`

    const { data: bookedAppointments } = await supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('provider_id', providerId)
      .neq('status', 'canceled')
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd)

    const bookedSlots = bookedAppointments?.map(a => ({
      starts_at: a.starts_at,
      ends_at: a.ends_at,
    })) || []

    // 6. Get Google Calendar busy times
    const busyTimes = await getProviderBusyTimes(providerId, dayStart, dayEnd)

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
