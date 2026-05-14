# Domain Card Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the meaningless "X / 5" burden display on symptom tracker domain cards with qualitative labels, and add a 4-week rolling average + trend direction alongside the latest value.

**Architecture:** All changes are isolated to `PatientOverview.tsx`. The `visits` array is already available in the component with `symptom_scores` per visit — no new API calls needed. Average is computed from the last 4 data points per domain; trend compares that 4-visit window against the prior 4 to avoid single-point noise.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## Background

### Data model
- `visits[].symptom_scores` is a `Record<string, number>` JSON column.
- **Vasomotor**: raw count 0–20 (lower = better, `improvesDown: true`)
- **Sleep**: hours 0–12 (higher = better, `improvesDown: false`)
- **Cardio**: episode count 0–99 (lower = better, `improvesDown: false` in current code — note: existing trend chip may have a direction bug here, but that is out of scope)
- **All other domains** (energy, mood, cognition, gsm, bone, weight, libido): 1–5 **burden** scale where **5 = worst, 1 = best**. These currently show "X / 5" — the ones we are replacing with qualitative labels.

### Key section in PatientOverview.tsx
The domain card render loop starts at line ~541. Within it:
```typescript
const data = sortedVisits
  .filter(v => v.symptom_scores?.[domain.key] !== undefined)
  .map(v => v.symptom_scores![domain.key])
const current  = data[data.length - 1]
const previous = data[data.length - 2]
const delta = previous !== undefined && current !== undefined ? current - previous : null
const status = getStatus(delta, domain.improvesDown)
```

The `domainDisplay` helper (line ~557) returns `{ value, unit }` for rendering.

### `getStatus` (line ~76)
```typescript
function getStatus(delta: number | null, improvesDown: boolean): 'improving' | 'watch' | 'steady' {
  if (delta === null) return 'steady'
  return (improvesDown ? delta < 0 : delta > 0) ? 'improving' : 'watch'
}
```

---

## File Map

| File | Change |
|------|--------|
| `src/components/provider/PatientOverview.tsx` | Add `burdenLabel()`, update `domainDisplay()`, add 4-wk avg computation, update card layout to show avg + trend |

No other files change.

---

## Task 1: Add `burdenLabel` helper and update `domainDisplay`

**File:** `src/components/provider/PatientOverview.tsx` (line ~557, inside the domain card render loop)

Replace the current `domainDisplay` function with one that returns a qualitative label for the 1–5 burden domains.

- [ ] **Step 1: Locate `domainDisplay`** — it's defined inside the `.map((domain) => {` callback at line ~557. The current default return is `{ value: String(val), unit: '/ 5' }`.

- [ ] **Step 2: Add `burdenLabel` above the `domainDisplay` call** (still inside the map callback, before `domainDisplay` is defined):

```typescript
const burdenLabel = (val: number): string => {
  if (val <= 1.5) return 'Minimal'
  if (val <= 2.5) return 'Mild'
  if (val <= 3.5) return 'Moderate'
  if (val <= 4.5) return 'Significant'
  return 'Severe'
}
```

- [ ] **Step 3: Update `domainDisplay` default return** from:
```typescript
return { value: String(val), unit: '/ 5' }
```
to:
```typescript
return { value: burdenLabel(val), unit: '' }
```

- [ ] **Step 4: Verify tsc passes**
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**
```bash
git add src/components/provider/PatientOverview.tsx
git commit -m "Replace '/ 5' burden display with qualitative labels on domain cards"
```

---

## Task 2: Add 4-week average computation

**File:** `src/components/provider/PatientOverview.tsx` (inside the `.map((domain) => {` callback, after the existing `delta` / `status` lines)

- [ ] **Step 1: Add 4-week average computation** after line `const status = getStatus(delta, domain.improvesDown)`:

```typescript
// 4-visit rolling average and window-based trend
const recent4 = data.slice(-4)
const prior4  = data.slice(-8, -4)
const avg4 = recent4.length > 0
  ? recent4.reduce((sum, v) => sum + v, 0) / recent4.length
  : null
const avgPrior4 = prior4.length > 0
  ? prior4.reduce((sum, v) => sum + v, 0) / prior4.length
  : null
const windowDelta = avg4 !== null && avgPrior4 !== null ? avg4 - avgPrior4 : delta
const windowStatus = getStatus(windowDelta, domain.improvesDown)
```

