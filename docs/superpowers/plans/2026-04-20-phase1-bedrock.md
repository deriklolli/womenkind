# Phase 1 — AWS Bedrock Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all direct Anthropic API calls with AWS Bedrock so HIPAA BAA coverage is provided by the free AWS Business Associate Agreement instead of a $5k/mo Anthropic Enterprise contract.

**Architecture:** A single shared helper `src/lib/bedrock.ts` wraps the AWS Bedrock SDK. All 7 API routes that currently call `https://api.anthropic.com/v1/messages` are updated to call this helper instead. The request/response shape visible to each route stays the same — only the transport layer changes.

**Tech Stack:** `@aws-sdk/client-bedrock-runtime`, AWS IAM credentials (access key + secret), Claude Sonnet 4 via Bedrock model ID.

---

## Pre-requisites (manual AWS console steps — do before any code)

- [ ] **Step 1: Sign the AWS HIPAA BAA**
  - AWS Console → top-right account menu → **My Account** → scroll to **AWS Artifact** → **Agreements** → sign the **Business Associate Addendum**
  - Without this, HIPAA compliance is not active even with an AWS account

- [ ] **Step 2: Enable Claude on Bedrock**
  - AWS Console → **Amazon Bedrock** → **Model access** (left sidebar)
  - Request access to: **Claude Sonnet 4** (Anthropic)
  - Wait for access to be granted (usually instant, sometimes minutes)
  - Note the exact Model ID shown — it will look like `us.anthropic.claude-sonnet-4-5-20250514-v1:0`. Copy it for Task 1.

- [ ] **Step 3: Create IAM user**
  - AWS Console → **IAM** → **Users** → **Create user**
  - Name: `womenkind-app`
  - Attach policy: `AmazonBedrockFullAccess`
  - **Create access key** (Application running outside AWS) → copy `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

- [ ] **Step 4: Add env vars to Vercel + local**
  - Add to Vercel project env vars (Production + Preview):
    - `AWS_ACCESS_KEY_ID` = value from Step 3
    - `AWS_SECRET_ACCESS_KEY` = value from Step 3
    - `AWS_REGION` = `us-west-2`
  - Add same to your local `.env.local`
  - Do NOT remove `ANTHROPIC_API_KEY` yet — remove it in the final task

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/bedrock.ts` | Create | Shared Bedrock client wrapper — single place for auth, model ID, request/response |
| `src/lib/__tests__/bedrock.test.ts` | Create | Unit tests for the helper |
| `src/app/api/visits/webhook/transcription/route.ts` | Modify | Replace Anthropic fetch with `invokeModel()` |
| `src/app/api/chat/route.ts` | Modify | Replace Anthropic fetch with `invokeModel()` |
| `src/app/api/generate-briefs/route.ts` | Modify | Replace Anthropic fetch with `invokeModel()` |
| `src/app/api/intake/submit/route.ts` | Modify | Replace Anthropic fetch with `invokeModel()` |
| `src/app/api/presentation/ai-notes/route.ts` | Modify | Replace Anthropic fetch with `invokeModel()` |
| `src/app/api/visit-prep/route.ts` | Modify | Replace Anthropic fetch with `invokeModel()` |
| `src/app/api/seed-patients/route.ts` | Modify | Replace Anthropic fetch with `invokeModel()` |
| `src/app/api/visits/webhook/transcription/__tests__/transcription.test.ts` | Modify | Update mock from `global.fetch` to `@aws-sdk/client-bedrock-runtime` |

---

## Task 1: Install SDK and create `src/lib/bedrock.ts`

**Files:**
- Create: `src/lib/__tests__/bedrock.test.ts`
- Create: `src/lib/bedrock.ts`

- [ ] **Step 1: Install the AWS Bedrock SDK**

```bash
npm install @aws-sdk/client-bedrock-runtime
```

Expected output: package added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/bedrock.test.ts`:

```typescript
const mockSend = jest.fn()

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  InvokeModelCommand: jest.fn().mockImplementation((input) => input),
}))

import { invokeModel } from '../bedrock'

