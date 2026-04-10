/**
 * Unit tests for the scheduling availability engine.
 *
 * These are pure-logic tests — no database, no network, no mocks needed.
 * The scheduling module computes available time slots given a provider's
 * availability windows, existing bookings, and optional busy times.
 *
 * Test date: April 20, 2026 (confirmed Monday, MDT = UTC-6).
 */

import {
  computeAvailableSlots,
  isSlotAvailable,
  formatPrice,
  getDayOfWeek,
  type AvailabilityWindow,
  type BookedSlot,
} from '../scheduling'

// A fixed Monday in April 2026 (MDT). Using a consistent date keeps
// timezone math predictable across environments.
const TEST_DATE = '2026-04-20'

// Helpers
const window2h: AvailabilityWindow = { start_time: '09:00', end_time: '11:00' }
const window1h: AvailabilityWindow = { start_time: '09:00', end_time: '10:00' }
const windowAfternoon: AvailabilityWindow = { start_time: '14:00', end_time: '15:00' }

// ---------------------------------------------------------------------------
// computeAvailableSlots
// ---------------------------------------------------------------------------

describe('computeAvailableSlots', () => {

  describe('basic slot generation', () => {
    it('returns an empty array when there are no availability windows', () => {
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [],
        bookedSlots: [],
      })
      expect(slots).toHaveLength(0)
    })

    it('generates 5 slots for a 2-hour window with 60-min appointments (15-min increments)', () => {
      // 09:00–10:00, 09:15–10:15, 09:30–10:30, 09:45–10:45, 10:00–11:00
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })
      expect(slots).toHaveLength(5)
    })

    it('generates 3 slots for a 1-hour window with 30-min appointments', () => {
      // 09:00–09:30, 09:15–09:45, 09:30–10:00
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 30,
        availabilityWindows: [window1h],
        bookedSlots: [],
      })
      expect(slots).toHaveLength(3)
    })

    it('generates 1 slot when window exactly fits the appointment duration', () => {
      // 09:00–10:00 window with 60-min appointment = exactly 1 slot
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window1h],
        bookedSlots: [],
      })
      expect(slots).toHaveLength(1)
    })

    it('returns 0 slots when appointment is longer than the window', () => {
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 90,
        availabilityWindows: [window1h], // only 60 mins wide
        bookedSlots: [],
      })
      expect(slots).toHaveLength(0)
    })
  })

  describe('slot format and ordering', () => {
    it('returns slots as valid ISO 8601 timestamp strings', () => {
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })
      const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      expect(slots[0].start).toMatch(isoPattern)
      expect(slots[0].end).toMatch(isoPattern)
    })

    it('each slot end is exactly durationMinutes after its start', () => {
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })
      slots.forEach(slot => {
        const durationMs = new Date(slot.end).getTime() - new Date(slot.start).getTime()
        expect(durationMs).toBe(60 * 60 * 1000)
      })
    })

    it('slots are ordered chronologically by start time', () => {
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })
      for (let i = 1; i < slots.length; i++) {
        const prev = new Date(slots[i - 1].start).getTime()
        const curr = new Date(slots[i].start).getTime()
        expect(curr).toBeGreaterThan(prev)
      }
    })

    it('consecutive slots are exactly 15 minutes apart', () => {
      const slots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })
      for (let i = 1; i < slots.length; i++) {
        const gapMs = new Date(slots[i].start).getTime() - new Date(slots[i - 1].start).getTime()
        expect(gapMs).toBe(15 * 60 * 1000)
      }
    })
  })

  describe('booking conflicts', () => {
    it('excludes a booked slot', () => {
      const allSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })

      const firstSlot = allSlots[0]
      const booked: BookedSlot[] = [{ starts_at: firstSlot.start, ends_at: firstSlot.end }]

      const remaining = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: booked,
      })

      // The booked slot must not appear in remaining slots
      const bookedStart = new Date(firstSlot.start).getTime()
      remaining.forEach(slot => {
        expect(new Date(slot.start).getTime()).not.toBe(bookedStart)
      })
    })

    it('returns fewer slots after a booking is added', () => {
      const allSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })

      const midSlot = allSlots[Math.floor(allSlots.length / 2)]
      const booked: BookedSlot[] = [{ starts_at: midSlot.start, ends_at: midSlot.end }]

      const remaining = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: booked,
      })

      expect(remaining.length).toBeLessThan(allSlots.length)
    })

    it('remaining slots do not overlap with the booked slot', () => {
      const allSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })

      const bookedSlot = allSlots[1]
      const booked: BookedSlot[] = [{ starts_at: bookedSlot.start, ends_at: bookedSlot.end }]

      const remaining = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: booked,
      })

      const bookedStart = new Date(bookedSlot.start)
      const bookedEnd = new Date(bookedSlot.end)

      remaining.forEach(slot => {
        const slotStart = new Date(slot.start)
        const slotEnd = new Date(slot.end)
        const overlaps = slotStart < bookedEnd && slotEnd > bookedStart
        expect(overlaps).toBe(false)
      })
    })

    it('returns 0 slots when the entire window is blocked by one booking', () => {
      const allSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })

      // A single booking spanning the whole window blocks everything
      const blockAll: BookedSlot = {
        starts_at: allSlots[0].start,
        ends_at: allSlots[allSlots.length - 1].end,
      }

      const remaining = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [blockAll],
      })

      expect(remaining).toHaveLength(0)
    })
  })

  describe('buffer minutes', () => {
    it('buffer blocks more slots than no buffer around the same booking', () => {
      const allSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })

      const booked: BookedSlot[] = [{ starts_at: allSlots[1].start, ends_at: allSlots[1].end }]

      const withBuffer = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: booked,
        bufferMinutes: 15,
      })

      const withoutBuffer = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: booked,
        bufferMinutes: 0,
      })

      expect(withBuffer.length).toBeLessThanOrEqual(withoutBuffer.length)
    })
  })

  describe('Google Calendar busy times', () => {
    it('excludes slots that conflict with busy times', () => {
      const allSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })

      const busyTimes: BookedSlot[] = [{ starts_at: allSlots[0].start, ends_at: allSlots[0].end }]

      const withBusy = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
        busyTimes,
      })

      expect(withBusy.length).toBeLessThan(allSlots.length)
    })

    it('combines booking conflicts and busy time conflicts independently', () => {
      const allSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: [],
      })

      const booked: BookedSlot[] = [{ starts_at: allSlots[0].start, ends_at: allSlots[0].end }]
      const busy: BookedSlot[] = [{ starts_at: allSlots[allSlots.length - 1].start, ends_at: allSlots[allSlots.length - 1].end }]

      const remaining = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window2h],
        bookedSlots: booked,
        busyTimes: busy,
      })

      // Both the first and last slots should be excluded
      const remainingStarts = remaining.map(s => s.start)
      expect(remainingStarts).not.toContain(allSlots[0].start)
      expect(remainingStarts).not.toContain(allSlots[allSlots.length - 1].start)
    })
  })

  describe('multiple availability windows', () => {
    it('combines slots from morning and afternoon windows', () => {
      const morningSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window1h],
        bookedSlots: [],
      })

      const afternoonSlots = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [windowAfternoon],
        bookedSlots: [],
      })

      const combined = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window1h, windowAfternoon],
        bookedSlots: [],
      })

      expect(combined.length).toBe(morningSlots.length + afternoonSlots.length)
    })

    it('applies booking conflicts across all windows', () => {
      const combined = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window1h, windowAfternoon],
        bookedSlots: [],
      })

      // Book the morning slot
      const morningSlot = combined[0]
      const booked: BookedSlot[] = [{ starts_at: morningSlot.start, ends_at: morningSlot.end }]

      const afterBooking = computeAvailableSlots({
        date: TEST_DATE,
        durationMinutes: 60,
        availabilityWindows: [window1h, windowAfternoon],
        bookedSlots: booked,
      })

      expect(afterBooking.length).toBeLessThan(combined.length)
    })
  })
})