`windowStatus` replaces `status` for the trend chip (uses window comparison instead of single-point delta). `avg4` is used to render the 4-week average label.

- [ ] **Step 2: Replace `status` with `windowStatus`** in the `statusConfig` lookup (line ~550). Change:
```typescript
const statusConfig = {
  improving: { label: '↑ Improving', cls: 'bg-emerald-50 text-emerald-700' },
  watch:     { label: '→ Watch',     cls: 'bg-amber-50 text-amber-700' },
  steady:    { label: '→ Steady',    cls: 'bg-aubergine/5 text-aubergine/40' },
}[status]
```
to:
```typescript
const statusConfig = {
  improving: { label: '↑ Improving', cls: 'bg-emerald-50 text-emerald-700' },
  watch:     { label: '→ Watch',     cls: 'bg-amber-50 text-amber-700' },
  steady:    { label: '→ Steady',    cls: 'bg-aubergine/5 text-aubergine/40' },
}[windowStatus]
```

Also update the `domain.tags` lookup at the bottom of the card from `[status]` to `[windowStatus]`.

- [ ] **Step 3: Verify tsc passes**
```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add src/components/provider/PatientOverview.tsx
git commit -m "Use 4-visit rolling window for domain card trend direction"
```

---

## Task 3: Display 4-week average in the card layout

**File:** `src/components/provider/PatientOverview.tsx` — the score rendering block (lines ~580–594)

Currently renders:
```tsx
<span className="font-serif text-5xl text-aubergine leading-none">
  {value}
  {unit && <span className="font-serif text-xl italic ml-1.5" style={{ color: '#C4A87A' }}>{unit}</span>}
</span>
<p className="text-xs font-sans text-aubergine/40 mt-1">{domain.subtitle}</p>
```

- [ ] **Step 1: Compute `avgDisplay`** alongside `domainDisplay`. After `const { value, unit } = domainDisplay(domain.key, current)`, add:

```typescript
const avgDisplay = avg4 !== null
  ? domainDisplay(domain.key, parseFloat(avg4.toFixed(1)))
  : null
```

- [ ] **Step 2: Update the score rendering block** to show the average below the main value:

```tsx
{/* Score + subtitle */}
<div className="mb-2">
  {current !== undefined ? (() => {
    const { value, unit } = domainDisplay(domain.key, current)
    return (
      <div>
        <span className="font-serif text-5xl text-aubergine leading-none">
          {value}
          {unit && <span className="font-serif text-xl italic ml-1.5" style={{ color: '#C4A87A' }}>{unit}</span>}
        </span>
        {avgDisplay && (
          <p className="text-xs font-sans text-aubergine/40 mt-1">
            4-wk avg: <span className="font-medium text-aubergine/60">{avgDisplay.value}{avgDisplay.unit ? ` ${avgDisplay.unit}` : ''}</span>
          </p>
        )}
      </div>
    )
  })() : (
    <span className="font-serif text-4xl text-aubergine/20 leading-none">—</span>
  )}
  <p className="text-xs font-sans text-aubergine/40 mt-1">{domain.subtitle}</p>
</div>
```

- [ ] **Step 3: Verify tsc passes**
```bash
npx tsc --noEmit
```

- [ ] **Step 4: Visual check** — open `/admin/banner-preview` to confirm nothing broke there, then open the patient dashboard (`/patient/dashboard` in dev, uses fixture data) and navigate to the Symptom Tracker view. Each domain card should show:
  - Large label (e.g. "Moderate") or number (e.g. "4")
  - "4-wk avg: Mild" below it (if enough data)
  - Trend chip at bottom using the window comparison

- [ ] **Step 5: Commit and push**
```bash
git add src/components/provider/PatientOverview.tsx
git commit -m "Add 4-week average display to domain cards"
git push origin main
```

---

## Verification

1. **tsc**: `npx tsc --noEmit` — zero errors
2. **Symptom Tracker cards** (dev): visit `/patient/dashboard` → Symptom Tracker tab. With dev fixture data, confirm:
   - Burden domains show a word label (not a number) as the main value
   - "4-wk avg: X" line renders beneath the main value
   - Trend chip shows ↑/→ based on 4-visit window, not single-point delta
3. **Provider patient view**: `/provider/dashboard` → click a patient with check-in history. Same cards render in `PatientOverview` — confirm labels and averages appear correctly.
4. **No data state**: domain with zero check-ins should still show "—" and "Check in to start tracking".
