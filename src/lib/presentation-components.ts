// Registry of the 10 clinical body system components for care presentations
// Each component has metadata, clinical context, and visual configuration

export interface PresentationComponent {
  key: string
  label: string
  shortLabel: string
  icon: string  // SVG path for card thumbnails
  description: string  // What this system does
  clinicalRelevance: string  // Why it matters in menopause
  defaultExplanation: string  // Warm, patient-facing default text
  color: string  // Brand-consistent accent color
  silhouetteZone: { cx: number; cy: number; r: number }  // Where to highlight on body silhouette (relative %)
}

export const PRESENTATION_COMPONENTS: PresentationComponent[] = [
  {
    key: 'brain',
    label: 'Brain & Cognition',
    shortLabel: 'Brain',
    icon: 'M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 002 2h4a2 2 0 002-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7z',
    description: 'Neural networks, memory, focus, and cognitive processing',
    clinicalRelevance: 'Estrogen is a key neuroprotective hormone. As levels decline, many women experience brain fog, difficulty concentrating, and memory changes. These are real neurological effects, not imagined.',
    defaultExplanation: 'You may have noticed changes in your thinking — moments of forgetfulness, difficulty finding words, or trouble focusing. This is your brain adjusting to changing hormone levels. Estrogen plays an important role in brain function, and as levels shift, these cognitive changes are common and expected.',
    color: '#944fed',
    silhouetteZone: { cx: 50, cy: 8, r: 8 },
  },
  {
    key: 'vasomotor',
    label: 'Nervous System & Vasomotor',
    shortLabel: 'Vasomotor',
    icon: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
    description: 'Thermoregulation, hot flashes, and night sweats',
    clinicalRelevance: 'The hypothalamus (body\'s thermostat) becomes more sensitive to small temperature changes as estrogen declines, triggering vasomotor symptoms — the hallmark of menopause.',
    defaultExplanation: 'Hot flashes and night sweats happen because your body\'s internal thermostat has become more sensitive. Changing estrogen levels affect the part of your brain that regulates temperature, causing it to overreact to small changes. This is the most common symptom of menopause, and there are effective treatments available.',
    color: '#d85623',
    silhouetteZone: { cx: 50, cy: 15, r: 7 },
  },
  {
    key: 'metabolism',
    label: 'Metabolism & Weight',
    shortLabel: 'Metabolism',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    description: 'Metabolic rate, energy processing, and body composition',
    clinicalRelevance: 'Estrogen helps regulate metabolism and fat distribution. Its decline leads to metabolic slowdown, increased visceral fat, and changes in insulin sensitivity — increasing cardiovascular and metabolic risk.',
    defaultExplanation: 'Many women notice changes in their weight and body shape during this transition, even without changes in diet or exercise. This happens because estrogen influences how your body processes energy and where it stores fat. Understanding this helps us create a targeted approach to maintaining your metabolic health.',
    color: '#e8913a',
    silhouetteZone: { cx: 50, cy: 42, r: 9 },
  },
  {
    key: 'cardiovascular',
    label: 'Cardiovascular Health',
    shortLabel: 'Heart',
    icon: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    description: 'Heart function, blood pressure, and vascular health',
    clinicalRelevance: 'Pre-menopause, estrogen provides significant cardiovascular protection. After menopause, women\'s cardiovascular risk rises to match men\'s — making monitoring and prevention essential.',
    defaultExplanation: 'Before menopause, estrogen helps protect your heart and blood vessels. As estrogen levels decline, your cardiovascular risk gradually increases. This is why we monitor your lipid levels and blood pressure, and why heart health becomes an important part of your care plan going forward.',
    color: '#e04f5f',
    silhouetteZone: { cx: 47, cy: 30, r: 7 },
  },
  {
    key: 'bone',
    label: 'Bone & Skeletal Health',
    shortLabel: 'Bone',
    icon: 'M12 2L8 6v4l-4 4v4l4 4h8l4-4v-4l-4-4V6l-4-4z',
    description: 'Bone density, skeletal strength, and calcium metabolism',
    clinicalRelevance: 'Estrogen is critical for bone remodeling. In the first 5-7 years after menopause, women can lose up to 20% of bone density — making early monitoring and intervention important.',
    defaultExplanation: 'Your bones are constantly rebuilding themselves, and estrogen plays a key role in that process. As estrogen levels drop, bone loss can accelerate significantly. The good news is that we can monitor your bone health and take steps to protect your skeletal strength during this transition.',
    color: '#8b9dc3',
    silhouetteZone: { cx: 50, cy: 55, r: 10 },
  },
  {
    key: 'sleep',
    label: 'Sleep & Circadian Rhythm',
    shortLabel: 'Sleep',
    icon: 'M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z',
    description: 'Sleep quality, circadian regulation, and rest patterns',
    clinicalRelevance: 'Declining estrogen and progesterone directly affect sleep architecture, melatonin production, and circadian rhythm — often compounded by night sweats.',
    defaultExplanation: 'If you\'re struggling with sleep, you\'re not alone — it\'s one of the most common concerns during this transition. Hormonal changes affect the brain chemicals that regulate your sleep-wake cycle, and night sweats can further disrupt rest. Improving sleep is often one of the first things we focus on because it impacts everything else.',
    color: '#5d9ed5',
    silhouetteZone: { cx: 50, cy: 10, r: 6 },
  },
  {
    key: 'mood',
    label: 'Mood & Mental Health',
    shortLabel: 'Mood',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-6c.78 2.34 2.72 4 5 4s4.22-1.66 5-4H7z',
    description: 'Emotional regulation, anxiety, depression, and mental wellbeing',
    clinicalRelevance: 'Estrogen modulates serotonin, dopamine, and norepinephrine — the brain\'s key mood neurotransmitters. Its decline can trigger anxiety, irritability, low mood, and emotional volatility.',
    defaultExplanation: 'Mood changes during this time are not "just stress" — they have a real biological basis. Estrogen influences the brain chemicals that regulate mood, and as levels fluctuate, you may experience anxiety, irritability, or low mood that feels different from anything before. Recognizing this connection is the first step toward feeling more like yourself again.',
    color: '#7c6bc4',
    silhouetteZone: { cx: 50, cy: 12, r: 7 },
  },
  {
    key: 'hormonal',
    label: 'Hormonal & Reproductive',
    shortLabel: 'Hormonal',
    icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
    description: 'Estrogen, progesterone, FSH levels, and reproductive changes',
    clinicalRelevance: 'The central driver of menopause: ovarian estrogen and progesterone production declines while FSH rises. Understanding your hormone profile guides treatment decisions.',
    defaultExplanation: 'At the core of everything you\'re experiencing is a natural shift in your hormone levels. Your ovaries are gradually producing less estrogen and progesterone, and your brain is sending stronger signals (FSH) trying to compensate. Your lab results help us understand exactly where you are in this transition and how to best support you.',
    color: '#c2796d',
    silhouetteZone: { cx: 50, cy: 48, r: 8 },
  },
  {
    key: 'gsm',
    label: 'Genitourinary Health',
    shortLabel: 'GSM',
    icon: 'M12 21c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9zm0-16c-3.87 0-7 3.13-7 7s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm1 11h-2v-2h2v2zm0-4h-2V8h2v4z',
    description: 'Vaginal health, urinary function, and mucosal tissue integrity',
    clinicalRelevance: 'Genitourinary Syndrome of Menopause (GSM) affects up to 84% of postmenopausal women. Unlike vasomotor symptoms, GSM tends to worsen over time without treatment.',
    defaultExplanation: 'Changes in vaginal and urinary health are among the most common — yet least discussed — effects of declining estrogen. These tissues are highly sensitive to hormone levels, and changes like dryness, discomfort, or urinary symptoms tend to progress without treatment. The good news is that effective, targeted treatments are available.',
    color: '#d4869c',
    silhouetteZone: { cx: 50, cy: 58, r: 7 },
  },
  {
    key: 'skin',
    label: 'Skin, Hair & Aging',
    shortLabel: 'Skin & Hair',
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    description: 'Collagen production, skin elasticity, and hair health',
    clinicalRelevance: 'Estrogen stimulates collagen production and maintains skin thickness. Women lose approximately 30% of skin collagen in the first 5 years after menopause, accelerating visible aging.',
    defaultExplanation: 'You may have noticed changes in your skin and hair — dryness, thinning, or loss of elasticity that seems to have accelerated. Estrogen plays a major role in collagen production, and as levels decline, these visible changes happen faster. While these are natural, there are strategies that can help support your skin and hair health during this transition.',
    color: '#d4a574',
    silhouetteZone: { cx: 50, cy: 20, r: 12 },
  },
]

// Lookup helper
export const getComponent = (key: string) =>
  PRESENTATION_COMPONENTS.find((c) => c.key === key)

// Get multiple components by key array
export const getComponents = (keys: string[]) =>
  keys.map((k) => PRESENTATION_COMPONENTS.find((c) => c.key === k)).filter(Boolean) as PresentationComponent[]
