# Womenkind MVP — Architecture & Build Plan

**Prepared:** April 2, 2026
**Purpose:** Investor demo — functional, polished, shows full patient-to-provider flow
**Target:** Deployable on Vercel with Supabase backend

---

## What the MVP Does

A patient visits womenkind.com, completes a premium AI-powered intake questionnaire, pays $650 for the intake and enrolls in a $200/month membership, and her provider receives a structured AI-generated clinical brief before their first conversation.

That's the entire demo flow. It proves three things to investors:

1. The AI intake is real and clinically meaningful — not a basic form
2. The subscription billing architecture works (intake fee + recurring membership)
3. The provider experience is differentiated — they open a pre-built clinical brief, not raw notes

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PATIENT SIDE                          │
│                                                         │
│  Landing Page → Intake Questionnaire → Payment → Portal │
│       ↓              ↓                    ↓        ↓    │
│   Marketing    AI-adaptive flow      Stripe     Dashboard│
│   + SEO        8 clinical domains    Checkout   + Status │
└────────────────────────┬────────────────────────────────┘
                         │
                    Supabase DB
                    (RLS + Auth)
                         │
┌────────────────────────┴────────────────────────────────┐
│                   PROVIDER SIDE                          │
│                                                         │
│  Provider Login → Patient Queue → AI Clinical Brief     │
│       ↓               ↓              ↓                  │
│  Supabase Auth   Intake list    4-tab brief view        │
│   (role-based)   with status    + annotation tools      │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14 (App Router) | Your existing expertise; SSR for SEO pages, client components for intake |
| Auth | Supabase Auth | Built into Supabase — no extra dependency. Role-based via profiles table (patient vs. provider), RLS policies enforce access. Custom auth forms match the brand exactly. |
| Database | Supabase (Postgres + RLS) | Row-level security for PHI isolation, real-time subscriptions for provider queue |
| Payments | Stripe | $650 one-time + $200/mo subscription, provider fee pass-through modeling |
| AI | Anthropic Claude API | Adaptive questionnaire branching, intake summarization, clinical brief generation |
| Hosting | Vercel | Your existing deployment workflow |
| Styling | Tailwind CSS | Fast, matches brand guide application |
| File storage | Supabase Storage | Consent forms, uploaded documents (if needed for demo) |

---

## The Five Builds

### Build 1: Project Foundation
**What:** Scaffold Next.js project, configure Supabase (DB + Auth) + Stripe, apply brand identity, deploy skeleton to Vercel.

- `create-next-app` with App Router + TypeScript
- Supabase project + initial schema (profiles, patients, providers, intakes tables)
- Supabase Auth configured with email/password sign-up + magic link option
- `profiles` table with `role` column (`patient` | `provider`) auto-created on sign-up via database trigger
- RLS policies: patients see only their own data, providers see assigned intakes
- Custom branded auth pages (sign-up, sign-in, forgot password) — no third-party auth UI
- Stripe products: `womenkind-intake` ($650 one-time) and `womenkind-membership` ($200/mo recurring)
- Brand guide applied: colors, typography, logo, global styles
- Landing page with hero, value prop, and "Begin Your Intake" CTA
- Deploy to Vercel — live URL from day one

**Deliverable:** Branded landing page live at a real URL. Auth works. Stripe test mode active.

---

### Build 2: AI-Powered Intake Questionnaire
**What:** The core product — adaptive, branching clinical questionnaire powered by Claude API.

**Clinical domains (8):**
1. Demographics + medical history
2. Vasomotor symptoms (hot flashes, night sweats)
3. Sleep quality and patterns
4. Mood, cognitive function, and mental health
5. Genitourinary / GSM symptoms
6. Sexual health
7. Bone health, cardiovascular, and metabolic risk
8. Treatment preferences and prior treatments

**How it works:**
- Typeform-style one-question-at-a-time UX (deep purple background, orange accents)
- Claude API handles branching logic: if patient reports severity 0 on a domain, skip the deep-dive questions
- Progress indicator shows completion
- Answers persist to Supabase in real-time (patient can pause and resume)
- On completion: triggers AI clinical brief generation (Build 3)

