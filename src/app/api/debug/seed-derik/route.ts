import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { patients, providers, prescriptions, lab_orders, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  // Find Derik's patient record
  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .innerJoin(profiles, eq(patients.profile_id, profiles.id))
    .where(eq(profiles.email, 'dlolli@gmail.com'))
    .limit(1)

  const patient = patientRows[0]
  if (!patient) return NextResponse.json({ error: 'Patient dlolli@gmail.com not found' }, { status: 404 })

  // Find Dr. Urban's provider record (inner join ensures valid profile)
  const providerRows = await db
    .select({ id: providers.id })
    .from(providers)
    .innerJoin(profiles, eq(providers.profile_id, profiles.id))
    .where(eq(providers.is_active, true))
    .orderBy(providers.created_at)
    .limit(1)

  const provider = providerRows[0]
  if (!provider) return NextResponse.json({ error: 'No active provider found' }, { status: 404 })

  const patientId = patient.id
  const providerId = provider.id

  // Seed prescriptions
  const rxInserts = await db.insert(prescriptions).values([
    {
      patient_id: patientId,
      provider_id: providerId,
      medication_name: 'Estradiol transdermal patch',
      dosage: '0.05 mg/day',
      frequency: 'Apply twice weekly',
      quantity_dispensed: 8,
      refills: 3,
      status: 'active',
      prescribed_at: new Date('2026-03-10T00:00:00Z'),
    },
    {
      patient_id: patientId,
      provider_id: providerId,
      medication_name: 'Progesterone (micronized)',
      dosage: '100 mg',
      frequency: 'Take orally at bedtime',
      quantity_dispensed: 30,
      refills: 3,
      status: 'active',
      prescribed_at: new Date('2026-03-10T00:00:00Z'),
    },
    {
      patient_id: patientId,
      provider_id: providerId,
      medication_name: 'Estradiol vaginal cream',
      dosage: '0.5 g (0.1 mg estradiol)',
      frequency: 'Apply intravaginally 3x weekly',
      quantity_dispensed: 42,
      refills: 5,
      status: 'active',
      prescribed_at: new Date('2026-03-10T00:00:00Z'),
    },
  ]).returning({ id: prescriptions.id })

  // Seed lab orders
  const labInserts = await db.insert(lab_orders).values([
    {
      patient_id: patientId,
      provider_id: providerId,
      lab_partner: 'quest',
      tests: [
        { code: 'FSH', name: 'Follicle-Stimulating Hormone (FSH)', result: '42.1 mIU/mL', reference: '25.8–134.8 mIU/mL (postmenopausal)', flag: null },
        { code: 'E2', name: 'Estradiol (E2)', result: '18 pg/mL', reference: '< 10–28 pg/mL (postmenopausal)', flag: null },
        { code: 'TSH', name: 'Thyroid-Stimulating Hormone (TSH)', result: '2.1 mIU/L', reference: '0.4–4.0 mIU/L', flag: null },
        { code: 'FT4', name: 'Free T4', result: '1.1 ng/dL', reference: '0.8–1.8 ng/dL', flag: null },
        { code: 'CBC', name: 'Complete Blood Count (CBC)', result: 'Within normal limits', reference: null, flag: null },
        { code: 'CMP', name: 'Comprehensive Metabolic Panel', result: 'Within normal limits', reference: null, flag: null },
      ],
      clinical_indication: 'Perimenopausal evaluation; assess hormonal status prior to initiating MHT',
      status: 'resulted',
      ordered_at: '2026-03-05',
    },
    {
      patient_id: patientId,
      provider_id: providerId,
      lab_partner: 'quest',
      tests: [
        { code: 'TESTO', name: 'Testosterone, Total', result: '22 ng/dL', reference: '15–70 ng/dL (female)', flag: null },
        { code: 'SHBG', name: 'Sex Hormone Binding Globulin (SHBG)', result: '68 nmol/L', reference: '17–124 nmol/L', flag: null },
        { code: 'DHEA-S', name: 'DHEA-Sulfate', result: '78 µg/dL', reference: '35–430 µg/dL', flag: 'L' },
        { code: 'CORTISOL', name: 'Cortisol (AM)', result: '14.2 µg/dL', reference: '6.2–19.4 µg/dL', flag: null },
        { code: 'VIT-D', name: 'Vitamin D, 25-OH', result: '31 ng/mL', reference: '30–100 ng/mL', flag: null },
      ],
      clinical_indication: '6-week follow-up; monitor MHT response and adrenal function',
      status: 'resulted',
      ordered_at: '2026-04-15',
    },
  ]).returning({ id: lab_orders.id })

  return NextResponse.json({
    ok: true,
    patientId,
    providerId,
    prescriptionsCreated: rxInserts.length,
    labOrdersCreated: labInserts.length,
  })
}
