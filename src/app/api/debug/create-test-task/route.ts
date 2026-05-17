import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, providers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createTask } from '@/lib/taskEngine'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const firstPatient = await db.query.patients.findFirst({
    columns: { id: true, profile_id: true },
  })
  if (!firstPatient) return NextResponse.json({ error: 'No patients found' }, { status: 404 })

  const firstProvider = await db.query.providers.findFirst({
    columns: { id: true },
  })
  if (!firstProvider) return NextResponse.json({ error: 'No providers found' }, { status: 404 })

  const taskId = await createTask({
    patient_id: firstPatient.id,
    title: 'Build 16 smoke test — red clinical task',
    body: 'Created via debug endpoint to verify task engine is wired up correctly.',
    category: 'clinical',
    priority: 'red',
    source: 'manual',
    owner_staff_id: firstProvider.id,
    backup_owner_staff_id: firstProvider.id,
    requires_md_signoff: false,
  })

  return NextResponse.json({
    ok: true,
    taskId,
    patientId: firstPatient.id,
    providerId: firstProvider.id,
  })
}