**Key improvement over the existing Typeform:**
- Adaptive — doesn't waste time on irrelevant domains
- Structured data — not free text dumps
- Psychological safety framing before sensitive sections (sexual health, mental health)
- Medication section uses structured inputs, not a single text box

**Deliverable:** Patient can complete full intake. Data saved to Supabase. Smooth, branded UX.

---

### Build 3: AI Clinical Brief Generation
**What:** After intake submission, Claude API processes all answers and generates a structured clinical brief for the provider.

**Brief has four sections:**

| Tab | Contents |
|-----|----------|
| **Symptom Summary** | Severity-ranked symptom map across all 8 domains, with patient's own language preserved alongside clinical terminology |
| **Risk Flags** | Contraindications, red flags, family history items that affect treatment selection (e.g., breast cancer history → different MHT approach) |
| **Treatment Pathway** | Evidence-based options ranked by clinical fit — MHT, non-hormonal, GSM-specific, combination — grounded in IMS/menopause toolkit guidelines |
| **Suggested Questions** | Conversation starters for the provider based on what the patient reported — saves the provider from re-asking what's already been covered |

**Important:** The brief is explicitly NOT a diagnosis. It's a structured pre-visit summary. The provider reviews, annotates, and makes all clinical decisions.

**Deliverable:** Submitting the intake generates a polished clinical brief viewable on the provider side.

---

### Build 4: Provider Dashboard
**What:** Where the provider logs in, sees their patient queue, and reviews AI-generated clinical briefs.

**Views:**
- **Patient queue** — list of completed intakes, sorted by submission date, with status indicators (new / reviewed / care plan sent)
- **Clinical brief viewer** — the four-tab brief from Build 3, with the ability to add annotations and notes
- **Patient profile** — demographics, intake history, membership status

**For the demo:** Single provider login. All intakes route to one provider. The multi-provider / licensure-routing architecture is modeled in the database schema but not exposed in the UI yet.

**Deliverable:** Provider can log in, see a patient queue, open any brief, and annotate it.

---

### Build 5: Payment Flow + Patient Portal
**What:** Stripe integration for the $650 intake + $200/mo membership, plus a basic patient-facing portal.

**Payment flow:**
- After completing the intake questionnaire, patient hits the payment gate
- Stripe Checkout for the $650 intake fee
- On successful payment: prompt to enroll in $200/mo membership (optional for demo, but shows the model)
- Webhook confirms payment → marks intake as "submitted" → appears in provider queue

**Patient portal (minimal for demo):**
- Login → see intake status ("Submitted", "Under Review", "Care Plan Ready")
- View their own intake summary (patient-facing version, not the clinical brief)
- Membership status and billing

**Deliverable:** Full payment flow works in Stripe test mode. Patient can see their status after paying.

---

## Database Schema (Simplified)

```sql
-- Core tables
profiles (
  id uuid PK (= auth.users.id),
  email text,
  role text,               -- 'patient' | 'provider'
  first_name text,
  last_name text,
  created_at timestamptz
)
-- Auto-created via trigger on auth.users insert

patients (
  id uuid PK,
  profile_id uuid FK → profiles UNIQUE,
  date_of_birth date,
  state text,              -- for future licensure routing
  phone text,
  created_at timestamptz
)

providers (
  id uuid PK,
  profile_id uuid FK → profiles UNIQUE,
  credentials text,        -- MD, NP, etc.
  licensed_states text[],   -- array for future routing
  created_at timestamptz
)

intakes (
  id uuid PK,
  patient_id uuid FK → patients,
  provider_id uuid FK → providers (nullable until assigned),
  status text,             -- draft | submitted | reviewed | care_plan_sent
  answers jsonb,           -- structured intake responses
  ai_brief jsonb,          -- generated clinical brief
  provider_notes text,     -- provider annotations
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz
)

subscriptions (
  id uuid PK,
  patient_id uuid FK → patients,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_type text,          -- intake | membership
  status text,             -- active | canceled | past_due
  current_period_end timestamptz,
  created_at timestamptz
)
```

Row-level security: patients see only their own data. Providers see intakes assigned to them (or all, for demo).

---

## Build Sequence & Estimated Effort

