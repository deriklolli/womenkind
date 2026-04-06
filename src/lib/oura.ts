import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from './encryption'

// ── Supabase (service role) ──────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Types ────────────────────────────────────────────────────────────

interface OuraTokenResponse {
  access_token: string
  expires_in: number
  refresh_token: string
  token_type: string
}

export interface WearableConnection {
  id: string
  patient_id: string
  provider: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: string
  device_user_id: string | null
  connected_at: string
  last_synced_at: string | null
  is_active: boolean
}

export interface NormalizedMetric {
  metric_type: string
  metric_date: string
  value: number
  raw_payload?: Record<string, any>
}

// Metric types we extract from Oura
export const OURA_METRIC_TYPES = [
  'sleep_score',
  'sleep_deep_minutes',
  'sleep_rem_minutes',
  'sleep_light_minutes',
  'sleep_total_minutes',
  'sleep_efficiency',
  'temperature_deviation',
  'temperature_trend_deviation',
  'hrv_average',
  'resting_heart_rate',
] as const

export type OuraMetricType = (typeof OURA_METRIC_TYPES)[number]

// ── OAuth Helpers ────────────────────────────────────────────────────

/** Build the Oura OAuth consent URL. */
export function buildOuraOAuthUrl(state: string): string {
  const clientId = process.env.OURA_CLIENT_ID
  if (!clientId) throw new Error('OURA_CLIENT_ID is not set')

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  const redirectUri = `${appUrl}/api/auth/oura/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'daily heartrate personal',
    state,
  })
  return `https://cloud.ouraring.com/oauth/authorize?${params}`
}

/** Exchange an authorization code for tokens. */
export async function exchangeOuraCode(code: string): Promise<OuraTokenResponse> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  const redirectUri = `${appUrl}/api/auth/oura/callback`

  const res = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Oura token exchange failed: ${res.status} — ${text}`)
  }
  return res.json()
}

/** Refresh an expired Oura access token. */
async function refreshOuraToken(refreshTokenEncrypted: string): Promise<OuraTokenResponse> {
  const res = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
      refresh_token: decrypt(refreshTokenEncrypted),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Oura token refresh failed: ${res.status} — ${text}`)
  }
  return res.json()
}

/** Get a valid Oura access token, auto-refreshing if expired (5-min buffer). */
export async function getValidOuraToken(connectionId: string): Promise<string> {
  const supabase = getSupabase()

  const { data: conn, error } = await supabase
    .from('patient_wearable_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('is_active', true)
    .single()

  if (error || !conn) throw new Error('No active Oura connection found')

  // If token is still valid (with 5-minute buffer), return it
  if (new Date(conn.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return decrypt(conn.access_token_encrypted)
  }

  // Refresh the token
  const tokens = await refreshOuraToken(conn.refresh_token_encrypted)

  // Update stored tokens
  await supabase
    .from('patient_wearable_connections')
    .update({
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id)

  return tokens.access_token
}

// ── Connection Management ────────────────────────────────────────────

/** Save a new Oura connection for a patient. */
export async function saveOuraConnection(
  patientId: string,
  tokens: OuraTokenResponse
): Promise<string> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('patient_wearable_connections')
    .upsert({
      patient_id: patientId,
      provider: 'oura',
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      is_active: true,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'patient_id,provider' })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/** Check if a patient has an active Oura connection. */
export async function getOuraConnection(patientId: string): Promise<WearableConnection | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('patient_wearable_connections')
    .select('*')
    .eq('patient_id', patientId)
    .eq('provider', 'oura')
    .eq('is_active', true)
    .maybeSingle()
  return data
}

/** Disconnect a patient's Oura ring. */
export async function disconnectOura(patientId: string): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('patient_wearable_connections')
    .update({
      is_active: false,
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      updated_at: new Date().toISOString(),
    })
    .eq('patient_id', patientId)
    .eq('provider', 'oura')
}

// ── Data Fetching & Normalization ────────────────────────────────────

/** Fetch daily sleep data from Oura API. */
async function fetchOuraSleep(accessToken: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const res = await fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Oura sleep fetch failed: ${res.status} — ${text}`)
  }
  return res.json()
}

/** Fetch daily readiness data from Oura API (includes temperature). */
async function fetchOuraReadiness(accessToken: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const res = await fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Oura readiness fetch failed: ${res.status} — ${text}`)
  }
  return res.json()
}

