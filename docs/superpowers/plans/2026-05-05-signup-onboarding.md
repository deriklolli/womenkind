# Signup & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current fragmented signup/payment/intake flow with a single linear funnel: plan selection → account creation → email verification → payment → welcome → intake → dashboard, backed by an explicit `onboarding_status` state machine on the `patients` table.

**Architecture:** Each page in the funnel is a server component that reads `onboarding_status` from the DB and renders/redirects accordingly. Email verification uses a stateless HMAC token (no new table). Stripe payment confirmation happens synchronously in the `/signup/resume` page when Stripe redirects back with `?session_id=X`.

**Tech Stack:** Next.js 14 App Router (server components), Drizzle ORM, PostgreSQL (RDS), Stripe (subscriptions), Resend (transactional email), Node.js `crypto` (HMAC tokens).

**Note on membership plan content:** The `/join` page uses placeholder plan keys (`standard`, `premium`, `elite`) until the membership conversation in a separate session is complete. The structure is fully wired — only copy and Stripe price IDs need swapping.

---

## File Map

**New files:**
- `src/app/join/page.tsx` — Plan selection (3 cards)
- `src/app/signup/verify/page.tsx` — "Check your inbox" waiting screen
- `src/app/signup/resume/page.tsx` — Resumption screen + Stripe session confirmation
- `src/app/welcome/page.tsx` — Pre-intake welcome screen
- `src/app/api/auth/resend-verification/route.ts` — Resend verification email
- `src/app/api/debug/migrate-onboarding/route.ts` — DB migration (run once)
- `src/lib/auth-tokens.ts` — Email verification token helpers

**Modified files:**
- `src/lib/db/schema.ts` — Add `onboarding_status`, `membership_plan` to patients
- `src/app/signup/page.tsx` — Read `?plan=` param, store cookie, redirect to `/signup/verify`
- `src/app/signup/verified/page.tsx` — Rewrite: verify HMAC token, update status, redirect
- `src/app/api/auth/signup/route.ts` — Set `onboarding_status: 'unverified'`, send verification email
- `src/app/api/stripe/checkout/route.ts` — Add `onboarding_membership` type + new success/cancel URLs
- `src/app/api/webhooks/stripe/route.ts` — Handle `onboarding_membership` webhook event
- `src/app/api/intake/submit/route.ts` — Set `onboarding_status: 'active'` after brief generation
- `src/app/intake/page.tsx` — Replace dark theme with light theme content (currently `/intake2`)
- `src/app/patient/dashboard/page.tsx` — Guard: redirect to `/signup/resume` if not `active`

**Deleted files:**
- `src/app/get-started/page.tsx`
- `src/app/intake2/page.tsx`
- `src/app/intake/payment/page.tsx`
- `src/app/intake/payment2/page.tsx`

---

### Task 1: DB migration — add onboarding columns to patients

**Files:**
- Create: `src/app/api/debug/migrate-onboarding/route.ts`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Create the migration endpoint**

