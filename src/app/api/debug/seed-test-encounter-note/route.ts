import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encounter_notes, patients, providers, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/debug/seed-test-encounter-note
 * Seeds a realistic telehealth SOAP note for dlolli@gmail.com.
 * Mimics an AssemblyAI-transcribed + Bedrock-summarized video consultation.
 */
export async function POST() {
  try {
    // Find Derik's profile by email
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.email, 'dlolli@gmail.com'),
      columns: { id: true },
    })
    if (!profile) return NextResponse.json({ error: 'Profile not found for dlolli@gmail.com' }, { status: 404 })

    // Find patient record via profile_id
    const patient = await db.query.patients.findFirst({
      where: eq(patients.profile_id, profile.id),
      columns: { id: true },
    })
    if (!patient) return NextResponse.json({ error: 'Patient record not found' }, { status: 404 })

    // Get the first active provider (Dr. Urban)
    const provider = await db.query.providers.findFirst({
      where: eq(providers.is_active, true),
      columns: { id: true },
    })
    if (!provider) return NextResponse.json({ error: 'No active provider found' }, { status: 404 })

    const transcript = `Provider: Hi Derik, thanks for coming in today. How are you feeling since our last conversation?

Patient: Honestly, the nights have been really rough. I'm waking up two, sometimes three times and I'm just drenched. It's been going on for about three weeks now. And the fatigue during the day — I can barely get through the afternoon without feeling completely wiped out.

Provider: That's consistent with what we saw on your intake. Your Oura data also shows your sleep efficiency has been dropping — you're getting deep sleep but the night wake events are fragmenting it. When you wake up at night, are you having trouble getting back to sleep, or is it more that you wake up and feel hot and then eventually drift back?

Patient: It's the heat that wakes me up. Once I cool down I can usually get back to sleep in 20 or 30 minutes. But by that point it's like 3 AM and I'm just lying there with my mind racing.

Provider: And how's the mood been? You mentioned on your check-in that you rated it a 3 out of 5.

Patient: Yeah it fluctuates. I wouldn't say I'm depressed but I feel more irritable than usual. Little things that wouldn't have bothered me before are getting under my skin. And I feel kind of disconnected, like the brain fog is making it hard to track things at work.

Provider: That cognitive piece is really important. Estrogen directly modulates the neurotransmitters responsible for focus and working memory, so what you're describing is textbook neurological adjustment during this transition. It's not anxiety, it's not burnout — it's a hormonal effect.

Patient: That actually makes me feel better to hear that. I thought I was just losing it.

Provider: You're not losing it. You're adjusting. Now, given your symptom profile — the vasomotor symptoms, the sleep fragmentation, the cognitive changes, and your reproductive history — I want to talk about where we are with treatment.

Patient: I'm open to whatever makes sense. I know I said I was hesitant about HRT before but honestly I'm ready to reconsider if it helps.

Provider: That shift makes a lot of sense given what you're experiencing. Given that you have your uterus intact, we would use combined estradiol and progesterone. I'd suggest starting with a low-dose transdermal estradiol patch — 0.05mg — along with oral micronized progesterone 100mg at night. The progesterone at bedtime actually has a mild sedative effect which should help with the 3 AM wake-ups directly.

Patient: How soon would I notice a difference?

Provider: Most patients see meaningful improvement in hot flash frequency and severity within four to six weeks. Sleep typically responds faster — often within two to three weeks. The cognitive fog tends to clear as the vasomotor symptoms settle down.

Provider: I also want to revisit your bone health at our next visit. You haven't had a DEXA scan yet, and given your family history with your mother's hip fracture, that should be on our radar. Let's plan to order that in the next month.

Patient: Yeah I keep forgetting about that. I'll make sure to follow up.

Provider: Good. And your Oura ring is showing your resting heart rate has been slightly elevated over the past two weeks — averaging about 68 when your baseline was 62. That's consistent with disrupted sleep and elevated cortisol from the night sweats. It should normalize once we get the vasomotor symptoms under control.

Patient: I didn't even notice that. It's good that it's tracking.

Provider: Exactly. It gives us objective data to measure your response to treatment. I'll check back on those numbers at your follow-up in six weeks.`

    const [note] = await db
      .insert(encounter_notes)
      .values({
        patient_id: patient.id,
        provider_id: provider.id,
        source: 'telehealth',
        status: 'signed',
        transcript,
        chief_complaint: 'Worsening night sweats and sleep fragmentation over three weeks, with daytime fatigue and new-onset cognitive changes including brain fog and irritability.',
        hpi: `Patient presents with escalating vasomotor symptoms over the past three weeks, primarily nocturnal: waking 2-3 times per night with intense diaphoresis, requiring 20-30 minutes to return to sleep after cooling. Daytime fatigue is significant, with an afternoon energy nadir. Patient reports mood lability (irritability disproportionate to stressors) and cognitive symptoms including difficulty concentrating and working memory gaps at work. Review of Oura wearable data confirms sleep efficiency decline with fragmented architecture, elevated resting heart rate (avg 68 bpm vs baseline 62 bpm over 14 days), and temperature deviation consistent with vasomotor activity. Patient previously hesitant about HRT; on today's visit she expressed openness to initiating therapy given symptom severity.`,
        ros: `Vasomotor: Positive for hot flashes (primarily nocturnal), night sweats 2-3x nightly, estimated duration 20-30 minutes per episode. Sleep: Positive for sleep maintenance insomnia secondary to vasomotor events; sleep initiation intact. Neurological/Cognitive: Positive for brain fog, word-finding difficulty, irritability. Cardiovascular: No palpitations, no chest pain; resting HR mildly elevated per wearable (attributed to sleep disruption and cortisol elevation). Genitourinary: Denies vaginal dryness or dysuria at this visit. Musculoskeletal: No new joint pain reported. Mood: Positive for irritability; denies depressed mood or anhedonia.`,
        assessment: `Perimenopause with moderate-to-severe vasomotor symptom burden, sleep fragmentation, and associated cognitive changes. Wearable biometrics corroborate symptom severity with objective elevation in resting heart rate and temperature deviation over the past 30 days. Patient is an appropriate candidate for menopausal hormone therapy. Uterus intact — combined estrogen-progestogen regimen indicated. Bone health surveillance overdue given maternal hip fracture history; DEXA scan not yet obtained.`,
        plan: `1. Initiate transdermal estradiol 0.05mg/24hr patch (Vivelle-Dot), apply twice weekly to lower abdomen or buttock. Counsel on rotation sites and adhesion.
2. Initiate oral micronized progesterone (Prometrium) 100mg PO QHS. Counsel on sedative benefit at bedtime dosing — may assist with sleep maintenance.
3. Order DEXA scan for bone density baseline given maternal hip fracture history and perimenopause status.
4. Follow-up visit in 6 weeks to assess HRT response. Target endpoints: reduction in hot flash frequency and severity, improvement in sleep efficiency (track via Oura), normalization of resting heart rate, and improvement in cognitive symptoms.
5. Patient instructed to contact office if breakthrough bleeding, breast tenderness, or headaches develop in the interim.`,
      })
      .returning({ id: encounter_notes.id })

    return NextResponse.json({
      ok: true,
      encounter_note_id: note.id,
      patient_id: patient.id,
      provider_id: provider.id,
      message: 'Test encounter note seeded for dlolli@gmail.com',
    })
  } catch (err: unknown) {
    console.error('seed-test-encounter-note error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
