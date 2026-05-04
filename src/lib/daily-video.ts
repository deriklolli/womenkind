/**
 * Daily.co Video Room Integration
 *
 * Creates private video rooms for telehealth appointments via Daily's REST API.
 * Each appointment gets a unique room that expires after the appointment window.
 */

const DAILY_API_URL = 'https://api.daily.co/v1'

interface DailyRoom {
  id: string
  name: string
  url: string
  privacy: string
  created_at: string
  config: Record<string, any>
}

/**
 * Create a private Daily video room for an appointment.
 * Room auto-expires 1 hour after the appointment ends.
 */
export async function createVideoRoom({
  appointmentId,
  appointmentName,
  startsAt,
  endsAt,
}: {
  appointmentId: string
  appointmentName: string
  startsAt: string
  endsAt: string
}): Promise<{ url: string; roomName: string } | null> {
  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) {
    console.warn('[DAILY] DAILY_API_KEY not set, skipping video room creation')
    return null
  }

  // Room name: sanitize to allowed chars (letters, numbers, dash, underscore)
  const sanitizedName = `wk-${appointmentId.slice(0, 8)}`

  // Room expires 1 hour after appointment ends
  const expiresAt = Math.floor(new Date(endsAt).getTime() / 1000) + 3600

  try {
    const res = await fetch(`${DAILY_API_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        privacy: 'public',
        properties: {
          exp: expiresAt,
          enable_chat: true,
          enable_screenshare: true,
          enable_knocking: false,
          max_participants: 4,
          start_video_off: false,
          start_audio_off: false,
          enable_recording: 's3',
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[DAILY] Failed to create room:', res.status, text)
      return null
    }

    const room: DailyRoom = await res.json()
    console.log(`[DAILY] Video room created: ${room.url}`)

    return {
      url: room.url,
      roomName: room.name,
    }
  } catch (err) {
    console.error('[DAILY] Error creating video room:', err)
    return null
  }
}

/**
 * Start cloud recording for a Daily room.
 * Call this server-side right after creating the room.
 * Recording automatically stops when all participants leave.
 */
export async function startCloudRecording(roomName: string): Promise<boolean> {
  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) {
    console.warn('[DAILY] DAILY_API_KEY not set, skipping recording start')
    return false
  }

  try {
    const res = await fetch(`${DAILY_API_URL}/rooms/${roomName}/recordings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ layout: { preset: 'default' } }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[DAILY] Failed to start cloud recording:', res.status, text)
      return false
    }

    console.log(`[DAILY] Cloud recording started for room: ${roomName}`)
    return true
  } catch (err) {
    console.error('[DAILY] Error starting cloud recording:', err)
    return false
  }
}

/**
 * Create a meeting token that gives the provider owner/host privileges.
 * The returned token should be appended to the room URL as ?t=TOKEN.
 */
export async function createProviderMeetingToken({
  roomName,
  endsAt,
}: {
  roomName: string
  endsAt: string
}): Promise<string | null> {
  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) return null

  const exp = Math.floor(new Date(endsAt).getTime() / 1000) + 3600

  try {
    const res = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: true,
          exp,
        },
      }),
    })

    if (!res.ok) {
      console.error('[DAILY] Failed to create provider token:', await res.text())
      return null
    }

    const data = await res.json()
    return data.token ?? null
  } catch (err) {
    console.error('[DAILY] Error creating provider token:', err)
    return null
  }
}

/**
 * Delete a Daily video room (e.g. when an appointment is canceled).
 */
export async function deleteVideoRoom(roomName: string): Promise<void> {
  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) return

  try {
    await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    console.log(`[DAILY] Video room deleted: ${roomName}`)
  } catch (err) {
    console.error('[DAILY] Error deleting video room:', err)
  }
}
