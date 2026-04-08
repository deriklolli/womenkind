import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// Lazy-init: don't create at module scope (breaks Vercel build when env vars missing)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * POST /api/intake/submit
 * Finalizes an intake: marks as submitted, triggers AI brief generation
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const { intakeId, patientId, answers } = await req.json()

    // 1. Resolve provider — look up the first active provider as the intake recipient
    //    (single-provider MVP; extend this to match by location/specialty in multi-provider phase)
    const { data: providerRow } = await supabase
      .from('providers')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    const providerId = providerRow?.id ?? null

    // 2. Update intake status to submitted (and link to patient + provider if resolved)
    const { error: updateError } = await supabase
      .from('intakes')
      .update({
        status: 'submitted',
        answers,
        submitted_at: new Date().toISOString(),
        ...(patientId ? { patient_id: patientId } : {}),
        ...(providerId ? { provider_id: providerId } : {}),
      })
      .eq('id', intakeId)

    if (updateError) throw updateError

    // 2. Generate AI clinical brief via Claude API
    let aiBrief = null
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (anthropicKey) {
      try {
        aiBrief = await generateClinicalBrief(answers, anthropicKey)

        // Save brief to intake
        await supabase
          .from('intakes')
          .update({ ai_brief: aiBrief })
          .eq('id', intakeId)
      } catch (aiErr) {
        console.error('AI brief generation error:', aiErr)
        // Don't fail the submission — brief can be generated later
      }
    }

    // Send intake confirmation emails (fire and forget)
    if (patientId && process.env.RESEND_API_KEY) {
      sendIntakeEmails(supabase, { patientId, intakeId }).catch(err =>
        console.error('[RESEND] Intake email error:', err)
      )
    }

    return NextResponse.json({
      success: true,
      briefGenerated: !!aiBrief,
    })
  } catch (err: any) {
    console.error('Intake submit error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function sendIntakeEmails(
  supabase: ReturnType<typeof getSupabase>,
  { patientId, intakeId }: { patientId: string; intakeId: string }
) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const from = process.env.RESEND_FROM_EMAIL || 'Womenkind <care@womenkind.com>'

  // Fetch patient name + email
  const { data: patient } = await supabase
    .from('patients')
    .select('profiles(first_name, last_name, email)')
    .eq('id', patientId)
    .single()

  const profile = (patient as any)?.profiles
  const patientEmail = profile?.email
  const firstName = profile?.first_name || 'there'

  const submittedAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'America/Denver',
  }) + ' MT'

  // Email 1 — Patient confirmation
  if (patientEmail) {
    await resend.emails.send({
      from,
      to: patientEmail,
      subject: `We received your intake, ${firstName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body bgcolor="#f7f3ee" style="margin: 0; padding: 0; background-color: #f7f3ee; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee;">
    <tr>
      <td align="center" style="padding: 48px 24px 40px 24px;">
        <img src="${appUrl}/womenkind-logo-dark.png" alt="Womenkind" style="height: 96px;" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 24px 48px 24px;">
        <table role="presentation" width="610" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 610px; width: 100%; background-color: #ffffff; border-radius: 20px; border: 1px solid #f2f1f4;">
          <tr>
            <td style="padding: 48px 44px;">
              <h1 style="font-family: Georgia, 'Playfair Display', serif; font-size: 26px; color: #280f49; margin: 0 0 8px 0; font-weight: normal;">
                Your intake is in, ${firstName}
              </h1>
              <p style="font-size: 15px; color: #7b6a62; line-height: 1.7; margin: 0 0 32px 0;">
                Thank you for completing your health intake. Your provider will review it before your consultation. If you have any questions in the meantime, you can reach us through your dashboard.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #944fed; border-radius: 9999px;">
                          <a href="${appUrl}/patient/dashboard" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 15px; font-weight: 500; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;">
                            View Your Dashboard&nbsp;&nbsp;&#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 24px 48px 24px;">
        <p style="font-size: 12px; color: #d0cac7; margin: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;">
          Womenkind &mdash; Personalized menopause &amp; midlife care
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    })
    console.log(`[RESEND] Intake confirmation sent to ${patientEmail}`)
  }

  // Email 2 — Provider alert
  const providerEmail = process.env.PROVIDER_EMAIL
  if (providerEmail) {
    const patientFullName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : 'A new patient'

    await resend.emails.send({
      from,
      to: providerEmail,
      subject: 'New patient intake ready for review',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body bgcolor="#f7f3ee" style="margin: 0; padding: 0; background-color: #f7f3ee; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee;">
    <tr>
      <td align="center" style="padding: 48px 24px 40px 24px;">
        <img src="${appUrl}/womenkind-logo-dark.png" alt="Womenkind" style="height: 96px;" />
      </td>
    </tr>
    <tr>
      <td align="center">
        <table role="presentation" width="610" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 610px; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 36px 32px 36px;">
              <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: normal; font-family: Georgia, 'Playfair Display', serif; color: #280f49;">
                New intake ready to review
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; color: #8e7f79; line-height: 1.5;">
                A new patient has completed their health intake.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f3ee" style="background-color: #f7f3ee; border-radius: 12px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #280f49;">
                      ${patientFullName}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #a1958f;">
                      Submitted ${submittedAt}
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/provider/patients/${patientId}" style="display: inline-block; padding: 14px 32px; background-color: #944fed; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 9999px;">
                      Review Intake
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 32px 24px 48px 24px;">
        <p style="margin: 0; font-size: 12px; color: #bdb4b1;">
          Womenkind &mdash; Personalized menopause &amp; midlife care
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    })
    console.log(`[RESEND] New intake alert sent to ${providerEmail}`)
  }
}

async function generateClinicalBrief(answers: Record<string, any>, apiKey: string) {
  // Build a readable patient summary from structured answers
  const patientProfile = buildPatientProfile(answers)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a menopause-specialist clinical intake analyst for Womenkind, a telehealth menopause care platform. Your role is to transform patient intake questionnaire data into a structured, clinically actionable pre-visit brief for the reviewing provider (MD/NP).

Key context:
- Womenkind treats perimenopausal and postmenopausal patients
- The brief is NOT a diagnosis — it is a structured pre-visit summary to save provider time
- Providers are menopause-trained clinicians — use appropriate clinical terminology
- Reference current menopause care guidelines (IMS, NAMS, Menopause Society) where relevant
- Preserve the patient's own words when they add clinical value
- Be specific to THIS patient — never use generic boilerplate`,
      messages: [
        {
          role: 'user',
          content: `Generate a clinical brief for this patient. Return ONLY a JSON object with no markdown wrapping.

PATIENT INTAKE DATA:
${patientProfile}

Return this exact JSON structure:

{
  "symptom_summary": {
    "overview": "2-3 sentence clinical snapshot of this patient",
    "domains": [
      {
        "domain": "Domain name (e.g., Vasomotor, Mood & Cognition)",
        "severity": "none | mild | moderate | severe",
        "findings": "Specific findings from this patient's data",
        "patient_language": "Direct quotes or paraphrases of patient's own words where relevant"
      }
    ]
  },
  "risk_flags": {
    "urgent": ["Items requiring immediate attention — empty array if none"],
    "contraindications": ["Factors that affect treatment selection"],
    "considerations": ["Non-urgent but clinically relevant factors"]
  },
  "treatment_pathway": {
    "recommended_approach": "Primary treatment direction based on symptom profile + risk factors",
    "options": [
      {
        "treatment": "Specific treatment option",
        "rationale": "Why this fits this patient",
        "considerations": "Risks or monitoring needed for this patient specifically"
      }
    ],
    "patient_preferences": "What the patient indicated about treatment openness and dosing preferences"
  },
  "suggested_questions": [
    {
      "question": "Specific question for the provider to ask",
      "context": "Why this question matters based on the intake data"
    }
  ],
  "metadata": {
    "menopausal_stage": "Pre-menopause | Perimenopause | Post-menopause | Surgical menopause | Uncertain",
    "symptom_burden": "low | moderate | high | severe",
    "complexity": "straightforward | moderate | complex",
    "generated_at": "${new Date().toISOString()}"
  }
}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${errorText}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''

  // Parse the JSON from Claude's response
  try {
    return JSON.parse(text)
  } catch {
    // If Claude returns markdown-wrapped JSON, extract it
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    // Return as raw text if JSON parsing fails
    return { raw_brief: text }
  }
}

/**
 * Transforms raw answers into a readable clinical profile for the AI prompt.
 * This produces better briefs than dumping raw JSON — it gives Claude
 * structured context about what each answer means clinically.
 */
function buildPatientProfile(answers: Record<string, any>): string {
  const sections: string[] = []

  // Demographics
  const demo: string[] = []
  if (answers.full_name) demo.push(`Name: ${answers.full_name}`)
  if (answers.dob) demo.push(`DOB: ${answers.dob}`)
  if (answers.height) demo.push(`Height: ${answers.height}`)
  if (answers.weight) demo.push(`Weight: ${answers.weight}`)
  if (demo.length) sections.push(`DEMOGRAPHICS:\n${demo.join('\n')}`)

  // Goals
  const goals: string[] = []
  if (answers.top_concern) goals.push(`Primary concern (patient's words): "${answers.top_concern}"`)
  if (answers.priorities) goals.push(`Health priorities: ${formatAnswer(answers.priorities)}`)
  if (goals.length) sections.push(`PATIENT GOALS:\n${goals.join('\n')}`)

  // Reproductive history
  const repro: string[] = []
  if (answers.uterus) repro.push(`Uterus: ${answers.uterus}`)
  if (answers.ovaries) repro.push(`Ovaries: ${answers.ovaries}`)
  if (answers.menstrual) repro.push(`Menstrual status: ${answers.menstrual}`)
  if (answers.lmp) repro.push(`Last menstrual period: ${answers.lmp}`)
  if (answers.cycle_changes) repro.push(`Cycle changes (past 12 months): ${formatAnswer(answers.cycle_changes)}`)
  if (answers.abnormal_bleeding) repro.push(`Abnormal bleeding: ${formatAnswer(answers.abnormal_bleeding)}`)
  if (repro.length) sections.push(`REPRODUCTIVE HISTORY:\n${repro.join('\n')}`)

  // Health basics
  const health: string[] = []
  if (answers.bp_known === 'Yes') {
    health.push(`Blood pressure: ${answers.bp_sys || '?'}/${answers.bp_dia || '?'}`)
  } else if (answers.bp_known) {
    health.push(`Blood pressure: Unknown`)
  }
  if (health.length) sections.push(`HEALTH BASICS:\n${health.join('\n')}`)

  // Medications
  const meds: string[] = []
  if (answers.current_meds) meds.push(`Current medications: ${formatAnswer(answers.current_meds)}`)
  if (answers.meds_detail) meds.push(`Medication details: "${answers.meds_detail}"`)
  if (answers.allergies === 'Yes') {
    meds.push(`Allergies: ${answers.allergy_detail || 'Yes (no details)'}`)
  } else if (answers.allergies) {
    meds.push(`Allergies: None reported`)
  }
  if (answers.peanut) meds.push(`Peanut allergy: ${answers.peanut}`)
  if (meds.length) sections.push(`MEDICATIONS & ALLERGIES:\n${meds.join('\n')}`)

  // Medical history
  const hx: string[] = []
  if (answers.cardio) hx.push(`Cardiovascular/clotting: ${formatAnswer(answers.cardio)}`)
  if (answers.smoking) hx.push(`Smoking: ${answers.smoking}`)
  if (answers.cancer) {
    hx.push(`Hormone-sensitive cancer: ${answers.cancer}${answers.cancer_detail ? ` — ${answers.cancer_detail}` : ''}`)
  }
  if (answers.other_conditions) hx.push(`Other conditions: ${formatAnswer(answers.other_conditions)}`)
  if (hx.length) sections.push(`MEDICAL HISTORY:\n${hx.join('\n')}`)

  // Vasomotor symptoms
  const vms: string[] = []
  if (answers.hf_freq) vms.push(`Hot flash frequency: ${answers.hf_freq}`)
  if (answers.hf_severity) vms.push(`Hot flash severity: ${answers.hf_severity}`)
  if (answers.hf_sleep) vms.push(`Sleep disruption from VMS: ${answers.hf_sleep}`)
  if (answers.hf_duration) vms.push(`Hot flash duration: ${answers.hf_duration}`)
  if (answers.hf_interference) vms.push(`Daily interference: ${answers.hf_interference}`)
  if (answers.hf_assoc) vms.push(`Associated symptoms: ${formatAnswer(answers.hf_assoc)}`)
  if (vms.length) sections.push(`VASOMOTOR SYMPTOMS:\n${vms.join('\n')}`)

  // Mood & cognition
  const mood: string[] = []
  const moodFields = [
    ['palpitations', 'Palpitations'],
    ['joint_pain', 'Joint pain/stiffness'],
    ['sleep_falling', 'Difficulty falling asleep'],
    ['sleep_waking', 'Night waking (3 AM)'],
    ['wired_tired', 'Wired but tired'],
    ['low_mood', 'Low mood/depression'],
    ['irritability', 'Irritability/rage'],
    ['anxiety', 'Anxiety/restlessness'],
    ['brain_fog', 'Brain fog/forgetfulness'],
    ['fatigue', 'Fatigue'],
    ['sexual_change', 'Sexual desire change'],
  ] as const
  for (const [key, label] of moodFields) {
    if (answers[key] && answers[key] !== 'None') mood.push(`${label}: ${answers[key]}`)
  }
  if (mood.length) sections.push(`MOOD, COGNITION & QUALITY OF LIFE:\n${mood.join('\n')}`)

  // Vaginal & bladder
  const gsm: string[] = []
  if (answers.gsm) gsm.push(`GSM symptoms: ${formatAnswer(answers.gsm)}`)
  if (answers.bladder_sev && answers.bladder_sev !== 'None') gsm.push(`Bladder severity: ${answers.bladder_sev}`)
  if (answers.vaginal_sev && answers.vaginal_sev !== 'None') gsm.push(`Vaginal severity: ${answers.vaginal_sev}`)
  if (gsm.length) sections.push(`VAGINAL & BLADDER (GSM):\n${gsm.join('\n')}`)

  // Body & bone
  const bone: string[] = []
  if (answers.midsection) bone.push(`Midsection weight gain: ${answers.midsection}`)
  if (answers.strength) bone.push(`Strength training: ${answers.strength}${answers.strength_days ? ` (${answers.strength_days} days/week)` : ''}`)
  if (answers.protein) bone.push(`Daily protein: ~${answers.protein}g`)
  if (answers.alcohol) bone.push(`Alcohol: ~${answers.alcohol} drinks/week`)
  if (answers.fracture) bone.push(`Fracture after 40: ${answers.fracture}`)
  if (answers.parent_hip) bone.push(`Parent hip fracture: ${answers.parent_hip}`)
  if (answers.family_osteo) bone.push(`Family osteoporosis: ${answers.family_osteo}`)
  if (answers.dexa) bone.push(`DEXA scan: ${answers.dexa}`)
  if (bone.length) sections.push(`BODY COMPOSITION & BONE HEALTH:\n${bone.join('\n')}`)

  // Treatment preferences
  const tx: string[] = []
  if (answers.bc_need) tx.push(`Birth control need: ${answers.bc_need}`)
  if (answers.treatments_tried) tx.push(`Previously tried: "${answers.treatments_tried}"`)
  if (answers.tx_openness) tx.push(`Open to: ${formatAnswer(answers.tx_openness)}`)
  if (answers.dosing_pref) tx.push(`Dosing preference: ${answers.dosing_pref}`)
  if (answers.open_notes) tx.push(`Additional notes (patient's words): "${answers.open_notes}"`)
  if (tx.length) sections.push(`TREATMENT PREFERENCES:\n${tx.join('\n')}`)

  return sections.join('\n\n')
}

function formatAnswer(val: any): string {
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}