describe('invokeModel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AWS_REGION = 'us-west-2'
    process.env.BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-5-20250514-v1:0'
  })

  it('returns the text content from Bedrock response', async () => {
    const fakeBody = JSON.stringify({
      content: [{ type: 'text', text: 'Hello from Bedrock' }],
    })
    mockSend.mockResolvedValueOnce({
      body: new TextEncoder().encode(fakeBody),
    })

    const result = await invokeModel({
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 100,
    })

    expect(result).toBe('Hello from Bedrock')
  })

  it('includes system prompt when provided', async () => {
    const fakeBody = JSON.stringify({ content: [{ type: 'text', text: 'ok' }] })
    mockSend.mockResolvedValueOnce({ body: new TextEncoder().encode(fakeBody) })

    await invokeModel({
      system: 'You are a doctor.',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 50,
    })

    const commandArg = (jest.requireMock('@aws-sdk/client-bedrock-runtime').InvokeModelCommand as jest.Mock).mock.calls[0][0]
    const body = JSON.parse(commandArg.body)
    expect(body.system).toBe('You are a doctor.')
  })

  it('returns empty string when content is missing', async () => {
    const fakeBody = JSON.stringify({ content: [] })
    mockSend.mockResolvedValueOnce({ body: new TextEncoder().encode(fakeBody) })

    const result = await invokeModel({
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 50,
    })

    expect(result).toBe('')
  })
})
```

- [ ] **Step 3: Run to confirm RED**

```bash
npx jest src/lib/__tests__/bedrock.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../bedrock'`

- [ ] **Step 4: Create `src/lib/bedrock.ts`**

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

function getClient() {
  return new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' })
}

export async function invokeModel({
  system,
  messages,
  maxTokens = 2048,
}: {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
}): Promise<string> {
  const client = getClient()
  const modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250514-v1:0'

  const payload: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    messages,
  }
  if (system) payload.system = system

  const response = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    })
  )

  const body = JSON.parse(new TextDecoder().decode(response.body))
  return body.content?.[0]?.text || ''
}
```

- [ ] **Step 5: Add `BEDROCK_MODEL_ID` to env vars**

Add to `.env.local` (use the exact model ID you copied from the AWS Bedrock console in the pre-requisites):
```
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250514-v1:0
```

Add same to Vercel env vars.

- [ ] **Step 6: Run to confirm GREEN**

```bash
npx jest src/lib/__tests__/bedrock.test.ts --no-coverage
```

Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/bedrock.ts src/lib/__tests__/bedrock.test.ts package.json package-lock.json
git commit -m "feat: add AWS Bedrock helper for Claude invocation"
```

---

## Task 2: Update `visits/webhook/transcription/route.ts`

**Files:**
- Modify: `src/app/api/visits/webhook/transcription/route.ts`
- Modify: `src/app/api/visits/webhook/transcription/__tests__/transcription.test.ts`

- [ ] **Step 1: Update the test to mock Bedrock instead of fetch**

Replace the entire `__tests__/transcription.test.ts` with:

```typescript
import type { NextRequest } from 'next/server'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockUpdate = jest.fn()
const mockFrom = jest.fn()

function makeChain(resolveWith: unknown = { data: null, error: null }) {
  const chain: Record<string, jest.Mock> = {}
  ;['select', 'eq', 'neq'].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain) })
  chain.single      = jest.fn().mockResolvedValue(resolveWith)
  chain.maybeSingle = jest.fn().mockResolvedValue(resolveWith)
  chain.update      = mockUpdate.mockReturnValue(chain)
  return chain
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom })),
}))

// ── Bedrock mock ──────────────────────────────────────────────────────────────

jest.mock('@/lib/bedrock', () => ({
  invokeModel: jest.fn().mockResolvedValue(JSON.stringify({
    chief_complaint: 'Fatigue',
    hpi: 'Patient reports improvement.',
    ros: 'No new symptoms.',
    assessment: 'Menopause management.',
    plan: 'Continue HRT.',
  })),
}))

// ── AssemblyAI + misc mocks ───────────────────────────────────────────────────

jest.mock('@/lib/phi-audit', () => ({ logPhiAccess: jest.fn() }))

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email_123' }) },
  })),
}))

const FAKE_TRANSCRIPT = {
  id: 'transcript-123',
  status: 'completed',
  text: 'Provider: How are you feeling? Patient: Much better.',
  utterances: [
    { speaker: 'A', text: 'How are you feeling?' },
    { speaker: 'B', text: 'Much better.' },
  ],
}

const FAKE_NOTE = { id: 'note-uuid', patient_id: 'patient-uuid', provider_id: 'provider-uuid' }
const WEBHOOK_SECRET = 'test-secret'

function makeRequest(body: object) {
  return new Request('http://localhost/api/visits/webhook/transcription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': WEBHOOK_SECRET,
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('POST /api/visits/webhook/transcription', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.WEBHOOK_SECRET = WEBHOOK_SECRET
    process.env.ASSEMBLYAI_API_KEY = 'assembly-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    mockFrom.mockReturnValue(makeChain({ data: FAKE_NOTE, error: null }))

    global.fetch = jest.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('assemblyai.com/v2/transcript/') && (!opts?.method || opts.method === 'GET')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FAKE_TRANSCRIPT) })
      }
      if (url.includes('assemblyai.com/v2/transcript/') && opts?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }) as jest.Mock
  })

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET
    delete process.env.ASSEMBLYAI_API_KEY
  })

  it('returns 401 when webhook secret is missing', async () => {
    const { POST } = await import('../route')
    const req = new Request('http://localhost/api/visits/webhook/transcription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript_id: 'transcript-123', status: 'completed' }),
    }) as unknown as NextRequest

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when transcript_id is missing', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ status: 'completed' }))
    expect(res.status).toBe(400)
  })

  it('clears recording_url after successful transcription', async () => {
    const { POST } = await import('../route')
    const res = await POST(makeRequest({ transcript_id: 'transcript-123', status: 'completed' }))

    expect(res.status).toBe(200)

    const updateCalls = mockUpdate.mock.calls
    const soapUpdate = updateCalls.find((args: unknown[]) =>
      typeof args[0] === 'object' && args[0] !== null && 'chief_complaint' in (args[0] as object)
    )

    expect(soapUpdate).toBeDefined()
    expect((soapUpdate![0] as Record<string, unknown>).recording_url).toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx jest src/app/api/visits/webhook/transcription/__tests__/transcription.test.ts --no-coverage
```

