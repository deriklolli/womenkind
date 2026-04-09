import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export type PhiRecordType =
  | 'encounter_note'
  | 'patient_profile'
  | 'appointment'
  | 'message'
  | 'prescription'
  | 'lab_result'
  | 'intake'

export type PhiAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'sign'
  | 'export'
  | 'transcribe'

export interface PhiAuditParams {
  providerId?: string | null
  patientId?: string | null
  recordType: PhiRecordType
  recordId?: string | null
  action: PhiAction
  route: string
  req?: NextRequest
}

/**
 * logPhiAccess — fire-and-forget PHI audit logger.
 *
 * Always uses the service role so it works from any server context.
 * Never throws — a logging failure must never break the actual request.
 *
 * Usage:
 *   logPhiAccess({ providerId, patientId, recordType: 'encounter_note', recordId: note.id, action: 'create', route: '/api/visits/ambient-recording', req })
 */
export function logPhiAccess(params: PhiAuditParams): void {
  const { providerId, patientId, recordType, recordId, action, route, req } = params

  // Fire and forget — intentionally not awaited
  ;(async () => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const ipAddress = req
        ? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          req.headers.get('x-real-ip') ??
          null
        : null

      const userAgent = req ? req.headers.get('user-agent') : null

      await supabase.from('phi_access_log').insert({
        provider_id:  providerId  ?? null,
        patient_id:   patientId   ?? null,
        record_type:  recordType,
        record_id:    recordId    ?? null,
        action,
        api_route:    route,
        ip_address:   ipAddress,
        user_agent:   userAgent,
      })
    } catch (err) {
      // Never let audit logging break the request
      console.error('[phi-audit] Failed to write audit log:', err)
    }
  })()
}