| Build | Description | Depends on | Estimated sessions |
|-------|-------------|------------|-------------------|
| 1 | Project foundation + brand + deploy | Nothing | 1-2 sessions |
| 2 | AI intake questionnaire | Build 1 | 2-3 sessions |
| 3 | AI clinical brief generation | Build 2 | 1-2 sessions |
| 4 | Provider dashboard | Build 1, 3 | 1-2 sessions |
| 5 | Payment flow + patient portal | Build 1, 2 | 1-2 sessions |

Builds 3, 4, and 5 can partially overlap once Build 2 is working.

| 6 | Patient directory + progress tracking | Build 4 | 1-2 sessions |
| 7 | Prescriptions + lab orders (Canvas Medical) | Build 4, 6 | 2-3 sessions |
| 8 | Personalized patient care presentation | Build 3, 5, 6 | 2-3 sessions |

**Total estimate:** 11-18 working sessions to a polished investor demo.

---

### Build 6: Patient Directory & Progress Tracking
**What:** A persistent patient directory inside the provider dashboard — the ongoing clinical home for each patient after their initial intake.

**Why it matters for the demo:** The intake queue shows how patients enter the system. The directory shows what happens next — that this is a long-term care platform, not a one-and-done intake tool. Investors see the retention story: the provider has a living, visual record of each patient's journey.

**Navigation:**
- New "Patients" tab in the provider dashboard alongside the existing intake queue
- Queue = new intakes to triage. Directory = ongoing patients the provider is actively managing.

**Patient profile page (accessed from directory):**
- **Header:** Patient name, age, contact info, membership status, menopausal stage
- **Visit timeline:** Chronological log of all touchpoints — initial intake, follow-up visits, provider notes, status changes. Each entry is expandable with full details.
- **Symptom trend charts:** Visual graphs (Recharts) tracking key symptom domains over time:
  - Vasomotor severity (hot flashes / night sweats)
  - Sleep quality score
  - Mood & cognitive function
  - GSM symptoms
  - Overall symptom burden
  - Charts show data points per visit so the provider can see trajectory at a glance
- **Current treatment:** Active treatment plan summary (populated from provider notes/annotations)
- **Link to original AI clinical brief:** One click back to the 4-tab brief from Build 3

**New database table:**
```sql
visits (
  id uuid PK,
  intake_id uuid FK → intakes,
  patient_id uuid FK → patients,
  provider_id uuid FK → providers,
  visit_type text,           -- 'intake' | 'follow_up' | 'check_in'
  visit_date timestamptz,
  symptom_scores jsonb,      -- { vasomotor: 7, sleep: 5, mood: 6, gsm: 3, overall: 5 }
  provider_notes text,
  treatment_updates text,
  created_at timestamptz
)
```

**Demo seeding:** For the investor demo, we pre-populate 2-3 patients with multiple visits so the trend charts have meaningful data showing symptom improvement over time. This tells the story: "Patient started at severity 8 for hot flashes, and after 3 months on MHT she's down to a 3."

**Deliverable:** Provider can switch to the Patients tab, see a searchable directory of active patients, open any patient's profile, and view their visit history with visual symptom trend charts.

---

### Build 7: Prescriptions & Lab Orders (Canvas Medical Integration)
**What:** Integrate Canvas Medical's FHIR R4 API so Dr. Urban can order prescriptions and labs directly from the Womenkind provider dashboard — no need to context-switch into a separate EMR.

**Why it matters for the demo:** This is the "he never has to leave" moment. Investors see a provider who reviews an AI clinical brief, checks the patient's progress charts, writes a prescription, and orders labs — all in one interface. It positions Womenkind as a platform that *replaces* the clunky EMR experience, not just another tool bolted alongside it.

**Canvas Medical API capabilities we'll use:**

| Function | Canvas API | What it does |
|----------|-----------|--------------|
| E-Prescribing | `PrescribeCommand` via SDK | Create, sign, and electronically send prescriptions to pharmacies |
| Lab Orders | `LabOrderCommand` via SDK | Create, sign, and electronically send lab orders to partners (Quest, Labcorp, etc.) |
| Patient sync | FHIR R4 `Patient` resource | Keep Womenkind patient records in sync with Canvas |
| Medication history | FHIR R4 `MedicationRequest` | Pull existing medications into the patient profile |

