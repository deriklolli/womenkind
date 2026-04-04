/**
 * Scheduling Engine — Core availability computation logic.
 *
 * Computes available time slots for a provider on a given date by layering:
 * 1. Weekly recurring availability (provider_availability)
 * 2. Date-specific overrides (availability_overrides)
 * 3. Already-booked appointments
 * 4. Google Calendar busy times (Phase 2)
 */

export interface TimeSlot {
  start: string // ISO timestamp
  end: string   // ISO timestamp
}

export interface AvailabilityWindow {
  start_time: string // HH:MM
  end_time: string   // HH:MM
}

export interface BookedSlot {
  starts_at: string
  ends_at: string
}

/**
 * Given a provider's availability windows for a day, compute discrete
 * time slots of the given duration (in minutes), then subtract booked
 * appointments and busy times.
 */
export function computeAvailableSlots({
  date,
  durationMinutes,
  availabilityWindows,
  bookedSlots,
  busyTimes = [],
  bufferMinutes = 0,
}: {
  date: string // YYYY-MM-DD
  durationMinutes: number
  availabilityWindows: AvailabilityWindow[]
  bookedSlots: BookedSlot[]
  busyTimes?: BookedSlot[]
  bufferMinutes?: number
}): TimeSlot[] {
  const slots: TimeSlot[] = []

  for (const window of availabilityWindows) {
    const windowStart = new Date(`${date}T${window.start_time}:00`)
    const windowEnd = new Date(`${date}T${window.end_time}:00`)

    let slotStart = new Date(windowStart)

    while (slotStart.getTime() + durationMinutes * 60 * 1000 <= windowEnd.getTime()) {
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000)

      // Check for conflicts with booked appointments
      const hasBookingConflict = bookedSlots.some(booked => {
        const bookedStart = new Date(booked.starts_at)
        const bookedEnd = new Date(booked.ends_at)
        // Add buffer on both sides of existing bookings
        const bufferedStart = new Date(bookedStart.getTime() - bufferMinutes * 60 * 1000)
        const bufferedEnd = new Date(bookedEnd.getTime() + bufferMinutes * 60 * 1000)
        return slotStart < bufferedEnd && slotEnd > bufferedStart
      })

      // Check for conflicts with Google Calendar busy times
      const hasBusyConflict = busyTimes.some(busy => {
        const busyStart = new Date(busy.starts_at)
        const busyEnd = new Date(busy.ends_at)
        return slotStart < busyEnd && slotEnd > busyStart
      })

      if (!hasBookingConflict && !hasBusyConflict) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        })
      }

      // Move to next slot (use 15-min increments for flexibility)
      slotStart = new Date(slotStart.getTime() + 15 * 60 * 1000)
    }
  }

  return slots
}

/**
 * Check if a specific time slot is available (used for double-booking prevention).
 */
export function isSlotAvailable({
  startsAt,
  endsAt,
  availabilityWindows,
  bookedSlots,
  date,
}: {
  startsAt: string
  endsAt: string
  availabilityWindows: AvailabilityWindow[]
  bookedSlots: BookedSlot[]
  date: string
}): boolean {
  const requestedStart = new Date(startsAt)
  const requestedEnd = new Date(endsAt)

  // Check the slot falls within an availability window
  const withinWindow = availabilityWindows.some(window => {
    const windowStart = new Date(`${date}T${window.start_time}:00`)
    const windowEnd = new Date(`${date}T${window.end_time}:00`)
    return requestedStart >= windowStart && requestedEnd <= windowEnd
  })

  if (!withinWindow) return false

  // Check for booking conflicts
  const hasConflict = bookedSlots.some(booked => {
    const bookedStart = new Date(booked.starts_at)
    const bookedEnd = new Date(booked.ends_at)
    return requestedStart < bookedEnd && requestedEnd > bookedStart
  })

  return !hasConflict
}

/**
 * Format a price in cents to a display string.
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(0)}`
}

/**
 * Get the day of week (0-6) for a date string.
 */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay()
}
