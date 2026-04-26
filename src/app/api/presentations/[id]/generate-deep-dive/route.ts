import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { populateDeepDives } from '@/lib/populate-deep-dives'

export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'provider') {
      return NextResponse.json({ error: 'Forbidden — provider only' }, { status: 403 })
    }

    const result = await populateDeepDives(params.id)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err: unknown) {
    console.error('POST generate-deep-dive error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err), generated: [] },
      { status: 500 }
    )
  }
}
