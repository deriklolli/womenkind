# Womenkind — Figma Design Spec (Front-End Build Reference)

Captured from the approved Figma prototype: `WomenKind - Presentation - Approved Design (desktop)`
17 pages total. This document defines every visual pattern, component, and design token that must be followed during front-end development.

---

## 1. Global Design Tokens

### 1.1 Color Palette

| Token             | Hex       | Usage                                                    |
|--------------------|-----------|----------------------------------------------------------|
| Kind Aubergine     | `#280f49` | Dark headings, nav text on light bg, footer bg, "Kind" in logo |
| Allkind Terracota  | `#d85623` | Accent (sparingly), warm highlights                      |
| Womenkind Violet   | `#944fed` | **Primary CTA buttons**, links, active states, "Women" in logo |
| Violet Dark        | `#7a35d9` | Button hover state                                       |
| Natural Peach      | `#ffd4b0` | Stat numbers on dark bg, warm accent text                |
| Cream/Off-white    | `#f7f3ee` | Below-fold section backgrounds (NOT pure white)          |
| Pure White         | `#ffffff` | Hero overlay text, nav text on dark bg                   |
| Warm Black         | `#1a0930` | Footer background (aubergine-dark)                       |
| Human Grey         | `#f2f2f2` | Subtle dividers, light card backgrounds                  |
| Mint               | `#c2e7d9` | Occasional accent                                        |
| Airborne Blue      | `#d9eaf9` | Occasional accent                                        |
| Beige/Body Text    | `#422a1f` | Body text on light backgrounds                           |
| Gold/Warm overlay  | `rgba(42, 26, 15, 0.45)` | Dark gradient overlay on hero images          |

### 1.2 Typography

| Element               | Font                  | Weight    | Size (desktop)     | Style       | Color                    |
|------------------------|----------------------|-----------|---------------------|-------------|--------------------------|
| Hero headlines (H1)    | **Vogun** (serif)    | Regular   | ~64–80px            | Normal      | White (on hero image)    |
| Section headlines (H2) | **Vogun** (serif)    | Regular   | ~48–56px            | Normal      | Aubergine (on light bg)  |
| Subheadings (H3)       | Vogun or Plus Jakarta| Medium    | ~24–32px            | Normal      | Aubergine or White       |
| Body text              | Plus Jakarta Sans    | Regular   | 16–18px             | Normal      | Beige `#422a1f` or White |
| Nav links              | Plus Jakarta Sans    | Medium    | 14–15px             | Normal      | White (on hero)          |
| Button text            | Plus Jakarta Sans    | SemiBold  | 14–16px             | Normal      | White                    |
| Stat numbers           | Vogun (serif)        | Regular   | ~80–100px           | Normal      | Natural Peach or White   |
| Section labels         | Plus Jakarta Sans    | SemiBold  | 12–13px             | Uppercase, tracking wide | Violet or Natural Peach |
| Dropdown headings      | Vogun (serif)        | Regular   | ~24px               | Normal      | White/cream              |
| Dropdown body text     | Plus Jakarta Sans    | Regular   | 14px                | Normal      | White/cream at 70–80%    |

**Key rule**: Vogun is the display/headline serif font. Plus Jakarta Sans is the UI/body sans-serif. Every hero heading and major section title uses Vogun. Everything else (body, nav, buttons, labels) uses Plus Jakarta Sans.

### 1.3 Spacing System

| Spacing         | Value      | Usage                                           |
|-----------------|------------|--------------------------------------------------|
| Page max-width  | ~1280px    | Content container (centered)                     |
| Page padding    | 80–100px   | Left/right on desktop hero sections              |
| Section padding | 80–120px   | Vertical padding on below-fold sections          |
| Card padding    | 32–40px    | Internal padding on cards and glassmorphic panels|
| Stack gap       | 24–32px    | Between content blocks                           |
| Nav item gap    | 32–40px    | Between navigation items                         |
| Hero text max-w | ~650px     | Maximum width for hero body text                 |

### 1.4 Border Radius

| Element                  | Radius       |
|--------------------------|-------------- |
| CTA buttons (pill)       | `9999px` (fully rounded / pill shape) |
| Arrow icon circle        | `50%` (perfect circle)                |
| Nav bar container        | `9999px` (pill-shaped on hero)        |
| Cards / content panels   | `16–24px`                             |
| Dropdown panels          | `16px`                                |
| Image thumbnails (megas) | `12px`                                |
| Hero image containers    | `0` (full-bleed, no rounding)         |

---

## 2. Component Specifications

### 2.1 Navigation Bar

**Layout**: Floating pill-shaped bar positioned over the hero image. Not a full-width solid bar.

