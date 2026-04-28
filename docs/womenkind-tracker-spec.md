# Womenkind Health Tracker — Product Spec

## What This Is

A visual health scorecard and progress tracker for menopause patients. It shows a patient's entire journey with Womenkind in one place — where they started, how they're doing now, and the trajectory over time. Both the patient and doctor can view it.

The patient sees it as a personal health story. The doctor sees it as a clinical snapshot.

---

## The Core Idea

Every Womenkind patient has a baseline (their intake form) and a series of touchpoints after that — visits, prescriptions, check-ins, presentations. The tracker connects those dots into a single, readable visual that answers:

- **Patient:** "Am I getting better?"
- **Doctor:** "Is my treatment working?"

---

## Data Available Today

| Source | Data |
|--------|------|
| Intake form | Baseline symptom severity self-ratings (None / Mild / Moderate / Severe / Very severe) across 15+ domains |
| Visit symptom_scores | Numeric scores (0–10) for: vasomotor, sleep, energy, mood, gsm, overall |
| Encounter notes | SOAP notes — chief complaint, HPI, assessment, plan |
| Care presentations | Care blueprint snapshots per visit |
| Subscriptions | Membership start date, plan type |

**Coming from mobile app:** Weekly symptom check-ins (same 6 domains as visit scores, submitted by patient between appointments).

---

## Sections of the Tracker

### 1. Journey Overview (Hero)
- Start date with Womenkind
- Total weeks / months in care
- Number of visits completed
- Current treatment phase (e.g., "Month 3 of HRT")
- A single headline metric: "Overall wellness up 42% since you started"

### 2. Symptom Trend Chart
A line chart showing scores over time for each domain.

**Domains:**
- Vasomotor (hot flashes / night sweats)
- Sleep
- Mood
- Energy
- Brain fog / Cognition
- Genitourinary (GSM)

**X-axis:** Time (week-by-week once mobile check-ins exist; visit-by-visit for now)
**Y-axis:** Score 0–10 (10 = best)
**Baseline:** The intake severity rating maps to a starting score
**Each data point:** Visit score or weekly check-in

The chart should show the trend line clearly — the emotional payoff is watching the line go up.

### 3. Domain Score Cards
Six cards, one per domain. Each shows:
- Current score (large number)
- Change from baseline (e.g., ↑ +3.2 pts)
- Trend direction (improving / stable / needs attention)
- Color coding: green = improving, amber = stable, red = declining

### 4. Treatment Timeline
A vertical timeline of key events:
- Intake completed
- First consultation
- Each prescription or treatment change (doctor-entered)
- Each care presentation sent
- Milestone moments ("3 months on estradiol patch")

This gives both patient and doctor a clean audit trail of what was tried and when.

### 5. Visit History
A list of past visits with:
- Date
- Visit type (Initial Consultation, Follow-up)
- Key clinical notes (brief excerpt from SOAP assessment)
- Symptom score snapshot at that visit

### 6. Wins Board (Patient-facing only)
Celebrates improvements in plain language:
- "Hot flash frequency dropped from 6–10/day to 1–2/day"
- "Sleep score improved by 4 points since starting progesterone"
- "3 months of consistent weekly check-ins"

These are auto-generated from score deltas and treatment milestones.

### 7. Next Steps
- Upcoming appointment date and type
- Any outstanding action items from last visit
- Reminder to log weekly symptoms (once mobile app exists)

---

## Two Views

### Patient View
- Warm, encouraging tone
- Plain language labels (no medical jargon)
- Emphasis on progress, wins, trajectory
- Scores framed as "how you feel" not clinical numbers
- No raw SOAP note content

### Provider View
- All the same data + clinical context
- Raw symptom scores and deltas
- SOAP note excerpts visible
- Risk flags from intake still visible
- Treatment response notes

---

## Scorecard at a Glance (PDF / Print Export)
A single-page snapshot of the patient's current state:
- Patient name, age, months in care
- Six domain scores as a spider/radar chart
- Overall wellness score and trend
- Current treatment summary
- Last visit date + next appointment
- Prepared by Dr. Urban, Womenkind

---

## Technical Notes (for the engineering brief)

**Baseline scoring:** The intake form uses 5-point severity scales (None=0, Mild=2, Moderate=5, Severe=7, Very Severe=10 — inverted so higher = worse). For the tracker these need to be inverted (higher = better) and stored as a t=0 data point.

**Score normalization:** Visit `symptom_scores` are already 0–10. Intake scores need a one-time conversion function.

**Data model addition needed:**
```
weekly_checkins table:
  id, patient_id, logged_at,
  vasomotor, sleep, energy, mood, gsm, brain_fog, overall,
  notes (optional free text)
```

**APIs needed:**
- `GET /api/patient/tracker` — returns full tracker data (timeline, scores, visits, milestones)
- `POST /api/patient/checkin` — mobile weekly check-in submission
- `GET /api/provider/tracker/[patientId]` — provider view of same data

---

## Design Direction

**Patient view:** Warm cream and violet palette (on-brand Womenkind). Large, readable typography. Feels like a personal wellness journal, not a medical chart. Celebratory micro-moments when scores improve.

**Provider view:** Same palette but more data-dense. Tabular where needed. Clinical precision without feeling cold.

**Chart style:** Smooth line chart, no harsh gridlines. Gradient fill under the line. Data points marked on hover/tap. Mobile-first (this will live in the app).

**Mobile-first:** The weekly check-in flow is a simple swipe-through of 6 sliders (one per domain) taking under 60 seconds. Streak tracking for consecutive weeks logged.
