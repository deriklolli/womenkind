import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Lazy-init: don't create at module scope (breaks Vercel build when env vars missing)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * POST /api/intake/save
 * Saves intake answers in real-time (auto-save as user progresses)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { intakeId, patientId, answers, currentSection } = await req.json()

    if (!intakeId) {
      // Create a new intake record (draft)
      const { data, error } = await supabase
        .from('intakes')
        .insert({
          status: 'draft',
          answers,
          started_at: new Date().toISOString(),
          ...(patientId ? { patient_id: patientId } : {}),
        })
        .select('id')
        .single()

      if (error) throw error
      return NextResponse.json({ intakeId: data.id })
    }

    // Update existing intake
    const { error } = await supabase
      .from('intakes')
      .update({
        answers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intakeId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Intake save error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
