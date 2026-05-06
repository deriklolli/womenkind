# Handoff: Womenkind Score Badge

## Overview
A pill-shaped badge for the top-right of the patient portal that summarizes the patient's overall **Womenkind Score** at a glance. Combines an animated circular progress ring, the score number, an italic mood-tagline, and a monthly delta.

## Where It Goes
Top-right of the portal header, **left of** the notification bell and avatar. Visible on every authenticated portal page so the patient sees their score continuously, not only on the Scorecard.

## About the Design File
`Womenkind Patient Scorecard.html` shows the badge in context. Recreate as a React component in your Next.js + Tailwind codebase &mdash; reuse existing brand tokens.

## Component Anatomy

```
<WomenkindScoreBadge>
  ├── ring-wrap (108×108)
  │   ├── pulse halo (animated)
  │   ├── SVG track + animated arc (violet gradient)
  │   └── score number (Playfair, 44px, animated 0→N)
  └── meta column
      ├── eyebrow      "WOMENKIND SCORE"
      ├── tagline      "Strong & climbing" (italic 'climbing' in violet)
      └── delta chip   ↑ +6 this month (green)
```

## Spec

### Container
- Pill: `display:flex; align-items:center; gap:24px; padding:12px 32px 12px 12px; border-radius:999px;`
- Background: `linear-gradient(135deg, #fff 0%, #faf6ef 60%, #f3e9da 100%)`
- Border: `1px solid rgba(66,42,31,.12)`
- Shadow: `0 1px 0 rgba(255,255,255,.9) inset, 0 22px 50px -28px rgba(40,15,73,.4)`
- Hover: `translateY(-1px)`, deeper shadow, border tints to `rgba(148,79,237,.35)`. Transition 250ms.

### Ring
- 108×108 wrap, SVG `viewBox="0 0 60 60"` rotated `-90deg` (start at 12 o'clock).
- Two concentric circles, `cx=30 cy=30 r=25`, `stroke-width=3.2`, no fill, round caps.
- Track: `stroke="rgba(66,42,31,.10)"`.
- Arc: `stroke="url(#wkBadgeGrad)"` &mdash; linear gradient, `#b78cf5` &rarr; `#944fed`.
- `stroke-dasharray = 2π·25 ≈ 157.08`. `stroke-dashoffset = C × (1 - score/100)`.
- Animate offset from full-circle to target on mount: `transition: stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1) .35s;` (350ms after delay you set offset; let CSS transition do the rest).
- Pulse halo: absolutely positioned `inset:-8px`, `border:2px solid rgba(148,79,237,.35); border-radius:50%;` keyframes:
  ```css
  @keyframes wkPulse {
    0%   { transform: scale(.92); opacity: .6 }
    70%  { transform: scale(1.18); opacity: 0 }
    100% { transform: scale(1.18); opacity: 0 }
  }
  ```
  `animation: wkPulse 2.4s cubic-bezier(.2,.7,.2,1) infinite;`
- Score number: absolutely centered. Playfair Display 400, **44px**, color `#280f49` (--aubergine), `font-feature-settings:"lnum"`. Animate count from 0 → score over ~1100ms with ease-out cubic on mount.

### Meta column
- `display:flex; flex-direction:column;` no gap (tight stack), padding-right 6px.
- **Eyebrow**: 11px, letter-spacing .22em, uppercase, weight 700, color `rgba(66,42,31,.55)`.
- **Tagline**: Playfair 24px, color `--aubergine`, line-height 1.05, margin-top 4px. The mood word is `<em>` + violet (`#944fed`). Format: `"Strong & climbing"` &mdash; pick word from score band.
- **Delta**: `display:inline-flex; gap:5px; font-size:13px; font-weight:700;` color `#5a8a6a` (--good), margin-top 6px. Up-arrow icon 12×12 (stroke 3, round caps). Format: `+{delta} this month`.

### Responsive
- ≤ 600px: hide `.meta`, shrink padding to 4px so just the ring shows.

## Mood-tagline mapping (suggested)
| Score | Tagline |
| --- | --- |
| 90+ | Thriving & **steady** |
| 75–89 | Strong & **climbing** |
| 60–74 | Steady & **building** |
| 45–59 | Finding your **footing** |
| < 45 | Early days |

Italicize / violet-color the second word.

## Data
```ts
type WomenkindScore = {
  score: number;          // 0..100
  delta30d: number;       // signed integer, e.g. +6 or -3
  trendLabel: string;     // "climbing" | "steady" | "building" | …
};
```
Pull from existing scorecard endpoint. Cache 5&nbsp;min.

## Tokens
Already in your codebase:
```css
--aubergine: #280f49;
--violet:    #944fed;
--violet-soft: #b78cf5;
--cream:     #f7f3ee;
--warm-mute: rgba(66,42,31,.55);
--line:      rgba(66,42,31,.12);
--good:      #5a8a6a;
```
Type: Playfair Display (display) + Plus Jakarta Sans (UI).

## Source-of-truth
`Womenkind Patient Scorecard.html` &mdash; the badge is in `<header class="top">` &rarr; `.wk-badge`. CSS class is fully self-contained; lift it directly if helpful.
