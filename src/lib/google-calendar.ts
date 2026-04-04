/**
 * Google Calendar Integration Layer
 *
 * Currently mocked for demo. Provides the real interface that will
 * be swapped for actual Google Calendar API + OAuth in Phase 2.
 *
 * Phase 2 TODO:
 * - Add Google OAuth credentials to .env.local
 * - Implement real getProviderBusyTimes using Google Calendar API freebusy query
 * - Implement real createCalendarEvent / cancelCalendarEvent
 * - Store provider's Google Calendar ID in providers table
 */

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  startTime: string // ISO
  endTime: string   // ISO
  attendees?: string[]
}

export interface BusyTime {
  starts_at: string
  ends_at: string
}

/**
 * Get busy times from the provider's Google Calendar.
 * Phase 2: Replace with real Google Calendar API freebusy query.
 */
export async function getProviderBusyTimes(
  _providerId: string,
  _startDate: string,
  _endDate: string
): Promise<BusyTime[]> {
  // Mock: return a few realistic busy blocks for demo
  // In production, this queries Google Calendar API:
  // calendar.freebusy.query({ timeMin, timeMax, items: [{ id: calendarId }] })
  return []
}

/**
 * Create a Google Calendar event when an appointment is booked.
 * Phase 2: Replace with real Google Calendar API event creation.
 */
export async function createCalendarEvent(event: {
  providerId: string
  summary: string
  description: string
  startTime: string
  endTime: string
  patientEmail?: string
}): Promise<string> {
  // Mock: generate a fake event ID and log
  const eventId = `gcal_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  console.log(`[Google Calendar Mock] Event created:`, {
    id: eventId,
    summary: event.summary,
    start: event.startTime,
    end: event.endTime,
  })
  return eventId
}

/**
 * Cancel/delete a Google Calendar event.
 * Phase 2: Replace with real Google Calendar API event deletion.
 */
export async function cancelCalendarEvent(
  _providerId: string,
  eventId: string
): Promise<void> {
  console.log(`[Google Calendar Mock] Event canceled: ${eventId}`)
}

/**
 * Check if Google Calendar is connected for a provider.
 * Phase 2: Check for valid OAuth tokens.
 */
export function isGoogleCalendarConnected(_providerId: string): boolean {
  // Mock: always return true for demo
  return true
}