```typescript
// src/app/api/debug/migrate-onboarding/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-migration-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.execute(sql`
    ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS membership_plan TEXT;
  `)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Update the Drizzle schema**

In `src/lib/db/schema.ts`, find the `patients` table (lines 20–28) and add the two new columns:

```typescript
export const patients = pgTable('patients', {
  id:                uuid('id').primaryKey().defaultRandom(),
  profile_id:        uuid('profile_id').notNull().references(() => profiles.id),
  date_of_birth:     text('date_of_birth'),
  state:             text('state'),
  phone:             text('phone'),
  is_active:         boolean('is_active').notNull().default(true),
  onboarding_status: text('onboarding_status').notNull().default('active'),
  membership_plan:   text('membership_plan'),
  created_at:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 3: Run tsc to verify types compile**

```bash
cd /Users/deriklolli/Projects/WOMENKIND/WomenKind && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Deploy and run the migration**

```bash
git add src/app/api/debug/migrate-onboarding/route.ts src/lib/db/schema.ts
git commit -m "feat: add onboarding_status and membership_plan to patients table"
vercel deploy --prod
```

After deploy:
```bash
curl -X POST https://womenkind.vercel.app/api/debug/migrate-onboarding \
  -H "x-migration-secret: $CRON_SECRET"
```

Expected: `{"ok":true}`

- [ ] **Step 5: Verify columns exist**

Use the Supabase SQL editor or an existing debug endpoint to run:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' AND column_name IN ('onboarding_status', 'membership_plan');
```

Expected: 2 rows returned

---

### Task 2: Email verification token helpers

**Files:**
- Create: `src/lib/auth-tokens.ts`

- [ ] **Step 1: Create the token helper file**

```typescript
// src/lib/auth-tokens.ts
import { createHmac } from 'crypto'

// Token expires after 24 hours. Message = "verify:{patientId}:{timestamp}"
export function generateVerificationToken(patientId: string): { token: string; ts: string } {
  const ts = Date.now().toString()
  const message = `verify:${patientId}:${ts}`
  const token = createHmac('sha256', process.env.CRON_SECRET!).update(message).digest('hex')
  return { token, ts }
}

export function verifyVerificationToken(
  patientId: string,
  token: string,
  ts: string
): boolean {
  const tsNum = parseInt(ts, 10)
  if (isNaN(tsNum)) return false
  // Reject tokens older than 24 hours
  if (Date.now() - tsNum > 24 * 60 * 60 * 1000) return false
  const message = `verify:${patientId}:${ts}`
  const expected = createHmac('sha256', process.env.CRON_SECRET!).update(message).digest('hex')
  return expected === token
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-tokens.ts
git commit -m "feat: email verification token helpers"
```

---

### Task 3: Update signup API to send verification email

**Files:**
- Modify: `src/app/api/auth/signup/route.ts`

- [ ] **Step 1: Update the signup route**

Replace the existing file with the following (changes: set `onboarding_status: 'unverified'` on patient insert, send verification email via Resend instead of welcome email):

```typescript
// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { profiles, patients } from '@/lib/db/schema'
import { Resend } from 'resend'
import { generateVerificationToken } from '@/lib/auth-tokens'
import { buildEngagementEmail, FROM } from '@/lib/engagement'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { firstName, lastName, email, password } = await req.json()

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 1. Create Supabase auth user (pre-confirmed — we handle verification ourselves)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Signup failed' }, { status: 400 })
  }

  const userId = authData.user.id

  try {
    // 2. Create profiles + patients rows
    await db.insert(profiles).values({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
    })

    const [patient] = await db
      .insert(patients)
      .values({
        profile_id: userId,
        onboarding_status: 'unverified',
      })
      .returning({ id: patients.id })

    // 3. Sign user in server-side to establish session cookies
    const sessionClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: sessionData, error: signInError } = await sessionClient.auth.signInWithPassword({ email, password })
    if (signInError || !sessionData.session) {
      throw new Error('Sign-in after signup failed: ' + signInError?.message)
    }

    // 4. Send verification email via Resend (fire-and-forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com'
    const { token, ts } = generateVerificationToken(patient.id)
    const verifyUrl = `${appUrl}/signup/verified?patientId=${patient.id}&token=${token}&ts=${ts}`

    resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Verify your email — Womenkind Health',
      html: buildEngagementEmail({
        patientId: patient.id,
        heading: 'Verify your email address',
        bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:#422a1f;line-height:1.6;">Hi ${firstName}, click below to verify your email and continue setting up your Womenkind account.</p><p style="margin:0;font-size:14px;color:rgba(66,42,31,0.6);">This link expires in 24 hours.</p>`,
        ctaText: 'Verify my email',
        ctaUrl: verifyUrl,
      }),
    }).catch((err) => console.error('Verification email send error:', err))

    // 5. Set session cookies on response
    const response = NextResponse.json({ ok: true })
    const { access_token, refresh_token } = sessionData.session
    response.cookies.set('sb-access-token', access_token, { httpOnly: true, sameSite: 'lax', secure: true, path: '/' })
    response.cookies.set('sb-refresh-token', refresh_token, { httpOnly: true, sameSite: 'lax', secure: true, path: '/' })
    return response
  } catch (err: any) {
    // Roll back Supabase user so the email can be reused
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
    console.error('Signup error:', err)
    return NextResponse.json({ error: err.message || 'Signup failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/signup/route.ts
git commit -m "feat: signup sets onboarding_status=unverified, sends verification email"
```

---

### Task 4: Update signup page (read plan param, set cookie, redirect to verify)

**Files:**
- Modify: `src/app/signup/page.tsx`

- [ ] **Step 1: Read the current signup page**

Open `src/app/signup/page.tsx`. Note the current form, validation, and redirect logic (currently redirects to `?next` param, defaults to `/get-started`).

- [ ] **Step 2: Update the post-submit redirect**

Find the section that handles the successful signup response. Change the redirect target from `/get-started` (or `next` param) to `/signup/verify`:

```typescript
// After successful signup, read plan from URL param and store in cookie before redirecting
const params = new URLSearchParams(window.location.search)
const plan = params.get('plan')
if (plan) {
  document.cookie = `wk_selected_plan=${encodeURIComponent(plan)};path=/;max-age=3600;samesite=lax`
}
router.push('/signup/verify')
```

The full updated submit handler (replace whatever currently runs after `fetch('/api/auth/signup', ...)`):

```typescript
const res = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName, lastName, email, password }),
})
const data = await res.json()
if (!res.ok) {
  setError(data.error || 'Something went wrong')
  return
}
// Store selected plan in cookie for Stripe checkout
const params = new URLSearchParams(window.location.search)
const plan = params.get('plan')
if (plan) {
  document.cookie = `wk_selected_plan=${encodeURIComponent(plan)};path=/;max-age=3600;samesite=lax`
}
router.push('/signup/verify')
```

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/signup/page.tsx
git commit -m "feat: signup page stores plan cookie, redirects to /signup/verify"
```

