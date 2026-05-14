# PillarTrendChart Milestone Card Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make milestone annotation cards show real, human-readable content — actual medication names, real dates, and consultation descriptions — instead of generic labels with no body text.

**Architecture:** Two files change. The API route adds a `date` field to each milestone and rewrites the title/body construction. The chart component updates the `Milestone` interface and the `AnnotationCard` render to show the date and body text. Dev fixture gets two realistic example milestones so this is testable locally.

**Tech Stack:** TypeScript, Next.js App Router, Drizzle ORM, SVG/React

---

## Context

The `AnnotationCard` component renders a header line ("WK 7 · Visit 3"), a title ("Follow-Up Consultation"), and silently drops `milestone.body`. No date is stored on the `Milestone` type — only a week number. The API builds milestones from real DB data but generates generic labels: visits say "Care team visit with Dr. Urban.", prescriptions truncate the drug name to one word. The dev fixture has `milestones: []` so none of this is testable locally.

**Target card appearance:**

Visit card:
```
[●]  May 7, 2026
     Follow-Up Consultation
     15 minute consultation
```

Rx card (single medication):
```
[●]  March 10, 2026
     Estradiol patch started
```

Rx card (multiple medications same week):
```
[●]  March 10, 2026
     3 medications started
     Estradiol patch, Progesterone, Estradiol cream
```

---

## File Map

| File | Change |
|------|--------|
| `src/app/api/patient/pillar-trend/route.ts` | Add `date: string` to `Milestone` interface; rewrite visit + rx milestone construction; add dev fixture milestones |
| `src/components/patient/PillarTrendChart.tsx` | Add `date: string` to `Milestone` interface; update `AnnotationCard` to show date and body |

---

## Task 1: Add `date` to Milestone interface and update API construction

**File:** `src/app/api/patient/pillar-trend/route.ts`

- [ ] **Step 1: Update the `Milestone` interface** (lines 17–23). Change from:

```typescript
interface Milestone {
  wk: number
  type: 'visit' | 'rx' | 'dose' | 'lab'
  short: string
  title: string
  body: string
}
```

to:

```typescript
interface Milestone {
  wk: number
  type: 'visit' | 'rx' | 'dose' | 'lab'
  short: string
  title: string
  body: string
  date: string   // ISO date string YYYY-MM-DD for display
}
```

- [ ] **Step 2: Rewrite the visit milestone construction** (lines 290–300). Remove `visitCount` entirely and replace the push with:

```typescript
  // Provider visits — deduplicate same visit_date (appointment + note create duplicate rows)
  const seenVisitDates = new Set<string>()
  for (const v of providerVisits.sort((a, b) => a.visit_date.localeCompare(b.visit_date))) {
    if (seenVisitDates.has(v.visit_date)) continue
    seenVisitDates.add(v.visit_date)
    const d = new Date(v.visit_date + 'T00:00:00')
    const wk = Math.max(0, Math.min(actualWeeks - 1, Math.floor((d.getTime() - startDate.getTime()) / MS_PER_WEEK)))
    const isInitial = v.visit_type === 'initial_consultation'
    milestones.push({
      wk,
      type: 'visit',
      short: isInitial ? 'Initial' : 'Follow-up',
      title: isInitial ? 'Initial Consultation' : 'Follow-Up Consultation',
      body: '15 minute consultation',
      date: v.visit_date,
    })
  }
```

- [ ] **Step 3: Rewrite the rx milestone construction** (lines 310–316). Replace:

```typescript
  for (const [wkStr, { names }] of Object.entries(rxByWeek)) {
    const wk = Number(wkStr)
    const label = names.length === 1 ? names[0].split(' ')[0] : 'Rx started'
    const title = names.length === 1 ? `${names[0]} Started` : 'Medications Started'
    const body = names.join(', ')
    milestones.push({ wk, type: 'rx', short: label.slice(0, 10), title, body })
  }
```

with:

```typescript
  for (const [wkStr, { names, prescribed_at }] of Object.entries(rxByWeek)) {
    const wk = Number(wkStr)
    const isSingle = names.length === 1
    milestones.push({
      wk,
      type: 'rx',
      short: 'Rx',
      title: isSingle ? `${names[0]} started` : `${names.length} medications started`,
      body: isSingle ? '' : names.join(', '),
      date: prescribed_at.toISOString().slice(0, 10),
    })
  }
```

