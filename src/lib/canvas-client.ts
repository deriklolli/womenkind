/**
 * Canvas Medical API Client (Mock)
 *
 * This module mocks the Canvas Medical FHIR R4 API for the investor demo.
 * When Canvas sandbox credentials are available, replace the mock functions
 * with real OAuth2 auth + FHIR resource calls.
 *
 * Real implementation will need:
 * - CANVAS_API_CLIENT_ID, CANVAS_API_CLIENT_SECRET, CANVAS_API_BASE_URL env vars
 * - OAuth2 client credentials flow for access token
 * - FHIR R4 resource helpers (Patient, MedicationRequest, ServiceRequest)
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface PrescriptionPayload {
  patientId: string
  providerId: string
  medicationName: string
  dosage: string
  frequency: string
  quantity: number
  refills: number
  pharmacy: string
}

export interface PrescriptionResult {
  canvasPrescriptionId: string
  status: 'sent'
  sentAt: string
}

export interface LabOrderPayload {
  patientId: string
  providerId: string
  labPartner: string
  tests: { code: string; name: string }[]
  clinicalIndication: string
}

export interface LabOrderResult {
  canvasOrderId: string
  status: 'sent'
  sentAt: string
}

export interface LabResultItem {
  testCode: string
  testName: string
  value: string
  unit: string
  referenceRange: string
  flag: 'normal' | 'high' | 'low' | 'critical' | null
}

// ─── Mock Helpers ────────────────────────────────────────────────────

function generateCanvasId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10)
  return `${prefix}-${rand}-${Date.now().toString(36)}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Mock API Methods ────────────────────────────────────────────────

/**
 * Send a prescription via Canvas Medical e-prescribe.
 * MOCK: Returns a simulated Canvas prescription ID after a brief delay.
 */
export async function sendPrescription(payload: PrescriptionPayload): Promise<PrescriptionResult> {
  // Simulate network latency
  await delay(800 + Math.random() * 400)

  // TODO: Replace with real Canvas PrescribeCommand via SDK
  // const token = await getAccessToken()
  // const response = await fetch(`${CANVAS_BASE_URL}/PrescribeCommand`, { ... })

  return {
    canvasPrescriptionId: generateCanvasId('rx'),
    status: 'sent',
    sentAt: new Date().toISOString(),
  }
}

/**
 * Send a lab order via Canvas Medical electronic ordering.
 * MOCK: Returns a simulated Canvas order ID after a brief delay.
 */
export async function sendLabOrder(payload: LabOrderPayload): Promise<LabOrderResult> {
  await delay(800 + Math.random() * 400)

  // TODO: Replace with real Canvas LabOrderCommand via SDK
  // const token = await getAccessToken()
  // const response = await fetch(`${CANVAS_BASE_URL}/LabOrderCommand`, { ... })

  return {
    canvasOrderId: generateCanvasId('lab'),
    status: 'sent',
    sentAt: new Date().toISOString(),
  }
}

/**
 * Fetch lab results for an order.
 * MOCK: Returns null (no results yet) or sample results for demo-seeded orders.
 */
export async function getLabResults(canvasOrderId: string): Promise<LabResultItem[] | null> {
  await delay(500)

  // TODO: Replace with real Canvas FHIR R4 DiagnosticReport fetch
  // For demo, results are stored directly in lab_orders.results in Supabase
  return null
}

// ─── Common Menopause Prescription Templates ─────────────────────────

