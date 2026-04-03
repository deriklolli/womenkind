# Womenkind — Brand Specs for Development

Extracted from Allkind Brand Guidelines (Digital Silk, Feb 13, 2026)

**We are building the Womenkind sub-brand.** Allkind is the master brand; Menkind and Womenkind are sub-brands.

---

## Brand Architecture

- **Master brand:** Allkind
- **Sub-brand (our focus):** Womenkind
- **Other sub-brand (not in MVP):** Menkind

---

## Color Palette

### Primary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Kind Aubergine** | `#280f49` | 0, 83, 46 | Primary deep color — wordmark "kind" portion, dark backgrounds, nav, headings |
| **Allkind Terracota** | `#d85623` | 216, 86, 35 | Accent / CTA color — buttons, links, active states, orange portion of wordmark |

### Secondary Colors (Womenkind-specific)
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Violet Bloom** | `#944fed` | 148, 79, 237 | Womenkind sub-brand accent — used in the "Women" portion of the wordmark, highlights, secondary accents |
| **Alpha Sky** | `#5d9ed5` | 93, 158, 213 | Menkind accent (not primary for our build, but available) |

### Tertiary / Neutral Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Natural Kind** | `#ffd4b0` | 255, 212, 176 | Warm background — page backgrounds, cards, soft sections |
| **Airborne** | `#d9eaf9` | 217, 234, 249 | Light blue accent background |
| **Human Base** | `#f2f2f2` | 242, 242, 242 | Near-white neutral — form backgrounds, subtle dividers |
| **Warm Beige** | `#422a1f` | 66, 42, 31 | Dark warm brown — body text alternative to pure black |
| **Mint Breath** | `#c2e7d9` | 194, 231, 217 | Green accent — success states, positive indicators |

### Color Proportions (Womenkind)
- **Kind Aubergine:** Always ~40% — dominant color
- **Natural Kind (warm peach bg):** Always ~15% — background warmth
- **Violet Bloom:** Often ~10% — Womenkind accent
- **Allkind Terracota:** Often ~10% — CTA / action color
- **Natural Kind / Airborne / Human Base:** Often ~15% — supporting neutrals
- **Mint / Alpha Sky / Warm Beige:** Rarely ~5% each — used sparingly

### Gradients
- Natural Kind `#ffd4b0` (100%) → `#ffd4b0` (15%) — warm peach fade
- Warm Beige `#422a1f` (100%) → Natural Kind `#ffd4b0` (45%) — rich warm gradient

---

## Typography

### Brand Typeface (Logo only)
- **Vogun** — Light and Medium Italic weights
- Used exclusively for the wordmark. NOT for body copy or UI text.

### Primary Typeface (all UI text)
- **Plus Jakarta Sans** — Google Font, freely available
- Weights: Light (300), Regular (400), Medium (500), Semi Bold (600), Bold (700)
- Use for: headings, body copy, navigation, buttons, form labels, everything in the app

### Font Hierarchy (for implementation)
- **H1:** Plus Jakarta Sans Semi Bold, 36-48px
- **H2:** Plus Jakarta Sans Semi Bold, 28-32px
- **H3:** Plus Jakarta Sans Medium, 22-24px
- **Body:** Plus Jakarta Sans Regular, 16px
- **Small/Caption:** Plus Jakarta Sans Light, 14px
- **Button:** Plus Jakarta Sans Semi Bold, 16px

---

## Logo Usage

### Womenkind Wordmark
- Custom typography — must be used as an SVG/image asset, not recreated with fonts
- "Women" portion rendered in Violet Bloom `#944fed`
- "kind" portion rendered in Kind Aubergine `#280f49`
- Underline accent bar in Violet Bloom
- Minimum digital width: 185px (recommended), 130px (absolute minimum)

### Logomark / Favicon
- Standalone custom "K" symbol — the sculpted K from the wordmark
- Used for favicon, app icon, social media avatar
- Positive version: dark purple background with orange/white K
- Never display the icon alongside the full wordmark

### Logo Rules
- Do not rotate, stretch, outline, add effects, or alter colors
- Maintain safe space (2a padding on all sides, where "a" = height of the underline bar)
- On dark backgrounds: use inverted/white version
- On photography: ensure sufficient contrast

---

## Brand Voice & Tone

### Personality
- Approachable, Compassionate, Expert, Empowering

### Tone
- Credible, Empathetic, Supportive, Direct

### Language Guidelines
- Confident, calm, and informed
- Explain medical concepts clearly without diluting credibility
- Warm, human language that acknowledges emotion as much as science
- Avoid medical clichés and "wellness" buzzwords
- Focus on patients feeling seen, supported, and safe

### Desired Patient Feeling
> "I finally found a medical partner who truly listens, understands my body, and helps me feel like myself again."

---

## Photography Style
- Warm, natural lighting
- Women in midlife — confident, serene, real
- Soft focus backgrounds, earth tones
- Clinical but human — not sterile, not overly "lifestyle"

---

## Implementation Notes for Next.js / Tailwind

### Tailwind Config Colors
```js
colors: {
  'aubergine': '#280f49',
  'terracota': '#d85623',
  'violet': '#944fed',
  'sky': '#5d9ed5',
  'natural': '#ffd4b0',
  'airborne': '#d9eaf9',
  'human': '#f2f2f2',
  'beige': '#422a1f',
  'mint': '#c2e7d9',
}
```

### Google Font Import
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
```

### Tailwind Font Config
```js
fontFamily: {
  'sans': ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
}
```