---

### Task 5: Create `/signup/verify` page

**Files:**
- Create: `src/app/signup/verify/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// src/app/signup/verify/page.tsx
'use client'

import { useState } from 'react'

export default function VerifyEmailPage() {
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
      if (res.ok) setResent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f3ee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '48px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📬</div>
        <h1 style={{ margin: '0 0 12px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>
          Check your inbox
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
          We sent a verification link to your email address. Click it to continue setting up your account.
        </p>
        {resent ? (
          <p style={{ fontSize: '14px', color: '#944fed', fontWeight: 600 }}>
            Email resent — check your inbox (and spam folder).
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#944fed',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {loading ? 'Sending...' : "Didn't get it? Resend the email"}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/signup/verify/page.tsx
git commit -m "feat: /signup/verify — check your inbox screen"
```

---

### Task 6: Create `/api/auth/resend-verification` endpoint

**Files:**
- Create: `src/app/api/auth/resend-verification/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
// src/app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { generateVerificationToken } from '@/lib/auth-tokens'
import { buildEngagementEmail, FROM } from '@/lib/engagement'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session || session.role !== 'patient') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, session.patientId!),
  })

  if (!patient || patient.onboarding_status !== 'unverified') {
    return NextResponse.json({ error: 'Not applicable' }, { status: 400 })
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, patient.profile_id),
  })

  if (!profile?.email) {
    return NextResponse.json({ error: 'No email on file' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.womenkindhealth.com'
  const { token, ts } = generateVerificationToken(patient.id)
  const verifyUrl = `${appUrl}/signup/verified?patientId=${patient.id}&token=${token}&ts=${ts}`

  await resend.emails.send({
    from: FROM,
    to: profile.email,
    subject: 'Verify your email — Womenkind Health',
    html: buildEngagementEmail({
      patientId: patient.id,
      heading: 'Verify your email address',
      bodyHtml: `<p style="margin:0 0 16px;font-size:16px;color:#422a1f;line-height:1.6;">Hi ${profile.first_name}, click below to verify your email address.</p><p style="margin:0;font-size:14px;color:rgba(66,42,31,0.6);">This link expires in 24 hours.</p>`,
      ctaText: 'Verify my email',
      ctaUrl: verifyUrl,
    }),
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/resend-verification/route.ts
git commit -m "feat: /api/auth/resend-verification endpoint"
```

---

### Task 7: Rewrite `/signup/verified` page (email link landing)

**Files:**
- Modify: `src/app/signup/verified/page.tsx`

- [ ] **Step 1: Rewrite the page**

The existing page calls `/api/auth/create-patient` — replace entirely:

```typescript
// src/app/signup/verified/page.tsx
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyVerificationToken } from '@/lib/auth-tokens'
import { getServerSession } from '@/lib/getServerSession'

interface Props {
  searchParams: { patientId?: string; token?: string; ts?: string }
}

export default async function VerifiedPage({ searchParams }: Props) {
  const { patientId, token, ts } = searchParams

  if (!patientId || !token || !ts) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7f3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '48px', maxWidth: '480px', textAlign: 'center' }}>
          <h1 style={{ color: '#280f49', fontWeight: 400 }}>Invalid link</h1>
          <p style={{ color: 'rgba(66,42,31,0.7)' }}>This verification link is missing required parameters. Please request a new one.</p>
        </div>
      </div>
    )
  }

  const valid = verifyVerificationToken(patientId, token, ts)

  if (!valid) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7f3ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '48px', maxWidth: '480px', textAlign: 'center' }}>
          <h1 style={{ color: '#280f49', fontWeight: 400 }}>Link expired or invalid</h1>
          <p style={{ color: 'rgba(66,42,31,0.7)' }}>Verification links expire after 24 hours. Please sign in and request a new one.</p>
        </div>
      </div>
    )
  }

  // Verify the session matches this patientId
  const session = await getServerSession()
  if (!session || session.patientId !== patientId) {
    redirect('/patient/login?next=/signup/resume')
  }

  // Advance status from unverified → verified (idempotent)
  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, patientId),
    columns: { onboarding_status: true },
  })

  if (patient?.onboarding_status === 'unverified') {
    await db
      .update(patients)
      .set({ onboarding_status: 'verified' })
      .where(eq(patients.id, patientId))
  }

  redirect('/signup/resume')
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/signup/verified/page.tsx
git commit -m "feat: /signup/verified — verify HMAC token, advance status to verified"
```

---

### Task 8: Create `/join` plan selection page

**Files:**
- Create: `src/app/join/page.tsx`

- [ ] **Step 1: Create the page**

Plan content is placeholder — copy and Stripe price IDs will be updated once the membership conversation is complete. The plan keys (`standard`, `premium`, `elite`) must match what the Stripe checkout and webhook will use.

```typescript
// src/app/join/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const PLANS = [
  {
    key: 'standard',
    name: 'Standard',
    price: '$X/mo',
    description: 'Plan description TBD',
    features: ['Feature 1 TBD', 'Feature 2 TBD', 'Feature 3 TBD'],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '$X/mo',
    description: 'Plan description TBD',
    features: ['Everything in Standard', 'Feature 4 TBD', 'Feature 5 TBD'],
    highlighted: true,
  },
  {
    key: 'elite',
    name: 'Elite',
    price: '$X/mo',
    description: 'Plan description TBD',
    features: ['Everything in Premium', 'Feature 6 TBD', 'Feature 7 TBD'],
  },
]

export default async function JoinPage() {
  // Active patients go straight to dashboard
  const session = await getServerSession()
  if (session?.role === 'patient' && session.patientId) {
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, session.patientId),
      columns: { onboarding_status: true },
    })
    if (patient?.onboarding_status === 'active') {
      redirect('/patient/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f3ee',
      fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      padding: '48px 24px',
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>
            Womenkind Health
          </p>
          <h1 style={{ margin: '0 0 16px', fontSize: '36px', fontWeight: 400, color: '#280f49', lineHeight: 1.2 }}>
            Choose your membership
          </h1>
          <p style={{ margin: 0, fontSize: '18px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
            All memberships include your initial intake assessment and access to Dr. Urban.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {PLANS.map((plan) => (
            <Link
              key={plan.key}
              href={`/signup?plan=${plan.key}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                backgroundColor: plan.highlighted ? '#280f49' : '#ffffff',
                borderRadius: '20px',
                padding: '40px 32px',
                border: plan.highlighted ? 'none' : '1px solid rgba(66,42,31,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: plan.highlighted ? 'rgba(255,255,255,0.6)' : 'rgba(66,42,31,0.45)' }}>
                  {plan.name}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '32px', fontWeight: 400, color: plan.highlighted ? '#ffffff' : '#280f49' }}>
                  {plan.price}
                </p>
                <p style={{ margin: '0 0 24px', fontSize: '15px', color: plan.highlighted ? 'rgba(255,255,255,0.7)' : 'rgba(66,42,31,0.7)', lineHeight: 1.5 }}>
                  {plan.description}
                </p>
                <ul style={{ margin: '0 0 32px', padding: '0 0 0 20px', listStyle: 'disc', flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ marginBottom: '8px', fontSize: '14px', color: plan.highlighted ? 'rgba(255,255,255,0.85)' : 'rgba(66,42,31,0.8)' }}>
                      {f}
                    </li>
                  ))}
                </ul>
                <div style={{
                  display: 'block',
                  backgroundColor: plan.highlighted ? '#944fed' : '#280f49',
                  color: '#ffffff',
                  padding: '14px 32px',
                  borderRadius: '100px',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '15px',
                }}>
                  Get started
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/join/page.tsx
git commit -m "feat: /join plan selection page (placeholder content)"
```

---

### Task 9: Create `/signup/resume` resumption screen

**Files:**
- Create: `src/app/signup/resume/page.tsx`

- [ ] **Step 1: Create `CheckoutButton.tsx` first (client component)**

```typescript
// src/app/signup/resume/CheckoutButton.tsx
'use client'