**Provider UI (new sections within patient profile from Build 6):**

- **Prescriptions panel:**
  - "New Prescription" button opens a structured form: medication search, dosage, frequency, quantity, refills, pharmacy selection
  - Provider signs (confirms) and prescription is sent electronically via Canvas
  - Prescription history list with status (sent, filled, refill due)
  - Common menopause prescriptions as quick-pick templates (estradiol, progesterone, ospemifene, etc.)

- **Lab Orders panel:**
  - "Order Labs" button opens structured form: lab partner, test panel selection, clinical indication
  - Common menopause lab panels as templates (hormone panel: FSH/LH/estradiol/testosterone, thyroid panel, lipid panel, bone density markers)
  - Provider signs and order is sent electronically to lab partner
  - Lab order history with status (ordered, collected, results available)
  - When results come back: flag abnormals and surface in the patient's symptom trend view (Build 6)

**Setup requirements:**
- Canvas Medical account with API access (developer sandbox available for demo)
- Lab partner configuration in Canvas (electronic ordering must be enabled)
- Provider NPI and DEA registration linked in Canvas for e-prescribing
- `CANVAS_API_CLIENT_ID`, `CANVAS_API_CLIENT_SECRET`, `CANVAS_API_BASE_URL` env vars

**New database tables:**
```sql
prescriptions (
  id uuid PK,
  patient_id uuid FK → patients,
  provider_id uuid FK → providers,
  visit_id uuid FK → visits (nullable),
  canvas_prescription_id text,    -- Canvas reference ID
  medication_name text,
  dosage text,
  frequency text,
  quantity integer,
  refills integer,
  pharmacy text,
  status text,                    -- 'draft' | 'signed' | 'sent' | 'filled'
  prescribed_at timestamptz,
  created_at timestamptz
)

lab_orders (
  id uuid PK,
  patient_id uuid FK → patients,
  provider_id uuid FK → providers,
  visit_id uuid FK → visits (nullable),
  canvas_order_id text,           -- Canvas reference ID
  lab_partner text,               -- 'quest' | 'labcorp' | etc.
  tests jsonb,                    -- [{ code: "TSH", name: "Thyroid Stimulating Hormone" }, ...]
  clinical_indication text,
  status text,                    -- 'draft' | 'signed' | 'sent' | 'collected' | 'results_available'
  results jsonb,                  -- lab results when returned
  ordered_at timestamptz,
  created_at timestamptz
)
```

**API integration layer:**
- `/src/lib/canvas-client.ts` — Canvas API client (OAuth2 auth, FHIR resource helpers)
- `/src/app/api/canvas/prescribe/route.ts` — create + send prescription
- `/src/app/api/canvas/labs/order/route.ts` — create + send lab order
- `/src/app/api/canvas/labs/results/route.ts` — poll/webhook for lab results
- `/src/app/api/webhooks/canvas/route.ts` — Canvas webhook handler for status updates

**Demo strategy:** Use Canvas's developer sandbox environment. Pre-configure a test provider and pharmacy so the demo shows a real electronic prescription being transmitted. For labs, demonstrate the ordering flow with a test lab partner. Seed 1-2 patients with completed lab results to show the full lifecycle.

**Deliverable:** Provider can prescribe medications and order labs from within the Womenkind patient profile, with prescription and lab history visible in the patient's record. No external EMR needed.

---

### Build 8: Personalized Patient Care Presentation
**What:** After a visit, Dr. Urban builds a personalized, scroll-driven animated presentation for the patient that explains what's happening in their body and how it will be addressed. The patient receives a unique secure link via email. Nothing like this exists in healthcare today.

**Why it matters for the demo:** This is the patient-facing "wow moment" — the counterpart to the AI clinical brief on the provider side. Investors see both sides of the experience: the provider gets a brilliant pre-visit brief, and the patient leaves with a cinematic, personalized explanation of their care. It demonstrates retention, patient education, and brand differentiation in one feature.

**The 10 clinical body system components:**