Expected: FAIL — route still uses `ANTHROPIC_API_KEY` / raw fetch

- [ ] **Step 3: Update the route to use `invokeModel`**

In `src/app/api/visits/webhook/transcription/route.ts`:

1. Add import at the top (after existing imports):
```typescript
import { invokeModel } from '@/lib/bedrock'
```

2. Remove the `generateSoapNote` function entirely (lines 163–229).

3. Replace the `generateSoapNote(fullTranscript, anthropicKey)` call block with:
```typescript
    const soapNote = await generateSoapNote(fullTranscript)
```

4. Add the new `generateSoapNote` function (replacing the deleted one):
```typescript
async function generateSoapNote(transcript: string): Promise<{
  chief_complaint: string
  hpi: string
  ros: string
  assessment: string
  plan: string
}> {
  const text = await invokeModel({
    maxTokens: 4096,
    system: `You are a clinical documentation specialist for Womenkind, a telehealth menopause care platform.
Your task is to generate a structured SOAP note from a clinical visit transcript.

Guidelines:
- Write in standard clinical documentation style
- Be specific and use the patient's own words where clinically relevant
- Focus on menopause-related symptoms, treatments, and management
- Assessment should include clinical reasoning, not just a list
- Plan should be actionable and specific
- Do not fabricate information not present in the transcript
- Return ONLY a JSON object, no markdown`,
    messages: [
      {
        role: 'user',
        content: `Generate a SOAP note from this clinical visit transcript. Return ONLY a JSON object.

TRANSCRIPT:
${transcript}

Return this exact JSON structure:
{
  "chief_complaint": "Primary reason for visit in 1-2 sentences",
  "hpi": "History of present illness — detailed narrative of symptoms, onset, duration, severity, modifying factors",
  "ros": "Review of systems — pertinent positives and negatives discussed during the visit",
  "assessment": "Clinical assessment including differential considerations and working diagnosis",
  "plan": "Treatment plan including medications, follow-up, labs ordered, patient education, and next steps"
}`,
      },
    ],
  })

  try {
    return JSON.parse(text)
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
    throw new Error('Failed to parse SOAP note JSON from Bedrock')
  }
}
```

5. Remove the `anthropicKey` variable and the old guard block that checked `if (!anthropicKey)`.

- [ ] **Step 4: Run to confirm GREEN**

```bash
npx jest src/app/api/visits/webhook/transcription/__tests__/transcription.test.ts --no-coverage
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/visits/webhook/transcription/route.ts src/app/api/visits/webhook/transcription/__tests__/transcription.test.ts
git commit -m "feat: migrate transcription webhook from Anthropic to Bedrock"
```

---

## Task 3: Update `chat/route.ts`

**Files:**
- Modify: `src/app/api/chat/route.ts`

