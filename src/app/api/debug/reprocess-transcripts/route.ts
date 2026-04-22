import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encounter_notes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/debug/reprocess-transcripts
 *
 * Finds stuck 'transcribing' encounter notes and re-fires the transcription
 * webhook handler inline. Use when the AssemblyAI webhook failed (e.g. 401
 * because WEBHOOK_SECRET wasn't set).
 */
export async function POST(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com').replace(/\/+$/, '')
  const assemblyKey = process.env.ASSEMBLYAI_API_KEY
  if (!assemblyKey) return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not set' }, { status: 500 })

  // Find all notes stuck in 'transcribing' with an assemblyai_transcript_id
  const stuck = await db.query.encounter_notes.findMany({
    where: eq(encounter_notes.status, 'transcribing'),
    columns: { id: true, assemblyai_transcript_id: true },
  })

  if (stuck.length === 0) return NextResponse.json({ message: 'No stuck transcripts found' })

  const results: { noteId: string; transcriptId: string | null; status: string }[] = []

  for (const note of stuck) {
    if (!note.assemblyai_transcript_id) {
      results.push({ noteId: note.id, transcriptId: null, status: 'no_transcript_id' })
      continue
    }

    // Check status with AssemblyAI
    const res = await fetch(`https://api.assemblyai.com/v2/transcript/${note.assemblyai_transcript_id}`, {
      headers: { Authorization: assemblyKey },
    })
    const data = await res.json()
    const transcriptStatus: string = data.status

    results.push({ noteId: note.id, transcriptId: note.assemblyai_transcript_id, status: transcriptStatus })

    if (transcriptStatus === 'completed') {
      await fetch(`${appUrl}/api/visits/webhook/transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.WEBHOOK_SECRET ? { 'x-webhook-secret': process.env.WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify({ transcript_id: note.assemblyai_transcript_id, status: 'completed' }),
      })
    }
  }

  return NextResponse.json({ processed: results })
}
