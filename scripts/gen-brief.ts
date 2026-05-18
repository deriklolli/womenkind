import 'dotenv/config'
import { db } from '../src/lib/db'
import { generateClinicalBrief } from '../src/lib/intake-brief'
import { intakes } from '../src/lib/db/schema'
import { eq } from 'drizzle-orm'

const intakeId = '764ef926-0eba-49a3-a9da-95e1b854eabc'

async function main() {
  const intake = await db.query.intakes.findFirst({
    where: eq(intakes.id, intakeId),
    columns: { answers: true, ai_brief: true },
  })

  if (!intake?.answers) {
    console.error('Intake not found or no answers')
    process.exit(1)
  }

  if (intake.ai_brief) {
    console.log('Brief already exists — nothing to do.')
    process.exit(0)
  }

  console.log('Generating clinical brief via Bedrock...')
  const brief = await generateClinicalBrief(intake.answers as Record<string, any>)
  await db.update(intakes).set({ ai_brief: brief }).where(eq(intakes.id, intakeId))
  console.log('Done! Brief saved to intake', intakeId)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