No new test needed — this route has no unit test and the change is mechanical. Manual verification in the provider portal after deploy is sufficient.

- [ ] **Step 1: Add import and swap the Claude call**

In `src/app/api/chat/route.ts`:

1. Add import at the top:
```typescript
import { invokeModel } from '@/lib/bedrock'
```

2. Replace the `const apiKey = process.env.ANTHROPIC_API_KEY` guard block and the entire `fetch('https://api.anthropic.com/v1/messages', ...)` call with:

```typescript
    let responseText: string
    try {
      responseText = await invokeModel({
        maxTokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      })
    } catch (err: any) {
      console.error('Bedrock error:', err)
      return NextResponse.json({
        response: 'Sorry, there was an error communicating with the AI.',
      })
    }
```

3. Remove the `if (!apiKey)` early return block and the `claudeRes.ok` check (now handled by the try/catch above).

4. Remove the `const claudeData = await claudeRes.json()` and `let responseText = claudeData.content?.[0]?.text` lines — `responseText` is now set directly by `invokeModel`.

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```bash
npx jest --no-coverage
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: migrate chat route from Anthropic to Bedrock"
```

---

## Task 4: Update `generate-briefs`, `intake/submit`, `presentation/ai-notes`, `visit-prep`

**Files:**
- Modify: `src/app/api/generate-briefs/route.ts`
- Modify: `src/app/api/intake/submit/route.ts`
- Modify: `src/app/api/presentation/ai-notes/route.ts`
- Modify: `src/app/api/visit-prep/route.ts`

All four routes follow the same pattern. For each file:

1. Add `import { invokeModel } from '@/lib/bedrock'` at the top
2. Find the function that calls `fetch('https://api.anthropic.com/v1/messages', ...)`
3. Replace that fetch call and its response parsing with a call to `invokeModel`

The before/after pattern for each is:

**Before (in each file):**
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY
// ... apiKey guard ...
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: N, system: '...', messages: [...] }),
})
const data = await res.json()
const text = data.content?.[0]?.text || ''
```

**After (in each file):**
```typescript
const text = await invokeModel({ maxTokens: N, system: '...', messages: [...] })
```

- [ ] **Step 1: Update `generate-briefs/route.ts`**

Open `src/app/api/generate-briefs/route.ts`. Add the import and apply the before→after pattern to every `fetch('https://api.anthropic.com/...')` call in the file.

- [ ] **Step 2: Update `intake/submit/route.ts`**

Open `src/app/api/intake/submit/route.ts`. Add the import and apply the before→after pattern.

- [ ] **Step 3: Update `presentation/ai-notes/route.ts`**

Open `src/app/api/presentation/ai-notes/route.ts`. Add the import and apply the before→after pattern.

- [ ] **Step 4: Update `visit-prep/route.ts`**

Open `src/app/api/visit-prep/route.ts`. Add the import and apply the before→after pattern.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/generate-briefs/route.ts src/app/api/intake/submit/route.ts src/app/api/presentation/ai-notes/route.ts src/app/api/visit-prep/route.ts
git commit -m "feat: migrate brief/note generation routes from Anthropic to Bedrock"
```

---

## Task 5: Update `seed-patients/route.ts` and clean up env vars

**Files:**
- Modify: `src/app/api/seed-patients/route.ts`

- [ ] **Step 1: Update `seed-patients/route.ts`**

Open `src/app/api/seed-patients/route.ts`. Add `import { invokeModel } from '@/lib/bedrock'` and apply the before→after pattern from Task 4.

- [ ] **Step 2: Run full test suite one final time**

```bash
npx jest --no-coverage
```

Expected: all tests PASS

- [ ] **Step 3: Remove `ANTHROPIC_API_KEY` from env**

- Remove `ANTHROPIC_API_KEY` from `.env.local`
- Remove `ANTHROPIC_API_KEY` from Vercel project env vars (Production + Preview)

- [ ] **Step 4: Final commit**

```bash
git add src/app/api/seed-patients/route.ts
git commit -m "feat: complete Bedrock migration — remove Anthropic API key"
```

---

## Verification

After deploying to staging:

- [ ] Open the provider portal → AI chat — send a message, confirm response comes back
- [ ] Submit a test intake → confirm AI brief is generated
- [ ] Check Vercel function logs for any `Bedrock error:` entries
- [ ] Check AWS CloudWatch → Bedrock → Invocations to confirm calls are landing
