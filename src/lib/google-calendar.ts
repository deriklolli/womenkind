import { db } from '@/lib/db'
import { provider_calendar_connections, calendar_event_logs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt } from './encryption'

// ── Types ────────────────────────────────────────────────────────────
export interface BusyTime {
  starts_at: string // ISO datetime  (matches scheduling.ts interface)
  ends_at: string   // ISO datetime
}

export interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  startTime: string // ISO datetime
  endTime: string   // ISO datetime
  attendees?: string[]
  timeZone?: string
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  token_type: string
}

// ── OAuth Helpers ────────────────────────────────────────────────────

/** Build the Google OAuth consent URL for a provider to connect their calendar. */
export function buildOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!clientId) throw new Error('GOOGLE_OAUTH_CLIENT_ID is not set')
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set')

  // Strip trailing slash to avoid double-slash in redirect URI
  const baseUrl = appUrl.replace(/\/+$/, '')
  const redirectUri = `${baseUrl}/api/auth/google/callback`

  console.log('[OAuth] Building consent URL:', {
    clientId: clientId.substring(0, 12) + '...',
    redirectUri,
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** Exchange an authorization code for tokens. */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  const redirectUri = `${baseUrl}/api/auth/google/callback`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${res.status} — ${text}`)
  }
  return res.json()
}

/** Refresh an expired access token. */
async function refreshAccessToken(refreshTokenEncrypted: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: decrypt(refreshTokenEncrypted),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${res.status} — ${text}`)
  }
  return res.json()
}

/** Get a valid access token for a provider, auto-refreshing if expired. */
export async function getValidAccessToken(providerId: string): Promise<string> {
  const conn = await db.query.provider_calendar_connections.findFirst({
    where: and(
      eq(provider_calendar_connections.provider_id, providerId),
      eq(provider_calendar_connections.is_active, true)
    ),
  })

  if (!conn) throw new Error('No active calendar connection for this provider')

  // If token is still valid (with 5-minute buffer), return it
  if (new Date(conn.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return decrypt(conn.access_token_encrypted)
  }

  // Refresh the token
  const tokens = await refreshAccessToken(conn.refresh_token_encrypted)

  // Update stored tokens
  await db
    .update(provider_calendar_connections)
    .set({
      access_token_encrypted: encrypt(tokens.access_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
      updated_at: new Date(),
    })
    .where(eq(provider_calendar_connections.id, conn.id))

  return tokens.access_token
}

/** Get the Google email from a token. */
export async function getGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to get Google user info')
  const data = await res.json()
  return data.email
}

// ── Calendar API ─────────────────────────────────────────────────────

/** Save a new calendar connection for a provider. */
export async function saveCalendarConnection(
  providerId: string,
  tokens: TokenResponse,
  googleEmail: string,
  timezone: string = 'America/Denver'
) {
  await db
    .insert(provider_calendar_connections)
    .values({
      provider_id: providerId,
      google_email: googleEmail,
      google_calendar_id: 'primary',
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token!),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
      timezone,
      is_active: true,
      synced_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: provider_calendar_connections.provider_id,
      set: {
        google_email: googleEmail,
        google_calendar_id: 'primary',
        access_token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: encrypt(tokens.refresh_token!),
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        timezone,
        is_active: true,
        synced_at: new Date(),
        updated_at: new Date(),
      },
    })
}

/** Check if Google Calendar is connected for a provider. */
export async function isGoogleCalendarConnected(providerId: string): Promise<boolean> {
  const conn = await db.query.provider_calendar_connections.findFirst({
    where: and(
      eq(provider_calendar_connections.provider_id, providerId),
      eq(provider_calendar_connections.is_active, true)
    ),
    columns: { id: true },
  })
  return !!conn
}

/** Get connection info (non-sensitive) for display. */
export async function getCalendarConnectionInfo(providerId: string) {
  const conn = await db.query.provider_calendar_connections.findFirst({
    where: and(
      eq(provider_calendar_connections.provider_id, providerId),
      eq(provider_calendar_connections.is_active, true)
    ),
    columns: {
      google_email: true,
      timezone: true,
      synced_at: true,
      is_active: true,
      created_at: true,
    },
  })
  return conn ?? null
}

