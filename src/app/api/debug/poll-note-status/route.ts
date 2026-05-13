import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encounter_notes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/debug/poll-note-status?noteId=<uuid>
 *
 * Returns the current state of an encounter note for pipeline monitoring.
 */
export async function GET(req: NextRequest) {
  const noteId = req.nextUrl.searchParams.get('noteId')
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  const note = await db.query.encounter_notes.findFirst({
    where: eq(encounter_notes.id, noteId),
    columns: {
      id: true,
      status: true,
      assemblyai_transcript_id: true,
      transcript: true,
      chief_complaint: true,
      hpi: true,
      ros: true,
      assessment: true,
      plan: true,
      recording_url: true,
      created_at: true,
      updated_at: true,
    },
  })
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  return NextResponse.json({
    id: note.id,
    status: note.status,
    assemblyai_transcript_id: note.assemblyai_transcript_id,
    transcript_chars: note.transcript?.length ?? 0,
    soap_complete: !!(note.chief_complaint && note.hpi && note.ros && note.assessment && note.plan),
    recording_url_cleared: note.recording_url === null,
    chief_complaint_preview: note.chief_complaint?.slice(0, 150) ?? null,
    plan_preview: note.plan?.slice(0, 150) ?? null,
    created_at: note.created_at,
    updated_at: note.updated_at,
  })
}
