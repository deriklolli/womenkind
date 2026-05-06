# Handoff: Pillar Trend Chart (Variant A — Editorial Timeline)

## Overview
A patient-facing chart that plots a single Womenkind pillar (Sleep, Vasomotor, Mood, Brain &amp; Cognition, Hormonal) over time. The user picks a pillar from a dropdown; the chart redraws in that pillar's accent color. **Care milestones** (consultations, prescriptions started, dose changes, labs drawn) are pinned inline with numbered medallions floating above the line on dashed stems, plus a 4-card annotation rail below that cross-highlights with the pins on hover. Lives below the existing pillar grid in the Patient Scorecard.

## About the Design Files
The HTML in this bundle is a **design reference**, not production code. It contains three variants on a design canvas &mdash; **only Variant A (&ldquo;Editorial timeline&rdquo;)** is what we&rsquo;re implementing. Recreate it in the existing **Next.js + React + Tailwind** Womenkind codebase using whatever charting approach fits best (raw SVG is fine and is what the prototype uses; D3 scales are nice if you already have them; recharts is acceptable but you&rsquo;ll fight it for the floating pins).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and behavior are decided. Match the prototype pixel-accurately.

## Component
Build as `<PillarTrendChart patientId={...} initialPillar="sleep" />`.

### Layout (1100 &times; 380 viewBox, padding `{l:54, r:36, t:62, b:46}`)
- **Header row**: left = title block (`small` eyebrow "Variant A &middot; Editorial timeline" replaced with section label like "Trend over time", h2 "&lt;Pillar&gt; over time" in Playfair Display 30px). Right = pillar dropdown.
- **Chart area** (flex:1): SVG, full width.
- **Annotation rail** (below chart, fixed grid `repeat(4, 1fr)`): 4 cards. The first three are the first three milestones; the fourth is the **most recent** milestone.

### Pillar dropdown
- 230px min-width, cream bg, 14px radius, 1px line border (turns violet on open).
- Inside: colored dot (pillar accent) + stacked label ("PILLAR" eyebrow + Playfair name) + caret.
- Open menu pops below with all 5 pillars, each row = dot + Playfair name. Active row gets cream bg.

### Chart drawing rules
- **Y axis**: 0&ndash;10 (the scorecard range), gridlines at 0/2/4/6/8/10, label left of grid in Plus Jakarta 10px 600 weight, color `rgba(66,42,31,.5)`.
- **Baseline marker**: dashed `3 4` horizontal line at the patient&rsquo;s **starting value** for that pillar, color `rgba(66,42,31,.45)`. Inline label `BASELINE &middot; N` in 10px 700 weight 0.1em letter-spacing, color `rgba(66,42,31,.6)`, positioned 6px above the line.
- **Series**: smooth bezier path. Each segment: `C(midX, prevY) (midX, currY) (currX, currY)`. Stroke = pillar accent color, 2.5px, round joins.
- **Area fill**: same path closed to bottom + linear gradient (top: accent at 35% opacity &rarr; bottom: accent at 0%). Gradient id should be unique per render.
- **Current week dot**: 14px halo (accent at 15% opacity) + 6px white circle with 2.5px accent stroke. Always at the last data point.
- **X-axis labels**: 5 ticks at weeks 0, 6, 12, 18, 23. Labels: "START", "WK 6", "WK 12", "WK 18", "NOW". Plus Jakarta 10px 700 weight 0.12em letter-spacing.

### Milestone pins (above the chart)
For each milestone:
- **Stem**: vertical line from data point up to `pad.t - 18`. Stroke = aubergine, 1px, dasharray `2 3`, opacity 0.6.
- **Medallion**: circle at `(x, pad.t - 30)`, radius 13 (15 on hover). Fill = white (accent on hover), stroke = accent 1.8px, 200ms transition.
- **Numeral**: Playfair italic 12px, accent color (white on hover), centered in medallion. The number is the milestone&rsquo;s 1-indexed position in the timeline.
- **Data point dot**: 4.5px white circle with 2px accent stroke, drawn at the actual data point.
- **Hover handler**: `onMouseEnter` sets a `hover` state with the milestone index; the matching annotation card gets the highlight treatment.

