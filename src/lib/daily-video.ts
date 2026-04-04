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
        name: sanitizedName,
        privacy: 'private',
        properties: {
          exp: expiresAt,
          enable_chat: true,
          enable_screenshare: true,
          enable_knocking: true,
          max_participants: 4,
          start_video_off: false,
          start_audio_off: false,
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