/** Normalize Oura API responses into flat metric rows. */
export function normalizeOuraData(
  sleepData: { data: any[] },
  readinessData: { data: any[] }
): NormalizedMetric[] {
  const metrics: NormalizedMetric[] = []

  // Process sleep data
  for (const day of sleepData.data || []) {
    const date = day.day
    if (!date) continue

    if (day.score != null) {
      metrics.push({ metric_type: 'sleep_score', metric_date: date, value: day.score })
    }
    if (day.deep_sleep_duration != null) {
      metrics.push({ metric_type: 'sleep_deep_minutes', metric_date: date, value: Math.round(day.deep_sleep_duration / 60) })
    }
    if (day.rem_sleep_duration != null) {
      metrics.push({ metric_type: 'sleep_rem_minutes', metric_date: date, value: Math.round(day.rem_sleep_duration / 60) })
    }
    if (day.light_sleep_duration != null) {
      metrics.push({ metric_type: 'sleep_light_minutes', metric_date: date, value: Math.round(day.light_sleep_duration / 60) })
    }
    if (day.total_sleep_duration != null) {
      metrics.push({ metric_type: 'sleep_total_minutes', metric_date: date, value: Math.round(day.total_sleep_duration / 60) })
    }
    if (day.contributors?.efficiency != null) {
      metrics.push({ metric_type: 'sleep_efficiency', metric_date: date, value: day.contributors.efficiency })
    }
    if (day.average_hrv != null) {
      metrics.push({ metric_type: 'hrv_average', metric_date: date, value: day.average_hrv })
    }
    if (day.lowest_heart_rate != null) {
      metrics.push({ metric_type: 'resting_heart_rate', metric_date: date, value: day.lowest_heart_rate })
    }
  }

  // Process readiness data (temperature)
  for (const day of readinessData.data || []) {
    const date = day.day
    if (!date) continue

    if (day.temperature_deviation != null) {
      metrics.push({ metric_type: 'temperature_deviation', metric_date: date, value: day.temperature_deviation })
    }
    if (day.temperature_trend_deviation != null) {
      metrics.push({ metric_type: 'temperature_trend_deviation', metric_date: date, value: day.temperature_trend_deviation })
    }
  }

  return metrics
}

/** Sync Oura data for a patient connection. Returns number of metrics synced. */
export async function syncOuraData(
  connectionId: string,
  patientId: string,
  days: number = 7
): Promise<{ synced: number; status: string }> {
  const supabase = getSupabase()

  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  try {
    const accessToken = await getValidOuraToken(connectionId)

    // Fetch from both endpoints
    const [sleepData, readinessData] = await Promise.all([
      fetchOuraSleep(accessToken, startDate, endDate),
      fetchOuraReadiness(accessToken, startDate, endDate),
    ])

    // Normalize into flat metrics
    const metrics = normalizeOuraData(sleepData, readinessData)

    if (metrics.length > 0) {
      // Upsert all metrics (on conflict: patient_id + metric_date + metric_type)
      const rows = metrics.map(m => ({
        patient_id: patientId,
        connection_id: connectionId,
        metric_date: m.metric_date,
        metric_type: m.metric_type,
        value: m.value,
        synced_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('wearable_metrics')
        .upsert(rows, { onConflict: 'patient_id,metric_date,metric_type' })

      if (error) throw error
    }

    // Update last_synced_at
    await supabase
      .from('patient_wearable_connections')
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', connectionId)

    // Log success
    await supabase.from('wearable_sync_log').insert({
      connection_id: connectionId,
      records_fetched: metrics.length,
      status: 'success',
    })

    return { synced: metrics.length, status: 'success' }
  } catch (err: any) {
    // Log error
    await supabase.from('wearable_sync_log').insert({
      connection_id: connectionId,
      records_fetched: 0,
      status: 'error',
      error_message: err.message,
    })

    return { synced: 0, status: 'error' }
  }
}