/** Fetch busy times from a provider's Google Calendar. */
export async function getProviderBusyTimes(
  providerId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
  timezone: string = 'America/Denver'
): Promise<BusyTime[]> {
  let accessToken: string
  try {
    accessToken = await getValidAccessToken(providerId)
  } catch {
    return [] // No calendar connected — graceful degradation
  }

  const conn = await db.query.provider_calendar_connections.findFirst({
    where: and(
      eq(provider_calendar_connections.provider_id, providerId),
      eq(provider_calendar_connections.is_active, true)
    ),
    columns: { google_calendar_id: true },
  })

  const calendarId = conn?.google_calendar_id || 'primary'

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: `${startDate}T00:00:00Z`,
      timeMax: `${endDate}T23:59:59Z`,
      timeZone: timezone,
      items: [{ id: calendarId }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('Google Calendar freeBusy error:', text)
    await db.insert(calendar_event_logs).values({
      provider_id: providerId,
      action: 'sync_error',
      error_message: `freeBusy failed: ${res.status} — ${text}`,
    })
    return []
  }

  const data = await res.json()
  const busySlots = data.calendars?.[calendarId]?.busy || []

  await db
    .update(provider_calendar_connections)
    .set({ synced_at: new Date() })
    .where(eq(provider_calendar_connections.provider_id, providerId))

  return busySlots.map((slot: { start: string; end: string }) => ({
    starts_at: slot.start,
    ends_at: slot.end,
  }))
}

/** Create an event on a provider's Google Calendar. Returns the Google event ID. */
export async function createCalendarEvent(event: {
  providerId: string
  summary: string
  description: string
  startTime: string
  endTime: string
  patientEmail?: string
}): Promise<string> {
  let accessToken: string
  try {
    accessToken = await getValidAccessToken(event.providerId)
  } catch {
    // No calendar connected — return a local-only ID
    console.warn('No Google Calendar connected, skipping event creation')
    return `local_${Date.now()}`
  }

  const conn = await db.query.provider_calendar_connections.findFirst({
    where: and(
      eq(provider_calendar_connections.provider_id, event.providerId),
      eq(provider_calendar_connections.is_active, true)
    ),
    columns: { google_calendar_id: true, timezone: true },
  })

  const calendarId = conn?.google_calendar_id || 'primary'
  const tz = conn?.timezone || 'America/Denver'

  const googleEvent = {
    summary: event.summary,
    description: event.description || '',
    start: { dateTime: event.startTime, timeZone: tz },
    end: { dateTime: event.endTime, timeZone: tz },
    attendees: event.patientEmail ? [{ email: event.patientEmail }] : [],
    reminders: { useDefault: true },
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEvent),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    console.error('Google Calendar create event error:', text)
    await db.insert(calendar_event_logs).values({
      provider_id: event.providerId,
      action: 'sync_error',
      error_message: `create failed: ${res.status} — ${text}`,
    })
    return `local_${Date.now()}`
  }

  const created = await res.json()

  await db.insert(calendar_event_logs).values({
    provider_id: event.providerId,
    google_event_id: created.id,
    action: 'created',
  })

  return created.id
}

/** Cancel/delete a Google Calendar event. */
export async function cancelCalendarEvent(
  providerId: string,
  googleEventId: string
): Promise<void> {
  if (googleEventId.startsWith('local_')) return // Not a real Google event

  let accessToken: string
  try {
    accessToken = await getValidAccessToken(providerId)
  } catch {
    return // Can't cancel if no connection
  }

  const conn = await db.query.provider_calendar_connections.findFirst({
    where: and(
      eq(provider_calendar_connections.provider_id, providerId),
      eq(provider_calendar_connections.is_active, true)
    ),
    columns: { google_calendar_id: true },
  })

  const calendarId = conn?.google_calendar_id || 'primary'

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (res.ok || res.status === 410) {
    await db.insert(calendar_event_logs).values({
      provider_id: providerId,
      google_event_id: googleEventId,
      action: 'deleted',
    })
  } else {
    const text = await res.text()
    console.error('Google Calendar delete error:', text)
    await db.insert(calendar_event_logs).values({
      provider_id: providerId,
      google_event_id: googleEventId,
      action: 'sync_error',
      error_message: `delete failed: ${res.status} — ${text}`,
    })
  }
}

/** Disconnect a provider's Google Calendar. */
export async function disconnectCalendar(providerId: string): Promise<void> {
  try {
    const accessToken = await getValidAccessToken(providerId)
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  } catch {
    // Token may already be invalid — fine
  }

  await db
    .update(provider_calendar_connections)
    .set({ is_active: false, updated_at: new Date() })
    .where(eq(provider_calendar_connections.provider_id, providerId))
}
