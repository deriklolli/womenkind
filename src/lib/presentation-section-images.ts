// Maps component keys to their section images.
// Add new images here as they become available — ComponentSection picks them up automatically.
// side: which side the image appears on (alternates for visual rhythm)
// objectPosition: CSS object-position to frame the subject within the box

export interface SectionImage {
  src: string
  side: 'left' | 'right'
  objectPosition?: string
}

export const SECTION_IMAGES: Record<string, SectionImage> = {
  brain:    { src: '/presentation2.png', side: 'right', objectPosition: 'center top' },
  sleep:    { src: '/presentation3.png', side: 'left',  objectPosition: 'center 30%' },
  hormonal: { src: '/women/women-son.png', side: 'right', objectPosition: 'center 30%' },
  // Add more as images arrive, e.g.:
  // vasomotor:    { src: '/presentation5.png', side: 'left',  objectPosition: 'center top' },
  // mood:         { src: '/presentation6.png', side: 'right', objectPosition: 'center center' },
  // metabolism:   { src: '/presentation7.png', side: 'left',  objectPosition: 'center top' },
  // cardiovascular: { src: '/presentation8.png', side: 'right', objectPosition: 'center top' },
  // bone:         { src: '/presentation9.png', side: 'left',  objectPosition: 'center top' },
  // gsm:          { src: '/presentation10.png', side: 'right', objectPosition: 'center top' },
  // skin:         { src: '/presentation11.png', side: 'left',  objectPosition: 'center top' },
}