export function CheckoutButton({ membershipPlan }: { membershipPlan: string | null }) {
  async function handleClick() {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'onboarding_membership', membershipPlan: membershipPlan || 'standard' }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  return (
    <button
      onClick={handleClick}
      style={{ backgroundColor: '#944fed', color: '#fff', padding: '14px 32px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}
    >
      Complete membership
    </button>
  )
}
```

- [ ] **Step 2: Create the main page**

```typescript
// src/app/signup/resume/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'
import { cookies } from 'next/headers'

interface Props {
  searchParams: { session_id?: string; canceled?: string }
}

export default async function ResumePage({ searchParams }: Props) {
  const session = await getServerSession()
  if (!session || session.role !== 'patient') {
    redirect('/patient/login?next=/signup/resume')
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, session.patientId!),
  })

  if (!patient) redirect('/patient/login')

  let status = patient.onboarding_status

  // Active patients don't need this screen
  if (status === 'active') redirect('/patient/dashboard')

  // Stripe redirected back after successful payment — confirm synchronously
  if (searchParams.session_id && status === 'verified') {
    try {
      const stripe = getStripe()
      const stripeSession = await stripe.checkout.sessions.retrieve(searchParams.session_id)
      if (stripeSession.payment_status === 'paid' || stripeSession.status === 'complete') {
        await db
          .update(patients)
          .set({
            onboarding_status: 'paid',
            membership_plan: stripeSession.metadata?.membershipPlan ?? null,
          })
          .where(eq(patients.id, session.patientId!))
        status = 'paid'
      }
    } catch (err) {
      console.error('Stripe session confirmation error:', err)
    }
  }

  const showCanceled = !!searchParams.canceled

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f3ee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '48px',
        maxWidth: '520px',
        width: '100%',
      }}>
        {status === 'unverified' && <UnverifiedStep />}
        {status === 'verified' && <VerifiedStep canceled={showCanceled} membershipPlan={patient.membership_plan} />}
        {status === 'paid' && <PaidStep />}
      </div>
    </div>
  )
}