export const PRESCRIPTION_TEMPLATES = [
  {
    name: 'Estradiol Patch',
    medicationName: 'Estradiol transdermal patch',
    dosage: '0.05 mg/day',
    frequency: 'Apply twice weekly',
    quantity: 8,
    refills: 3,
    category: 'MHT',
  },
  {
    name: 'Estradiol Patch (Low-dose)',
    medicationName: 'Estradiol transdermal patch',
    dosage: '0.025 mg/day',
    frequency: 'Apply twice weekly',
    quantity: 8,
    refills: 3,
    category: 'MHT',
  },
  {
    name: 'Progesterone (Micronized)',
    medicationName: 'Micronized progesterone (Prometrium)',
    dosage: '200 mg',
    frequency: 'Once daily at bedtime',
    quantity: 30,
    refills: 3,
    category: 'MHT',
  },
  {
    name: 'Progesterone (Low-dose)',
    medicationName: 'Micronized progesterone (Prometrium)',
    dosage: '100 mg',
    frequency: 'Once daily at bedtime',
    quantity: 30,
    refills: 3,
    category: 'MHT',
  },
  {
    name: 'Vaginal Estrogen Cream',
    medicationName: 'Estradiol vaginal cream (Estrace)',
    dosage: '0.01%',
    frequency: '1g intravaginally twice weekly',
    quantity: 1,
    refills: 3,
    category: 'GSM',
  },
  {
    name: 'Ospemifene',
    medicationName: 'Ospemifene (Osphena)',
    dosage: '60 mg',
    frequency: 'Once daily with food',
    quantity: 30,
    refills: 3,
    category: 'GSM',
  },
  {
    name: 'Venlafaxine (for vasomotor)',
    medicationName: 'Venlafaxine ER',
    dosage: '37.5 mg',
    frequency: 'Once daily',
    quantity: 30,
    refills: 3,
    category: 'Non-hormonal',
  },
  {
    name: 'Paroxetine (Brisdelle)',
    medicationName: 'Paroxetine mesylate (Brisdelle)',
    dosage: '7.5 mg',
    frequency: 'Once daily at bedtime',
    quantity: 30,
    refills: 3,
    category: 'Non-hormonal',
  },
]

// ─── Common Menopause Lab Panel Templates ────────────────────────────

export const LAB_PANEL_TEMPLATES = [
  {
    name: 'Hormone Panel',
    tests: [
      { code: 'FSH', name: 'Follicle-Stimulating Hormone' },
      { code: 'LH', name: 'Luteinizing Hormone' },
      { code: 'E2', name: 'Estradiol' },
      { code: 'TESTO', name: 'Total Testosterone' },
      { code: 'PROG', name: 'Progesterone' },
    ],
    indication: 'Menopausal status evaluation',
  },
  {
    name: 'Thyroid Panel',
    tests: [
      { code: 'TSH', name: 'Thyroid Stimulating Hormone' },
      { code: 'FT4', name: 'Free T4' },
      { code: 'FT3', name: 'Free T3' },
    ],
    indication: 'Rule out thyroid dysfunction contributing to symptoms',
  },
  {
    name: 'Lipid Panel',
    tests: [
      { code: 'TC', name: 'Total Cholesterol' },
      { code: 'LDL', name: 'LDL Cholesterol' },
      { code: 'HDL', name: 'HDL Cholesterol' },
      { code: 'TG', name: 'Triglycerides' },
    ],
    indication: 'Cardiovascular risk assessment — post-menopausal monitoring',
  },
  {
    name: 'Metabolic Panel',
    tests: [
      { code: 'GLU', name: 'Fasting Glucose' },
      { code: 'HBA1C', name: 'Hemoglobin A1c' },
      { code: 'INS', name: 'Fasting Insulin' },
    ],
    indication: 'Metabolic health and insulin sensitivity assessment',
  },
  {
    name: 'Bone Health',
    tests: [
      { code: 'VITD', name: 'Vitamin D, 25-Hydroxy' },
      { code: 'CA', name: 'Calcium' },
      { code: 'CTX', name: 'C-Telopeptide (Bone Resorption Marker)' },
    ],
    indication: 'Bone density and osteoporosis risk markers',
  },
  {
    name: 'CBC + Iron',
    tests: [
      { code: 'CBC', name: 'Complete Blood Count' },
      { code: 'FE', name: 'Serum Iron' },
      { code: 'FERR', name: 'Ferritin' },
      { code: 'TIBC', name: 'Total Iron Binding Capacity' },
    ],
    indication: 'Anemia screening — perimenopause with irregular bleeding',
  },
]