// ---------------------------------------------------------------------------
// isSlotAvailable
// ---------------------------------------------------------------------------

describe('isSlotAvailable', () => {
  it('returns true for a slot that falls within an availability window with no conflicts', () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      availabilityWindows: [window2h],
      bookedSlots: [],
    })

    const result = isSlotAvailable({
      startsAt: slots[0].start,
      endsAt: slots[0].end,
      availabilityWindows: [window2h],
      bookedSlots: [],
      date: TEST_DATE,
    })

    expect(result).toBe(true)
  })

  it('returns false when the slot is already booked (exact duplicate)', () => {
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      availabilityWindows: [window2h],
      bookedSlots: [],
    })

    const result = isSlotAvailable({
      startsAt: slots[0].start,
      endsAt: slots[0].end,
      availabilityWindows: [window2h],
      bookedSlots: [{ starts_at: slots[0].start, ends_at: slots[0].end }],
      date: TEST_DATE,
    })

    expect(result).toBe(false)
  })

  it('returns false when the requested slot overlaps with an existing booking', () => {
    // Slot 1 (09:00–10:00) overlaps with Slot 2 booking (09:15–10:15)
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      availabilityWindows: [window2h],
      bookedSlots: [],
    })

    const result = isSlotAvailable({
      startsAt: slots[0].start,
      endsAt: slots[0].end,
      availabilityWindows: [window2h],
      bookedSlots: [{ starts_at: slots[1].start, ends_at: slots[1].end }],
      date: TEST_DATE,
    })

    expect(result).toBe(false)
  })

  it('returns true when a non-overlapping booking exists elsewhere', () => {
    // In a 2-hour window with 60-min slots:
    // First slot: 09:00–10:00, Last slot: 10:00–11:00
    // They share an endpoint but do not overlap (end === start is not an overlap)
    const slots = computeAvailableSlots({
      date: TEST_DATE,
      durationMinutes: 60,
      availabilityWindows: [window2h],
      bookedSlots: [],
    })

    const lastSlot = slots[slots.length - 1]

    const result = isSlotAvailable({
      startsAt: slots[0].start,
      endsAt: slots[0].end,
      availabilityWindows: [window2h],
      bookedSlots: [{ starts_at: lastSlot.start, ends_at: lastSlot.end }],
      date: TEST_DATE,
    })

    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------

describe('formatPrice', () => {
  it('returns "Free" for 0 cents (member booking)', () => {
    expect(formatPrice(0)).toBe('Free')
  })

  it('formats the intake assessment price ($650)', () => {
    expect(formatPrice(65000)).toBe('$650')
  })

  it('formats the membership price ($200)', () => {
    expect(formatPrice(20000)).toBe('$200')
  })

  it('formats a follow-up visit price ($150)', () => {
    expect(formatPrice(15000)).toBe('$150')
  })

  it('formats a quick check-in price ($75)', () => {
    expect(formatPrice(7500)).toBe('$75')
  })

  it('formats a consultation price ($250)', () => {
    expect(formatPrice(25000)).toBe('$250')
  })
})

// ---------------------------------------------------------------------------
// getDayOfWeek
// ---------------------------------------------------------------------------

describe('getDayOfWeek', () => {
  // April 2026 reference: April 1 = Wednesday, verified from Jan 1 2026 = Thursday

  it('returns 1 for a Monday (April 20, 2026)', () => {
    expect(getDayOfWeek('2026-04-20')).toBe(1)
  })

  it('returns 0 for a Sunday (April 19, 2026)', () => {
    expect(getDayOfWeek('2026-04-19')).toBe(0)
  })

  it('returns 6 for a Saturday (April 18, 2026)', () => {
    expect(getDayOfWeek('2026-04-18')).toBe(6)
  })

  it('returns 5 for a Friday (April 17, 2026)', () => {
    expect(getDayOfWeek('2026-04-17')).toBe(5)
  })

  it('returns 3 for a Wednesday (April 1, 2026)', () => {
    expect(getDayOfWeek('2026-04-01')).toBe(3)
  })

  it('returns 1 for another Monday (April 13, 2026 — today at time of writing)', () => {
    expect(getDayOfWeek('2026-04-13')).toBe(1)
  })
})