function UnverifiedStep() {
  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>Step 1 of 3</p>
      <h1 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>Verify your email</h1>
      <p style={{ margin: '0 0 32px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
        We sent a verification link to your email. Click it to continue.
      </p>
      <Link href="/signup/verify" style={{ display: 'inline-block', backgroundColor: '#944fed', color: '#fff', padding: '14px 32px', borderRadius: '100px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }}>
        Resend email
      </Link>
    </>
  )
}

function VerifiedStep({ canceled, membershipPlan }: { canceled: boolean; membershipPlan: string | null }) {
  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>Step 2 of 3</p>
      <h1 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>Complete your membership</h1>
      {canceled && (
        <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#c0392b' }}>Payment was canceled. You can try again below.</p>
      )}
      <p style={{ margin: '0 0 32px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
        Your email is verified. Complete your membership to access the intake form and meet with Dr. Urban.
      </p>
      <CheckoutButton membershipPlan={membershipPlan} />
    </>
  )
}

function PaidStep() {
  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>Step 3 of 3</p>
      <h1 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: 400, color: '#280f49' }}>Start your intake</h1>
      <p style={{ margin: '0 0 32px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
        Your membership is active. Complete your health intake to prepare for your first visit.
      </p>
      <Link href="/welcome" style={{ display: 'inline-block', backgroundColor: '#944fed', color: '#fff', padding: '14px 32px', borderRadius: '100px', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }}>
        Start intake
      </Link>
    </>
  )
}

// CheckoutButton is imported from ./CheckoutButton (client component — see Step 1)
```

Import it at the top of `page.tsx`:
```typescript
import { CheckoutButton } from './CheckoutButton'
```

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/signup/resume/page.tsx src/app/signup/resume/CheckoutButton.tsx
git commit -m "feat: /signup/resume — resumption screen with Stripe session confirmation"
```

---

### Task 10: Update Stripe checkout API for onboarding_membership type

**Files:**
- Modify: `src/app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Add the onboarding_membership branch**

In the existing checkout route, add handling for `type === 'onboarding_membership'` at the top of the POST handler. First, **replace** the existing body parsing line:

```typescript
// BEFORE (existing line — replace it):
const { intakeId: bodyIntakeId, patientEmail, addMembership } = await req.json()

// AFTER (replacement — reads all fields at once):
const body = await req.json()
const { intakeId: bodyIntakeId, patientEmail, addMembership, type, membershipPlan } = body
```

Then add the `onboarding_membership` handler block immediately after the body parsing, before the existing `if (bodyIntakeId)` logic. Also add `profiles` to the imports from `@/lib/db/schema`.

```typescript
// src/app/api/stripe/checkout/route.ts

// ── Onboarding membership flow ─────────────────────────────────────────────────
if (type === 'onboarding_membership') {
  const patientId = authSession.patientId
  if (!patientId) {
    return NextResponse.json({ error: 'Patient record not found' }, { status: 400 })
  }

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Get or create Stripe customer
  let customerId: string | undefined
  const subscription = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.patient_id, patientId), isNotNull(subscriptions.stripe_customer_id)),
  })
  if (subscription?.stripe_customer_id) {
    customerId = subscription.stripe_customer_id
  }

  // Get patient email from profile
  const patientProfile = await db.query.profiles.findFirst({
    where: eq(profiles.id, authSession.userId!),
    columns: { email: true },
  })

  // TODO: replace STRIPE_PRICES.membership with plan-specific price ID when plans are finalized
  const priceId = STRIPE_PRICES.membership
  if (!priceId) {
    return NextResponse.json({ error: 'Membership price not configured' }, { status: 500 })
  }

  const stripeSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    ...(customerId ? { customer: customerId } : { customer_email: patientProfile?.email }),
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      type: 'onboarding_membership',
      patientId,
      membershipPlan: membershipPlan || 'standard',
    },
    success_url: `${origin}/signup/resume?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/signup/resume?canceled=true`,
  })

  return NextResponse.json({ sessionId: stripeSession.id, url: stripeSession.url })
}
// ── End onboarding membership flow ────────────────────────────────────────────
```

Also add `profiles` to the imports at the top of the file.

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "feat: stripe checkout — onboarding_membership type"
```

---

### Task 11: Update Stripe webhook for onboarding_membership

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Add onboarding_membership case to the webhook**

In the `checkout.session.completed` switch block (around line 58), add after the existing `membership` case:

```typescript
} else if (metadata.type === 'onboarding_membership') {
  // New patient onboarding: update status to paid, create subscription record
  await handleOnboardingMembership({
    patientId: metadata.patientId,
    membershipPlan: metadata.membershipPlan || 'standard',
    stripeCustomerId: customerId,
    stripeSubscriptionId:
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as any)?.id || null,
  })
}
```

Then add the handler function at the bottom of the file:

```typescript
async function handleOnboardingMembership(data: {
  patientId: string
  membershipPlan: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}) {
  const { patientId, membershipPlan, stripeCustomerId, stripeSubscriptionId } = data

  // Advance patient to paid (idempotent) — status is confirmed synchronously by
  // /signup/resume when Stripe redirects back, but the webhook is the authoritative write
  await db
    .update(patients)
    .set({
      onboarding_status: 'paid',
      membership_plan: membershipPlan,
    })
    .where(eq(patients.id, patientId))

  // Reuse existing subscription record creation
  await handleMembershipStart({
    intakeId: null as any,   // no intake at this stage — OK, handleMembershipStart uses it only for intake.paid update
    patientId,
    stripeCustomerId,
    stripeSubscriptionId,
  })
}
```