### Annotation rail (below chart)
4 cards, each:
- Background: cream by default, **pillar accent** when its pin is hovered (or its own card is hovered). 250ms transition on background + color.
- Inside, top row: small numeral chip (18px circle, accent bg/white text by default; on hover, white bg/accent text) + eyebrow "WK N &middot; SHORT_LABEL" (uppercase, 9.5px, 0.18em, 700 weight).
- Below: milestone title in Playfair 14px, color aubergine (white when card highlighted).

## Data shape

```ts
type PillarKey = 'sleep' | 'vasomotor' | 'mood' | 'brain' | 'hormonal';

interface Pillar {
  key: PillarKey;
  name: string;       // 'Sleep'
  accent: string;     // pillar accent hex
  baseline: number;   // 0-10, intake value
  current: number;    // 0-10, latest reading
  unit: string;       // '/10'
}

interface MilestoneType { 
  type: 'visit' | 'rx' | 'dose' | 'lab';
}

interface Milestone extends MilestoneType {
  wk: number;         // 0-indexed week, must align with series index
  short: string;      // chip label, max ~10 chars: 'Estradiol', 'Visit 2', 'Dose +'
  title: string;      // full title shown in annotation card + tooltip
  body: string;       // 1&ndash;2 sentence description (HTML allowed for &lt;b&gt;, etc.)
}

interface PillarTrendData {
  pillars: Pillar[];                              // all 5
  series: Record<PillarKey, number[]>;            // 24 weekly readings each
  milestones: Milestone[];                        // ordered by wk
}
```

In the prototype, `series` is hand-tuned weekly values to feel realistic. In production, fetch:
- **Series**: weekly aggregated pillar scores from your scorecard API (24 weeks back, indexed 0&ndash;23).
- **Milestones**: from your `care_events` table, filtered to this patient, sorted by date. Map `event.kind` &rarr; `type` (`'consult' &rarr; 'visit'`, `'prescription_started' &rarr; 'rx'`, `'dose_changed' &rarr; 'dose'`, `'lab_drawn' &rarr; 'lab'`). Compute `wk` as `Math.floor((event.date - startDate) / (7 * 24*60*60*1000))`.

## Pillar accent colors (lift from existing tokens; hex if missing)

| Key | Name | Accent |
|---|---|---|
| `sleep` | Sleep | `#5d9ed5` |
| `vasomotor` | Vasomotor | `#c97c5d` |
| `mood` | Mood | `#7c6bc4` |
| `brain` | Brain &amp; Cognition | `#944fed` |
| `hormonal` | Hormonal | `#c47884` |

## Design tokens (already in your codebase)

```
--aubergine: #280f49
--violet:    #944fed
--cream:     #f7f3ee
--cream-deep:#efe8df
--warm:      #422a1f
--warm-soft: #5a3e2a
--tan:       #d4b896
--line:      rgba(66,42,31,.12)
```

Type: **Playfair Display** for headlines/numerals/italics, **Plus Jakarta Sans** for body/UI. Both already loaded.

## Interactions

- **Pillar change**: redraw chart in new accent color; transition is fine but instant is also fine. Keep `hover` state.
- **Pin hover**: medallion grows 13&rarr;15px, fills with accent, numeral flips to white. The matching annotation card highlights.
- **Annotation card hover**: same matching pin highlights (bidirectional).
- **No click target on pins** in v1 &mdash; hover is enough. (V2 could open a milestone detail drawer.)
- **Responsive**: SVG uses `viewBox` + `preserveAspectRatio="none"`, so horizontal stretch works to ~1280px. Below 720px, switch to a stacked layout (chart on top, dropdown above, annotation rail collapses to a horizontal scroll).

## Files in this bundle
- `Womenkind Pillar Trends Explorations.html` &mdash; design reference. **Variant A is the one to build.** Variants B and C are alternates we&rsquo;re not implementing.
- `README.md` &mdash; this document.
