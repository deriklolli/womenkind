import { db } from '@/lib/db'
import { phi_access_log } from '@/lib/db/schema'
import { NextRequest } from 'next/server'

export type PhiRecordType =
  | 'encounter_note' | 'patient_profile' | 'appointment'
  | 'message' | 'prescription' | 'lab_result' | 'intake'

export type PhiAction =
  | 'create' | 'read' | 'update' | 'delete' | 'sign' | 'export' | 'transcribe'

export interface PhiAuditParams {
  providerId?: string | null
  patientId?: string | null
  recordType: PhiRecordType
  recordId?: string | null
  action: PhiAction
  route: string
  req?: NextRequest
}

export function logPhiAccess(params: PhiAuditParams): void {
  const { providerId, patientId, recordType, recordId, action, route, req } = params

  ;(async () => {
    try {
      const ipAddress = req
        ? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null
        : null
      const userAgent = req ? req.headers.get('user-agent') : null

      await db.insert(phi_access_log).values({
        provider_id: providerId ?? null,
        patient_id:  patientId  ?? null,
        record_type: recordType,
        record_id:   recordId   ?? null,
        action,
        api_route:   route,
        ip_address:  ipAddress,
        user_agent:  userAgent,
      })
    } catch (err) {
      console.error('[phi-audit] Failed to write audit log:', err)
    }
  })()
}
