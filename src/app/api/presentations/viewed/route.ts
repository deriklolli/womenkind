import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { care_presentations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * PATCH /api/presentations/viewed
 * Marks a care presentation as viewed.
 * Body: { presentationId: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { presentationId } = await req.json()

    if (!presentationId) {
      return NextResponse.json({ error: 'presentationId is required' }, { status: 400 })
    }

    await db
      .update(care_presentations)
      .set({ status: 'viewed', viewed_at: new Date() })
      .where(eq(care_presentations.id, presentationId))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Failed to mark presentation viewed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