- [ ] **Step 4: Add realistic milestones to the dev fixture** (`DEV_RESPONSE`, line 116). Replace `milestones: []` with:

```typescript
  milestones: [
    {
      wk: 0,
      type: 'visit',
      short: 'Initial',
      title: 'Initial Consultation',
      body: '15 minute consultation',
      date: DEV_START_ISO,
    },
    {
      wk: 2,
      type: 'rx',
      short: 'Rx',
      title: 'Estradiol patch started',
      body: '',
      date: (() => { const d = new Date(DEV_START_ISO); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10) })(),
    },
    {
      wk: 12,
      type: 'visit',
      short: 'Follow-up',
      title: 'Follow-Up Consultation',
      body: '15 minute consultation',
      date: (() => { const d = new Date(DEV_START_ISO); d.setDate(d.getDate() + 84); return d.toISOString().slice(0, 10) })(),
    },
  ],
```

- [ ] **Step 5: Verify tsc passes**

```bash
cd /Users/deriklolli/Projects/WOMENKIND/WomenKind && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/patient/pillar-trend/route.ts
git commit -m "feat: add date field to milestones, improve visit and rx labels"
```

---

## Task 2: Update AnnotationCard to show date and body text

**File:** `src/components/patient/PillarTrendChart.tsx`

- [ ] **Step 1: Update the `Milestone` interface** (lines 17–23). Add `date: string`:

```typescript
interface Milestone {
  wk: number
  type: 'visit' | 'rx' | 'dose' | 'lab'
  short: string
  title: string
  body: string
  date: string
}
```

- [ ] **Step 2: Add a `formatMilestoneDate` helper** after the `DOMAIN_SUBTITLES` constant (around line 59):

```typescript
function formatMilestoneDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
```

- [ ] **Step 3: Update `AnnotationCard`** (lines 155–206). Replace the return block with:

```tsx
  return (
    <div
      className="rounded-2xl p-4 cursor-default transition-all duration-[250ms]"
      style={{ background: highlighted ? accent : CREAM, color: highlighted ? 'white' : AUBERGINE }}
      onMouseEnter={() => onHover(milestoneIndex)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-[250ms]"
          style={{
            background: highlighted ? 'white' : accent,
            color: highlighted ? accent : 'white',
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-display, serif)',
            fontStyle: 'italic',
          }}
        >
          {displayNumber}
        </span>
        <span
          className="font-sans font-bold tracking-[0.18em] uppercase transition-colors duration-[250ms]"
          style={{ fontSize: 9.5, color: highlighted ? 'rgba(255,255,255,0.65)' : 'rgba(66,42,31,0.45)' }}
        >
          {formatMilestoneDate(milestone.date)}
        </span>
      </div>
      <p
        className="font-display leading-snug transition-colors duration-[250ms]"
        style={{ fontSize: 14, color: highlighted ? 'white' : AUBERGINE }}
      >
        {milestone.title}
      </p>
      {milestone.body && (
        <p
          className="font-sans leading-snug mt-1 transition-colors duration-[250ms]"
          style={{ fontSize: 12, color: highlighted ? 'rgba(255,255,255,0.75)' : 'rgba(66,42,31,0.55)' }}
        >
          {milestone.body}
        </p>
      )}
    </div>
  )
```

- [ ] **Step 4: Verify tsc passes**

```bash
cd /Users/deriklolli/Projects/WOMENKIND/WomenKind && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Visual check in dev** — run `npm run dev`, open `http://localhost:3000/patient/dashboard`, navigate to the Symptom Tracker / chart view. Confirm:
  - 3 milestone pins appear on the chart (from dev fixture)
  - Annotation cards below chart show: formatted date ("May 7, 2026"), title, and body text where non-empty
  - Hover still highlights card + pin in sync
  - No "WK N · Visit N" text visible anywhere

- [ ] **Step 6: Commit**

```bash
git add src/components/patient/PillarTrendChart.tsx
git commit -m "feat: show date and body text in milestone annotation cards"
```

---

## Verification

1. `npx tsc --noEmit` — zero errors
2. Dev: `/patient/dashboard` → Symptom Tracker tab → 3 pins visible, cards show date + title + body
3. Prod (after push): check `dlolli@gmail.com` account — pins should show real prescription dates and visit dates, not "WK N · Visit N"
