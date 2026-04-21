import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { lab_orders } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const DEMO_PATIENT_ID = 'c0000000-0000-0000-0000-000000000001'

/**
 * POST /api/seed-labs
 *
 * Seeds a realistic Hormone Panel lab order with results for the demo patient (Sarah).
 * Values are clinically plausible for a perimenopausal woman — FSH elevated,
 * estradiol low, progesterone low, testosterone borderline.
 *
 * NOTE: The `results` field is stored in `tests` JSON as a workaround since
 * the lab_orders schema does not have a dedicated `results` column.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Check for existing seeded lab order to avoid duplicates
  const existing = await db.query.lab_orders.findFirst({
    where: and(
      eq(lab_orders.patient_id, DEMO_PATIENT_ID),
      eq(lab_orders.status, 'results_available')
    ),
  })

  if (existing) {
    return NextResponse.json({ message: 'Lab results already seeded', id: existing.id })
  }

  const now = new Date()
  const orderedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago

  const tests = [
    { code: 'FSH', name: 'Follicle-Stimulating Hormone' },
    { code: 'LH', name: 'Luteinizing Hormone' },
    { code: 'E2', name: 'Estradiol' },
    { code: 'TESTO', name: 'Total Testosterone' },
    { code: 'PROG', name: 'Progesterone' },
    { code: 'TSH', name: 'Thyroid-Stimulating Hormone' },
  ]

  // Results are included in the tests JSON since schema has no separate results column
  const testsWithResults = [
    { code: 'FSH', name: 'Follicle-Stimulating Hormone', value: '48.2', unit: 'mIU/mL', referenceRange: '3.5-12.5 mIU/mL', flag: 'high' },
    { code: 'LH', name: 'Luteinizing Hormone', value: '32.1', unit: 'mIU/mL', referenceRange: '2.4-12.6 mIU/mL', flag: 'high' },
    { code: 'E2', name: 'Estradiol', value: '18', unit: 'pg/mL', referenceRange: '30-400 pg/mL', flag: 'low' },
    { code: 'TESTO', name: 'Total Testosterone', value: '22', unit: 'ng/dL', referenceRange: '15-70 ng/dL', flag: 'normal' },
    { code: 'PROG', name: 'Progesterone', value: '0.3', unit: 'ng/mL', referenceRange: '0.1-25 ng/mL', flag: 'normal' },
    { code: 'TSH', name: 'Thyroid-Stimulating Hormone', value: '2.8', unit: 'mIU/L', referenceRange: '0.4-4.0 mIU/L', flag: 'normal' },
  ]

  const [data] = await db
    .insert(lab_orders)
    .values({
      patient_id: DEMO_PATIENT_ID,
      provider_id: null,
      visit_id: null,
      canvas_order_id: `mock-canvas-lab-${Date.now().toString(36)}`,
      lab_partner: 'quest',
      tests: testsWithResults,
      clinical_indication: 'Menopausal status evaluation — perimenopausal symptoms including hot flashes, night sweats, irregular cycles',
      status: 'results_available',
      ordered_at: orderedAt.toISOString(),
    })
    .returning({ id: lab_orders.id })

  if (!data) {
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Lab results seeded', id: data.id })
}