| # | Component | Visual concept | Clinical relevance to menopause |
|---|-----------|---------------|-------------------------------|
| 1 | Brain & Cognition | Neural networks firing, synapses lighting up | Brain fog, memory changes, cognitive shifts |
| 2 | Nervous System / Vasomotor | Thermoregulation pathways, heat waves radiating | Hot flashes, night sweats, temperature dysregulation |
| 3 | Metabolism & Weight | Metabolic cycle animation, cellular energy flow | Metabolic slowdown, weight redistribution, insulin sensitivity |
| 4 | Cardiovascular | Heart pulsing, blood flow through vessels | Increased CVD risk post-menopause, lipid changes |
| 5 | Bone & Skeletal | Bone density visualization, calcium matrix | Osteoporosis risk, bone density loss acceleration |
| 6 | Sleep & Circadian | Circadian wave patterns, melatonin cycles | Sleep disruption, insomnia, circadian rhythm changes |
| 7 | Mood & Mental Health | Serotonin/dopamine pathway illustration | Anxiety, depression, emotional volatility |
| 8 | Hormonal / Reproductive | Hormone level graphs animating, ovarian cycle | Estrogen/progesterone decline, FSH elevation |
| 9 | Genitourinary / GSM | Tissue health visualization (abstract, tasteful) | Vaginal atrophy, urinary symptoms, mucosal changes |
| 10 | Skin, Hair & Aging | Collagen matrix, cellular renewal animation | Collagen loss, hair thinning, skin elasticity changes |

**Provider workflow (inside patient profile from Build 6):**
- After a visit, Dr. Urban clicks "Create Care Presentation"
- Sees all 10 body system components as selectable cards with preview thumbnails
- Toggles on the components relevant to this patient (e.g., vasomotor, sleep, mood, hormonal — skip bone if not relevant)
- For each selected component, adds personalized notes: what he found, what the treatment plan is, what the patient should expect
- AI assist option: Claude can draft initial notes per component based on the intake brief and visit data — Dr. Urban reviews and edits
- Clicks "Generate & Send" — presentation is built and a secure link is emailed to the patient

**Patient experience:**
- Patient receives a branded email: "Your personalized care summary from Dr. Urban is ready"
- Clicks link → authenticates via Supabase Auth (same patient login from Build 5)
- Opens a full-screen, scroll-driven presentation:
  - **Opening:** Warm, branded welcome with patient's first name and Dr. Urban's photo/message
  - **Body silhouette anchor:** A stylized human body outline stays subtly visible as a visual thread throughout
  - **Per-component sections:** As the patient scrolls, each selected body system animates in:
    - The relevant area of the body silhouette illuminates/highlights
    - An animated SVG illustration of that system builds itself on screen (neurons connecting, heart beating, hormones flowing)
    - Clinical explanation in warm, accessible language (not jargon)
    - Dr. Urban's personalized notes appear as a "From your provider" card
    - Treatment approach and what to expect
    - Smooth parallax transition to the next system
  - **Closing:** Summary of the care plan, next steps, and a warm closing message
- Patient can revisit anytime from their portal

**Technical approach:**
- **Framer Motion** for scroll-triggered animations, entrance/exit choreography, and parallax effects
- **Lottie animations** (via `lottie-react`) for premium medical illustrations — each body system has a pre-built Lottie animation file
- **Intersection Observer** to trigger animations as sections scroll into view
- **Responsive design** — works beautifully on desktop and mobile (patients will likely view on phone)
- **Dynamic generation** — presentation is assembled at build time from the components Dr. Urban selected, not a static page

**Animation library:**
- `/public/animations/` — 10 Lottie JSON files, one per body system component
- These can be sourced from medical animation libraries (LottieFiles has medical packs) or custom-designed
- Fallback: high-quality animated SVGs with Framer Motion if Lottie assets aren't ready for demo

**New database table:**
```sql
care_presentations (
  id uuid PK,
  patient_id uuid FK → patients,
  provider_id uuid FK → providers,
  visit_id uuid FK → visits (nullable),
  intake_id uuid FK → intakes,
  selected_components jsonb,     -- ["vasomotor", "sleep", "mood", "hormonal"]
  component_notes jsonb,         -- { "vasomotor": { "provider_note": "...", "ai_draft": "..." }, ... }
  status text,                   -- 'draft' | 'generated' | 'sent' | 'viewed'
  sent_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz
)
```

