import { invokeModel } from '@/lib/bedrock'
import { PRESENTATION_COMPONENTS, type PresentationComponent } from '@/lib/presentation-components'

/**
 * Generate patient-facing body copy for every presentation component, based
 * on a patient's intake answers + AI clinical brief. Runs the 10 components
 * in parallel. Individual failures are tolerated — the map contains whatever
 * succeeded. Call this once at intake-submit time so the doctor never waits
 * during the presentation-create flow.
 */
export async function generateComponentBodies(
  answers: Record<string, any>,
  aiBrief: any,
  firstName?: string | null
): Promise<Record<string, string>> {
  const name = normalizeName(firstName)

  const results = await Promise.allSettled(
    PRESENTATION_COMPONENTS.map(async (comp) => {
      const draft = await runBodyGeneration(comp, answers, aiBrief, name)
      return { key: comp.key, draft }
    })
  )

  const out: Record<string, string> = {}
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.draft) {
      out[r.value.key] = r.value.draft
    } else if (r.status === 'rejected') {
      console.error('[component-bodies] component generation failed:', r.reason)
    }
  }
  return out
}

/** Generate a single component body. Used by the on-demand / regenerate route. */
export async function generateSingleComponentBody(
  component: PresentationComponent,
  answers: Record<string, any>,
  aiBrief: any,
  firstName?: string | null
): Promise<string> {
  return runBodyGeneration(component, answers, aiBrief, normalizeName(firstName))
}

async function runBodyGeneration(
  component: PresentationComponent,
  answers: Record<string, any>,
  aiBrief: any,
  firstName: string | null
): Promise<string> {
  const prompt = buildBodyPrompt(component, answers, aiBrief, firstName)
  const draft = await invokeModel({
    maxTokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  return sanitize(draft)
}

function normalizeName(firstName?: string | null): string | null {
  return firstName && firstName.trim() ? firstName.trim() : null
}

/** Build a data block with only the sources that exist. Empty sources are omitted. */
function buildDataBlock(answers: Record<string, any>, aiBrief: any): string {
  const blocks: string[] = []

  const briefParts: string[] = []
  if (aiBrief?.metadata?.menopausal_stage) briefParts.push(`Menopausal stage: ${aiBrief.metadata.menopausal_stage}`)
  if (aiBrief?.metadata?.symptom_burden) briefParts.push(`Overall symptom burden: ${aiBrief.metadata.symptom_burden}`)
  if (aiBrief?.symptom_summary?.overview) briefParts.push(`Clinical overview: ${aiBrief.symptom_summary.overview}`)
  if (Array.isArray(aiBrief?.symptom_summary?.domains) && aiBrief.symptom_summary.domains.length) {
    briefParts.push(`Symptom domains: ${JSON.stringify(aiBrief.symptom_summary.domains)}`)
  }
  if (aiBrief?.treatment_pathway) briefParts.push(`Treatment pathway: ${JSON.stringify(aiBrief.treatment_pathway)}`)
  if (briefParts.length) blocks.push(`CLINICAL BRIEF FROM HER INTAKE:\n${briefParts.join('\n')}`)

  const rawBits: string[] = []
  if (answers?.top_concern) rawBits.push(`What she said her top concern is: "${answers.top_concern}"`)
  if (answers?.open_notes) rawBits.push(`Additional notes in her own words: "${answers.open_notes}"`)
  if (answers?.treatments_tried) rawBits.push(`Things she's already tried: "${answers.treatments_tried}"`)
  if (rawBits.length) blocks.push(`HER OWN WORDS FROM THE INTAKE:\n${rawBits.join('\n')}`)

  return blocks.length
    ? blocks.join('\n\n')
    : '(No detailed intake data is available. Stay warm and educational without inventing specifics.)'
}

function buildBodyPrompt(
  component: PresentationComponent,
  answers: Record<string, any>,
  aiBrief: any,
  firstName: string | null
): string {
  const dataBlock = buildDataBlock(answers, aiBrief)
  const whoLine = firstName
    ? `This is for a patient named ${firstName}. You may use her first name at most once, only if it helps the opening feel grounded. Most of the time, leave her name out entirely.`
    : `Do not use a name. Write in second person ("you", "your") throughout.`

  return `You are writing the body copy for the ${component.label} section of a personalized care summary that her doctor is about to send her. She will read this on a web page, before she sees a short note from her doctor.

SECTION: ${component.label}
WHY THIS BODY SYSTEM MATTERS IN MIDLIFE: ${component.clinicalRelevance}

WHAT YOU KNOW ABOUT HER:
${dataBlock}

Write exactly two paragraphs. Each paragraph should be three to five sentences.

Paragraph 1: Name what's happening for her in this body system, drawing on what she shared in her intake. If she used specific words, echo them gently. Connect the dots between what she's feeling and what's physiologically going on. If the intake data doesn't speak to this domain, keep it educational and do not invent specifics.

Paragraph 2: Explain how this gets addressed, tied to the treatment direction the brief suggests. Land on something that feels hopeful without being saccharine.

${whoLine}

VOICE RULES. These are strict. The output has to read as if a thoughtful human wrote it.

- Never use an em dash (—). Never use an en dash (–) as a sentence break. Use periods, commas, or parentheses instead. Short sentences are fine.
- Do not use double hyphens (--) as a substitute.
- Do not use any of these words or phrases: delve, dive into, dive in, navigate, journey, tapestry, realm, landscape, embrace, empower, empowering, embark, unlock, unveil, unpack, leverage, holistic, transformative, paradigm, pivotal, game-changer, in today's world, in this day and age, it's important to note, it's worth noting, moreover, furthermore, indeed, essentially, ultimately, that being said, all in all, at the end of the day.
- Use contractions where a human would (you're, we've, that's, it's).
- Vary sentence length. Do not start multiple sentences in a row with the same word.
- No bullet lists, no numbered lists, no headings, no bold text, no markdown.
- Speak plainly. If a clinical term is useful, put it in plain English first.
- Do not sign off. No "with care", no name, no signature line.
- Do not refer to "this section" or "this page" or "above" or "below". Just write the copy.

Output only the two paragraphs, separated by one blank line. No preamble, no title, no explanation of what you did.`
}

/** Final safety pass: strip any em/en dashes the model slipped in. */
function sanitize(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/\s*--\s*/g, ', ')
    .trim()
}
