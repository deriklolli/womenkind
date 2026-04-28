# Claude Design Prompt — Womenkind Health Tracker

---

I'm building a health tracker / scorecard for Womenkind, a telehealth menopause care platform. The tracker shows a patient's full journey — where they started, how they're trending, and what's changed since beginning treatment.

## Brand
Womenkind's palette: deep aubergine (#280f49), violet (#944fed), warm cream (#f7f3ee), terracotta (#c97c5d), warm white (#ffffff). Typography is a mix of a serif (Georgia/Playfair Display) for headlines and a clean sans-serif (Plus Jakarta Sans) for body. The aesthetic is warm, premium, and reassuring — not clinical.

## What I Need Designed

### Screen 1: Patient Tracker (Mobile)
The patient's personal view. Think of it as a health story, not a medical chart.

**Key sections, top to bottom:**
1. **Journey header** — "You've been with Womenkind for 4 months" with a warm illustration or abstract shape. Shows: months in care, visits completed, current treatment phase.
2. **Overall wellness score** — A large, prominent number (e.g., 7.4/10) with a trend arrow. Subtext: "Up 3.1 points since you started." Color the number green/violet if trending up.
3. **Symptom trend chart** — A smooth line chart showing 6 domains over time (Vasomotor, Sleep, Mood, Energy, Brain Fog, Genitourinary). Mobile-friendly — swipeable or tabbed by domain. Show the baseline (intake) as a faded starting point and the trend curving upward. Gradient fill under the line. No harsh gridlines.
4. **Domain score cards** — 6 cards in a 2-column grid. Each shows the domain name, current score out of 10, and delta from baseline (e.g., "↑ +3.2"). Color-code: violet/green for improving, amber for stable, soft red for declining.
5. **Wins board** — A warm card with 2–3 auto-generated celebration moments. E.g., "Hot flash frequency dropped significantly since starting treatment." "You've logged 8 weeks in a row." Feels like a coach celebrating with you.
6. **Timeline strip** — A horizontal (or vertical) timeline of key events: intake, first consultation, treatment start, each follow-up. Minimal dots-and-lines style.
7. **Next appointment CTA** — Card showing the next visit date and a button to "Log this week's symptoms."

**Tone:** Warm, encouraging, celebratory. This is a patient who is finally getting answers after years of being dismissed. Every improvement should feel meaningful.

---

### Screen 2: Weekly Check-In Flow (Mobile)
A 60-second swipe-through that patients complete weekly.

- 6 screens, one per domain: Vasomotor, Sleep, Mood, Energy, Brain Fog, Genitourinary
- Each screen: domain name, a 1–2 sentence description of what to rate, and a large slider (0 = very bad, 10 = great)
- Optional free-text note at the end: "Anything you want Dr. Urban to know?"
- Final screen: confirmation with a streak counter ("Week 9! Keep it up.")

**Style:** Full-screen cards, one question at a time. Smooth transitions. The slider should feel satisfying to interact with — large thumb, soft haptic-style animation on mobile.

---

### Screen 3: Provider Tracker View (Web / Tablet)
The doctor's view of the same data. More data-dense, clinically focused.

- Same overall layout but with additional clinical context
- Symptom trend chart shows all 6 domains simultaneously (multi-line chart, color-coded)
- Domain cards include the raw numeric scores and change values
- A "Clinical Timeline" section showing visit dates, SOAP note excerpts, and treatment changes
- A treatment response column: "What was started" → "Score change since"
- Export to PDF button (single-page scorecard snapshot)

**Tone:** Professional, precise, efficient. Dr. Urban needs to scan this in 30 seconds before a visit and know exactly where the patient stands.

---

## Constraints
- Mobile-first for the patient view (this will be a native mobile app)
- The provider view will be web/tablet
- Use the Womenkind brand palette — no cold blues or clinical whites
- Avoid medical jargon in patient-facing copy. "Energy" not "fatigue score." "How you feel" not "symptom burden."
- The tracker should feel like progress, not surveillance

## Reference Data (example patient)
For mocking up the designs, here's a realistic data set:

**Patient:** 52-year-old woman, 4 months into HRT (estradiol patch + progesterone)
**Baseline scores (intake, Month 0):** Vasomotor 2, Sleep 3, Mood 3, Energy 2, Brain Fog 3, GSM 4
**Month 1 scores:** Vasomotor 3, Sleep 4, Mood 4, Energy 3, Brain Fog 3, GSM 4
**Month 2 scores:** Vasomotor 5, Sleep 6, Mood 6, Energy 5, Brain Fog 5, GSM 5
**Month 3 scores:** Vasomotor 7, Sleep 7, Mood 7, Energy 6, Brain Fog 6, GSM 6
**Current (Month 4):** Vasomotor 8, Sleep 8, Mood 7, Energy 7, Brain Fog 7, GSM 7
**Overall score trend:** 2.8 → 3.5 → 5.3 → 6.8 → 7.4

**Timeline events:**
- Month 0, Day 1: Intake completed
- Month 0, Day 3: Initial consultation with Dr. Urban
- Month 0, Day 5: Estradiol 0.05mg patch started, progesterone 100mg nightly
- Month 1, Day 30: Follow-up — "Noticing improvement in sleep, hot flashes still frequent"
- Month 2, Day 5: Dose adjusted — estradiol increased to 0.075mg
- Month 2, Day 30: Follow-up — "Significant improvement, mood much better"
- Month 4: Current

**Wins to show:**
- "Hot flashes improved from severe (10+/day) to mild (1–2/day)"
- "Sleep score doubled since you started"
- "You've logged 16 consecutive weeks"

---

Please design all three screens. I'd love to see the full patient tracker first, then the check-in flow, then the provider view.
