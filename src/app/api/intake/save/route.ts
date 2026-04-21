import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { intakes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/intake/save
 * Saves intake answers in real-time (auto-save as user progresses)
 */
export async function POST(req: NextRequest) {
  try {
    const { intakeId, patientId, answers, currentSection } = await req.json()

    if (!intakeId) {
      // Create a new intake record (draft)
      const [row] = await db
        .insert(intakes)
        .values({
          status: 'draft',
          answers,
          started_at: new Date(),
          ...(patientId ? { patient_id: patientId } : {}),
        })
        .returning({ id: intakes.id })

      return NextResponse.json({ intakeId: row.id })
    }

    // Update existing intake
    await db
      .update(intakes)
      .set({ answers })
      .where(eq(intakes.id, intakeId))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Intake save error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