**New files:**
- `/src/app/presentation/[id]/page.tsx` — the patient-facing animated presentation (public route, auth-gated)
- `/src/components/presentation/BodySilhouette.tsx` — the anchor body outline with highlight zones
- `/src/components/presentation/ComponentSection.tsx` — reusable animated section per body system
- `/src/components/presentation/PresentationIntro.tsx` — welcome/opening section
- `/src/components/presentation/PresentationClose.tsx` — closing summary and next steps
- `/src/app/provider/presentation/create/[patientId]/page.tsx` — provider-side builder UI
- `/src/app/api/presentation/generate/route.ts` — assembles presentation, triggers email
- `/src/app/api/presentation/ai-notes/route.ts` — Claude drafts component notes from intake/visit data
- `/src/lib/presentation-components.ts` — component registry (metadata, animation paths, clinical descriptions)

**Email delivery:**
- Use Supabase Edge Function or a transactional email service (Resend, recommended — simple API, great deliverability)
- Branded HTML email with Womenkind styling, one CTA button: "View Your Care Summary"
- `RESEND_API_KEY` env var

**Demo seeding:** Pre-build 1-2 completed presentations for seeded patients so the demo can show the full experience end-to-end — the provider creates one live, and the investor can also see a finished one from the patient's perspective.

**Deliverable:** Dr. Urban selects body system components after a visit, adds personalized notes (with AI assist), and sends a secure link. The patient opens a cinematic, scroll-driven animated presentation explaining their care. Viewable from any device, accessible anytime from the patient portal.

---

## What's Explicitly NOT in the MVP

These are important for production but out of scope for the investor demo:

- HIPAA compliance / BAA execution (Supabase BAA, Vercel BAA)
- Real telehealth video integration
- Multi-provider routing and licensure logic (schema supports it, UI doesn't)
- Consent / BAA patient-facing flow
- Content / SEO engine
- Menkind anything
- Employer portal
- Mobile app

All of these are Phase 2 items that build on the MVP architecture without requiring a rebuild.

---

## What Makes This Demo Compelling for Investors

1. **The AI brief is the wow moment.** A patient fills out a 20-minute questionnaire, and the provider opens a structured, clinically-grounded brief that would normally take 30+ minutes of live intake to produce. That's the product.

2. **The subscription architecture is visible.** Stripe dashboard shows $650 intake + $200/mo recurring — the revenue model is live, not a slide.

3. **It's a real URL.** Not a Figma prototype. Not a slide deck. An actual application a patient could use.

4. **The clinical credibility is baked in.** The brief cites IMS guidelines, uses proper clinical terminology, flags contraindications — it's clearly not a wellness chatbot.

5. **The provider never leaves.** Review an AI brief, check symptom trends, write a prescription, order labs — all in one UI. This isn't a tool that sits alongside the EMR. It *is* the provider's workspace.

6. **Outcomes are visible.** Symptom trend charts show patients improving over time. That's the retention and outcomes story investors want to see — not just acquisition, but long-term value.

7. **The patient experience is unrecognizable from traditional healthcare.** A personalized, animated care presentation — not a printout, not a patient portal with a wall of text. The patient scrolls through a cinematic explanation of their body, their symptoms, and their treatment plan. No one in menopause care is doing this. No one in *any* care is doing this.

---

## Key Technical Decisions to Confirm

1. **TypeScript vs JavaScript** — Recommendation: TypeScript. More upfront work but catches errors in the complex intake/billing logic.

2. **Auth** — Supabase Auth. No external auth dependency. Role management via `profiles.role` column + RLS policies. Custom branded auth UI.

3. **Questionnaire state management** — Recommendation: React state + Supabase real-time saves. No need for Redux or Zustand for this.

4. **AI brief generation timing** — Recommendation: Generate on submission (not real-time). Use Supabase edge function or Next.js API route to call Claude API, store result in `intakes.ai_brief`.

---

## Next Step

Upload the brand guide → we scaffold the project and start Build 1.