- Background: `rgba(40, 15, 73, 0.55)` — frosted glass / semi-transparent aubergine with backdrop blur
- Border-radius: `9999px` (pill shape)
- Padding: `12px 24px` approximately
- Positioned ~24px from top, centered or with left/right margin
- Logo on left, nav links centered, CTA button on right

**Nav links**: White text, Plus Jakarta Sans Medium, ~14px, with dropdown chevron icons. Hover: slight opacity change or underline.

**Active indicator**: Thin line/underline below active nav item (visible in dropdown states).

**CTA button ("Let's Get Started")**: See Button spec below — violet pill with arrow circle.

### 2.2 Buttons

#### Primary CTA (Violet Pill + Arrow)
- Background: `#944fed` (Womenkind Violet)
- Text: White, Plus Jakarta Sans SemiBold, 14–16px
- Shape: Pill (`border-radius: 9999px`)
- Padding: `14px 24px 14px 28px`
- **Arrow circle**: Dark aubergine/black circle (`#280f49`) on the right side of the button, containing a white `→` arrow
- Arrow circle size: ~36px diameter
- Hover: `#7a35d9` (Violet Dark)
- Shadow: subtle drop shadow

#### Secondary CTA (Ghost/Outline + Arrow)
- Background: transparent or `rgba(255,255,255,0.15)`
- Border: 1.5px solid white or aubergine (depending on bg)
- Text: White (on dark bg) or Aubergine (on light bg)
- Same pill shape and arrow circle pattern
- Arrow circle: outlined or lighter treatment

#### Link-style buttons
- Text with arrow, no background, used in dropdown menus

### 2.3 Hero Sections

Every page uses a **full-bleed hero image** with overlaid text:

- Image covers full viewport width, typically ~70–80vh height
- **Gradient overlay**: Dark gradient from left/bottom to transparent right/top
  - Approximately `linear-gradient(to right, rgba(26, 9, 48, 0.7) 0%, rgba(26, 9, 48, 0.3) 50%, transparent 100%)`
  - This creates readability for the white text on the left side
- Headline text is always white, aligned left, positioned in the left 50% of the viewport
- Body text is white at ~80% opacity
- CTA button sits below the body text

### 2.4 Mega Dropdown Menus

When a nav item is hovered/clicked, a large dropdown panel appears:

- Background: Semi-transparent dark (`rgba(40, 15, 73, 0.85)`) with backdrop blur
- Border-radius: `16px`
- Layout: Multi-column grid
  - Left column: descriptive intro text
  - Center: topic cards with thumbnail images (rounded, ~80x80px) + Vogun title + Plus Jakarta description
  - Right column: "Explore" links or featured image + description
- Text: White and cream/natural tones
- Topic thumbnails: small rounded images with serif titles

### 2.5 Below-Fold Sections

Content sections that appear below the hero image:

- Background: Cream/off-white `#f7f3ee` to `#faf8f5` (NOT pure white)
- Section labels: Violet text, uppercase, small, with decorative dots on either side (e.g., `• Why Education Matters •`)
- Headlines: Vogun serif, Aubergine color, large
- Body text: Plus Jakarta Sans, Beige `#422a1f`
- Cards within sections: White background, 16–24px radius, subtle shadow
- Some sections feature italic serif text in violet for emphasis

### 2.6 Stats Block (Homepage Hero)

Positioned in the lower-right area of the homepage hero:

- Two large stat numbers side by side: "80%" and "2%"
- Font: Vogun serif, ~80–100px, white
- Separated by a vertical gold/natural-colored line
- Below each number: description text in white/cream, 14px, Plus Jakarta Sans
- The stats sit ON the hero image, not in a separate section

### 2.7 Contact Form (Glassmorphism)

- Card with frosted glass background: `rgba(255, 255, 255, 0.1)` with `backdrop-filter: blur(20px)`
- Rounded corners: `24px`
- Form fields: underline-style inputs (no bordered boxes), white text on transparent bg
- Labels: Vogun serif, white
- Submit button: Violet pill with arrow circle

### 2.8 404 Page

- Light cream background
- "Oops!" in Vogun serif at top
- Large "4 _ 4" with a circular profile image of a woman as the "0"
- Image has a light pink/natural circular background
- "Page not found" in Vogun serif below
- Description text + "Back to Home" violet pill button

### 2.9 Footer

- Background: Aubergine dark `#1a0930`
- Text: Natural peach and white at varying opacities
- Womenkind logo in white variant
- Multi-column layout with links
- "An Allkind company" subtitle

---

## 3. Page Inventory

