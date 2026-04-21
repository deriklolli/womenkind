import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getServerSession } from '@/lib/getServerSession'

// GET /api/notifications?patientId=...
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const patientId = req.nextUrl.searchParams.get('patientId')
    if (!patientId) {
      return NextResponse.json({ error: 'patientId required' }, { status: 400 })
    }

    // Patients can only read their own notifications; providers can read any
    if (session.role === 'patient' && session.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.patient_id, patientId),
        eq(notifications.dismissed, false),
      ))
      .orderBy(desc(notifications.created_at))
      .limit(20)

    return NextResponse.json({ notifications: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/notifications  — body: { id, is_read?, dismissed? } or { patientId, markAllRead: true }
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // Bulk mark all read
    if (body.patientId && body.markAllRead) {
      // Patients can only update their own notifications
      if (session.role === 'patient' && session.patientId !== body.patientId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      await db
        .update(notifications)
        .set({ is_read: true })
        .where(and(
          eq(notifications.patient_id, body.patientId),
          eq(notifications.is_read, false),
          eq(notifications.dismissed, false),
        ))

      return NextResponse.json({ success: true })
    }

    // Single notification update
    if (!body.id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const updates: Partial<{ is_read: boolean; dismissed: boolean }> = {}
    if (typeof body.is_read === 'boolean') updates.is_read = body.is_read
    if (typeof body.dismissed === 'boolean') updates.dismissed = body.dismissed

    if (session.role === 'patient') {
      await db.update(notifications)
        .set(updates)
        .where(and(eq(notifications.id, body.id), eq(notifications.patient_id, session.patientId!)))
    } else {
      await db.update(notifications)
        .set(updates)
        .where(eq(notifications.id, body.id))
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
