import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_PATIENT_ID = 'c0000000-0000-0000-0000-000000000001'

/**
 * POST /api/seed-labs
 *
 * Seeds a realistic Hormone Panel lab order with results for the demo patient (Sarah).
 * Values are clinically plausible for a perimenopausal woman — FSH elevated,
 * estradiol low, progesterone low, testosterone borderline.
 */
export async function POST() {
  // Check for existing seeded lab order to avoid duplicates
  const { data: existing } = await supabase
    .from('lab_orders')
    .select('id')
    .eq('patient_id', DEMO_PATIENT_ID)
    .eq('status', 'results_available')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: 'Lab results already seeded', id: existing[0].id })
  }

  const now = new Date()
  const orderedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago

  const labOrder = {
    patient_id: DEMO_PATIENT_ID,
    provider_id: null,
    visit_id: null,
    canvas_order_id: `mock-canvas-lab-${Date.now().toString(36)}`,
    lab_partner: 'quest',
    tests: [
      { code: 'FSH', name: 'Follicle-Stimulating Hormone' },
      { code: 'LH', name: 'Luteinizing Hormone' },
      { code: 'E2', name: 'Estradiol' },
      { code: 'TESTO', name: 'Total Testosterone' },
      { code: 'PROG', name: 'Progesterone' },
      { code: 'TSH', name: 'Thyroid-Stimulating Hormone' },
    ],
    clinical_indication: 'Menopausal status evaluation — perimenopausal symptoms including hot flashes, night sweats, irregular cycles',
    status: 'results_available',
    results: [
      {
        testCode: 'FSH',
        testName: 'Follicle-Stimulating Hormone',
        value: '48.2',
        unit: 'mIU/mL',
        referenceRange: '3.5-12.5 mIU/mL',
        flag: 'high',
      },
      {
        testCode: 'LH',
        testName: 'Luteinizing Hormone',
        value: '32.1',
        unit: 'mIU/mL',
        referenceRange: '2.4-12.6 mIU/mL',
        flag: 'high',
      },
      {
        testCode: 'E2',
        testName: 'Estradiol',
        value: '18',
        unit: 'pg/mL',
        referenceRange: '30-400 pg/mL',
        flag: 'low',
      },
      {
        testCode: 'TESTO',
        testName: 'Total Testosterone',
        value: '22',
        unit: 'ng/dL',
        referenceRange: '15-70 ng/dL',
        flag: 'normal',
      },
      {
        testCode: 'PROG',
        testName: 'Progesterone',
        value: '0.3',
        unit: 'ng/mL',
        referenceRange: '0.1-25 ng/mL',
        flag: 'normal',
      },
      {
        testCode: 'TSH',
        testName: 'Thyroid-Stimulating Hormone',
        value: '2.8',
        unit: 'mIU/L',
        referenceRange: '0.4-4.0 mIU/L',
        flag: 'normal',
      },
    ],
    ordered_at: orderedAt.toISOString(),
  }

  const { data, error } = await supabase
    .from('lab_orders')
    .insert(labOrder)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Lab results seeded', id: data.id })
}