| # | Page Name                         | Key Elements                                                |
|---|-----------------------------------|-------------------------------------------------------------|
| 1 | Homepage (WomenJourney dropdown)  | Hero + nav dropdown with topic cards                        |
| 2 | Homepage (Services dropdown)      | 6 service cards: Perimenopause, Sexual Health, Hormone Opt, Preventive Diagnostics, Longevity, Hair Loss |
| 3 | Homepage (How Care Works dropdown)| 4 steps: Symptom Evaluation, Lifestyle Context, Personal Priorities, Personalized Clinical Plan |
| 4 | Homepage (About dropdown)         | About text + Our Approach, Our Team, Contact links          |
| 5 | **Homepage (hero, no dropdown)**  | Full hero: "Menopause Care That Meets Women With Kindness" + 80%/2% stats + CTA |
| 6 | WomenJourney landing              | "Supportive Knowledge For Every Stage Of Menopause" + ocean hero |
| 7 | About WomenKind                   | "About WomenKind" hero + "Thoughtful Care For Every..." section |
| 8 | Sexual Changes (symptom page)     | Symptom-specific hero + CTAs to Foundations and Life Stages  |
| 9 | Contact                           | Contact form (glassmorphic) + phone/email/address + FAQ accordion |
| 10| Foundations of Midlife Health     | Educational content page with centered headline             |
| 11| How Care Works                    | "How Care Works" hero + "Our Care Philosophy" section       |
| 12| Services (main)                   | "Physician-Led Menopause & Midlife Care" + "Our Philosophy" |
| 13| Perimenopause & Menopause         | Service detail page with dual CTAs                          |
| 14| Screening Call                    | "Your First Step: The Screening Call" + booking CTA         |
| 15| Online Consultation               | "Your First Online Physician Consultation" detail           |
| 16| Membership                        | "Women's Health Membership For Continuous Care"             |
| 17| 404 Page                          | Branded error page with profile silhouette in the "0"       |

---

## 4. Image & Photography Guidelines

- **Style**: Warm, golden-hour photography. Natural light. Women in midlife (40s–60s) looking calm, confident, and at ease.
- **Color grading**: Warm tones — amber, golden, soft peach. Not clinical or cold.
- **Subjects**: Diverse women, real/natural appearance, often in relaxed settings (home, outdoors, ocean).
- **Usage**: Always full-bleed as hero backgrounds with gradient overlay. Never contained in a box on the hero.
- **Thumbnails** (in dropdowns): Small (~80x80–120x120), rounded corners, same warm tone.
- **Stock note**: Current designs use iStock watermarked images — these will be replaced with licensed or custom photography.

---

## 5. Interaction & Motion Notes

- Dropdown menus animate in (fade + slight slide)
- Buttons have hover state color shift (violet → violet-dark)
- Page transitions in prototype are smooth cross-fades
- Arrow icon in CTA buttons may have a subtle rightward nudge on hover
- Frosted glass nav has backdrop-blur effect

---

## 6. Responsive Considerations (Inferred)

The Figma prototype shows desktop only (1440px viewport). Mobile treatment should:

- Collapse nav into hamburger menu
- Stack hero text vertically, reduce headline size (~36–40px)
- Stack stats vertically
- Full-width CTA buttons on mobile
- Dropdowns become accordion-style panels
- Maintain the full-bleed hero image pattern
- Reduce section padding to 40–60px vertical

---

## 7. Font Loading Strategy

```html
<!-- Plus Jakarta Sans from Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap" rel="stylesheet">

<!-- Vogun — must be self-hosted (not on Google Fonts) -->
<!-- Place Vogun .woff2 files in /public/fonts/ and load via @font-face in globals.css -->
```

**If Vogun is not available**: Fallback to a similar display serif like `'Playfair Display'` or `'Cormorant Garamond'` from Google Fonts as an interim measure. The Vogun typeface is a critical brand element and should be sourced from the brand guidelines team.

---

## 8. Tailwind Config Additions Needed

```typescript
// Add to tailwind.config.ts theme.extend:
fontFamily: {
  sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
  serif: ['Vogun', 'Playfair Display', 'Georgia', 'serif'],  // ADD THIS
},
colors: {
  // Add cream background color
  'cream': '#f7f3ee',
},
```

---

## 9. Front-End Development Checklist

When building any page or component, verify against this checklist:

- [ ] Hero uses full-bleed image with left-side gradient overlay (not solid bg)
- [ ] Headlines use `font-serif` (Vogun), not sans-serif
- [ ] Nav bar is floating pill on hero, not solid full-width bar
- [ ] CTA buttons are pill-shaped with arrow circle icon
- [ ] Below-fold sections use cream `#f7f3ee` background, not white
- [ ] Body text uses Beige `#422a1f`, not black or gray
- [ ] Section labels are uppercase, violet, small, with dot separators
- [ ] Stats use large serif numbers with vertical divider
- [ ] All photography has warm/golden tone
- [ ] Form fields use underline style, not bordered boxes
- [ ] Cards have 16–24px border radius
- [ ] Mobile nav collapses to hamburger
- [ ] Footer uses aubergine-dark background
- [ ] No pure white backgrounds anywhere (use cream)