**Note:** `handleMembershipStart` updates `intakes.paid` for the given `intakeId`. Since there is no intake yet, pass `null` — `handleMembershipStart` will attempt to update intakes where `id = null`, which is a no-op (no rows match). The subscription record creation part runs correctly. Verify this by reading the existing `handleMembershipStart` implementation — if it throws on null intakeId, add a guard: wrap the intake update in `if (data.intakeId)`.

Add `patients` to the import from `@/lib/db/schema` at the top of the file.

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: stripe webhook — handle onboarding_membership, update patient status to paid"
```

---

### Task 12: Create `/welcome` pre-intake screen

**Files:**
- Create: `src/app/welcome/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// src/app/welcome/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from '@/lib/getServerSession'
import { db } from '@/lib/db'
import { patients } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function WelcomePage() {
  const session = await getServerSession()
  if (!session || session.role !== 'patient') {
    redirect('/patient/login?next=/welcome')
  }

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, session.patientId!),
    columns: { onboarding_status: true },
  })

  const status = patient?.onboarding_status
  if (status === 'active') redirect('/patient/dashboard')
  if (status !== 'paid') redirect('/signup/resume')

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f3ee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '48px',
        maxWidth: '520px',
        width: '100%',
        textAlign: 'center',
      }}>
        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(66,42,31,0.45)' }}>
          Womenkind Health
        </p>
        <h1 style={{ margin: '0 0 20px', fontSize: '30px', fontWeight: 400, color: '#280f49', lineHeight: 1.3 }}>
          Your intake takes about 15 minutes
        </h1>
        <p style={{ margin: '0 0 40px', fontSize: '16px', color: 'rgba(66,42,31,0.7)', lineHeight: 1.6 }}>
          Everything you share goes directly to Dr. Urban to prepare your first visit. Your answers are private and secure.
        </p>
        <Link
          href="/intake"
          style={{
            display: 'inline-block',
            backgroundColor: '#944fed',
            color: '#ffffff',
            padding: '16px 40px',
            borderRadius: '100px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '16px',
          }}
        >
          Begin intake
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/welcome/page.tsx
git commit -m "feat: /welcome pre-intake screen"
```

---

### Task 13: Replace dark intake with light intake

**Files:**
- Modify: `src/app/intake/page.tsx` (replace content with light theme)
- Delete: `src/app/intake2/page.tsx`

- [ ] **Step 1: Read both intake files**

Open `src/app/intake2/page.tsx` and note what differs from `src/app/intake/page.tsx`. The key differences are: dark vs light theme, and the redirect after submit (intake redirects to `/intake/payment?intake_id=X`, intake2 redirects to `/intake/complete`).

- [ ] **Step 2: Replace intake/page.tsx with intake2 content**

Copy the full content of `src/app/intake2/page.tsx` into `src/app/intake/page.tsx`. The submit redirect in the light theme (`/intake/complete`) is the correct behavior for the new flow.

- [ ] **Step 3: Delete intake2**

```bash
rm src/app/intake2/page.tsx
```

- [ ] **Step 4: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/intake/page.tsx
git rm src/app/intake2/page.tsx
git commit -m "feat: replace dark intake with light theme (was /intake2)"
```

---

### Task 14: Update intake submit API to set onboarding_status = active

**Files:**
- Modify: `src/app/api/intake/submit/route.ts`

- [ ] **Step 1: Locate the exact insertion point**

Open `src/app/api/intake/submit/route.ts`. The route already imports `patients` (line 9) and has `export const maxDuration = 300` (line 12) — do not touch either. Do not touch `generateClinicalBrief()` or any of the brief/component generation logic.

Find line 98: `// Send intake confirmation emails (fire and forget)`. The `onboarding_status` update goes **immediately before this line** — after the intake is submitted and WMI/brief are processed, but before emails fire.

- [ ] **Step 2: Add the status update**

Insert the following block at line 98, pushing the email send down:

