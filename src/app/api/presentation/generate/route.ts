import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const {
      patientId,
      providerId,
      selectedComponents,
      componentNotes,
      welcomeMessage,
      closingMessage,
    } = await req.json()

    if (!patientId || !providerId || !selectedComponents?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the latest intake for this patient (optional link)
    const { data: latestIntake } = await supabaseAdmin
      .from('intakes')
      .select('id')
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()

    // Create the presentation record
    const { data: presentation, error } = await supabaseAdmin
      .from('care_presentations')
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        intake_id: latestIntake?.id || null,
        selected_components: selectedComponents,
        component_notes: componentNotes,
        welcome_message: welcomeMessage,
        closing_message: closingMessage,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    // Mock email delivery — in production this would call Resend
    const presentationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/presentation/${presentation.id}`
    console.log(`[MOCK EMAIL] Care presentation ready for patient ${patientId}`)
    console.log(`[MOCK EMAIL] Presentation URL: ${presentationUrl}`)
    console.log(`[MOCK EMAIL] Selected components: ${selectedComponents.join(', ')}`)

    return NextResponse.json({
      id: presentation.id,
      url: presentationUrl,
      status: 'sent',
      emailMocked: true,
    })
  } catch (err) {
    console.error('Generate presentation error:', err)
    return NextResponse.json({ error: 'Failed to generate presentation' }, { status: 500 })
  }
}