```typescript
// Advance patient to active now that intake is submitted.
// Brief generation failing (above) should NOT block this — the brief can be
// regenerated via /api/generate-briefs. Patients stuck at 'paid' can't reach
// their dashboard.
if (patientId) {
  await db
    .update(patients)
    .set({ onboarding_status: 'active' })
    .where(eq(patients.id, patientId))
    .catch((err) => console.error('Failed to advance onboarding_status:', err))
}
```

The `.catch()` keeps existing error tolerance — a DB update failure won't break the submission response. `patientId` is already resolved from `req.json()` at the top of the route.

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/intake/submit/route.ts
git commit -m "feat: intake submit sets onboarding_status=active after brief generation"
```

---

### Task 15: Add onboarding guard to patient dashboard

**Files:**
- Modify: `src/app/patient/dashboard/page.tsx`

- [ ] **Step 1: Add guard at the top of the server component**

Open `src/app/patient/dashboard/page.tsx`. At the top of the default export (after the dev bypass check), add:

```typescript
// Skip guard in dev (RDS not reachable locally)
if (process.env.NODE_ENV !== 'development') {
  const { db } = await import('@/lib/db')
  const { patients } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const patient = await db.query.patients.findFirst({
    where: eq(patients.id, session.patientId!),
    columns: { onboarding_status: true },
  })

  if (patient && patient.onboarding_status !== 'active') {
    redirect('/signup/resume')
  }
}
```

Add `import { redirect } from 'next/navigation'` at the top if not already present.

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/patient/dashboard/page.tsx
git commit -m "feat: patient dashboard redirects to /signup/resume if onboarding incomplete"
```

---

### Task 16: Delete old pages

**Files:**
- Delete: `src/app/get-started/page.tsx`
- Delete: `src/app/intake/payment/page.tsx`
- Delete: `src/app/intake/payment2/page.tsx`

- [ ] **Step 1: Delete the files**

```bash
git rm src/app/get-started/page.tsx
git rm src/app/intake/payment/page.tsx 2>/dev/null || true
git rm src/app/intake/payment2/page.tsx 2>/dev/null || true
```

- [ ] **Step 2: Search for any remaining references to these routes**

```bash
grep -r "get-started\|/intake/payment" src/ --include="*.tsx" --include="*.ts" -l
```

If any files still reference these routes, update them to point to `/join` (for `get-started`) or remove the references (for `/intake/payment`).

- [ ] **Step 3: Run tsc**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove /get-started and /intake/payment legacy pages"
```

---

### Task 17: Deploy and verify end-to-end

- [ ] **Step 1: Final tsc check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Deploy to production**

```bash
vercel deploy --prod
```

- [ ] **Step 3: Run DB migration**

```bash
curl -X POST https://womenkind.vercel.app/api/debug/migrate-onboarding \
  -H "x-migration-secret: $CRON_SECRET"
```

Expected: `{"ok":true}`

- [ ] **Step 4: Verify the funnel end-to-end**

Walk through the full flow manually:

1. Visit `/join` — three plan cards render, clicking "Get started" navigates to `/signup?plan=standard`
2. Create a test account — `onboarding_status` should be `unverified` in DB
3. Check email — verification email arrives from Resend
4. Click verification link — lands on `/signup/verified`, redirects to `/signup/resume` showing Step 2
5. Click "Complete membership" — Stripe checkout opens with subscription mode
6. Complete Stripe payment — redirects to `/signup/resume?session_id=X`, status updates to `paid`, Step 3 shown
7. Click "Start intake" — `/welcome` renders correctly
8. Click "Begin intake" — `/intake` opens (light theme)
9. Complete and submit intake — `onboarding_status` becomes `active`, redirects to dashboard
10. Confirm dashboard loads without redirect loop

- [ ] **Step 5: Verify existing patients are unaffected**

Log in as `josephurbanmd@gmail.com` (provider) and as a patient with an existing submitted intake. Confirm:
- Provider dashboard loads normally
- Patient dashboard loads without redirect to `/signup/resume` (existing patients have `onboarding_status = 'active'` from the column default)

- [ ] **Step 6: Commit any fixes, then final confirmation**

```bash
git add -A
git commit -m "fix: post-deploy corrections from end-to-end verification"
```
