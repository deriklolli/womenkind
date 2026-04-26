import { NextResponse } from 'next/server'

/**
 * GET /api/presentations/mock/blueprint-content
 * Returns hardcoded presentation data for local UI development.
 * Access via: http://localhost:3000/presentation-blueprint.html?id=mock
 *
 * To refresh content: run `npx tsx scripts/test-deep-dive.ts` and paste
 * updated output into the components below.
 */
export async function GET() {
  return NextResponse.json({
    patient: { firstName: 'Derik', fullName: 'Derik Lolli' },
    provider: { name: 'Dr. Joseph Urban Jr.' },
    presentation: {
      welcomeMessage: null,
      closingMessage: null,
      selectedComponents: [
        'vasomotor', 'sleep', 'mood', 'brain',
        'hormonal', 'bone', 'metabolism', 'cardiovascular', 'gsm', 'skin',
      ],
      components: {
        vasomotor: {
          lead: "You told me night sweats and fatigue are making it hard to function at work. That's not just discomfort. Waking 2-3 times a night, spending 20-30 minutes cooling down each time, then pushing through the next day is a real physiological burden.",
          dr_card: "You came in after three weeks of waking drenched, exhausted, and struggling to keep up at work. We're starting treatment today, and I expect you to feel a meaningful difference within the first few weeks.",
          dr_quote: "Your night sweats aren't just uncomfortable — they're measurably disrupting your sleep architecture, your heart rate, and your ability to function the next day. That's exactly what the Vivelle-Dot patch and progesterone at bedtime are designed to address.",
          dr_body: "I'm starting you on the transdermal estradiol 0.05mg/24hr patch, applied twice weekly, to stabilize the estrogen fluctuations that are triggering your hypothalamus to fire 2-3 times a night. The oral micronized progesterone 100mg at bedtime works alongside it, protecting your uterus and adding a mild sedative effect that should help you stay asleep once the vasomotor events quiet down. Your Oura temperature deviation of +0.4°C over 30 days gives us a concrete baseline to measure against as treatment takes effect.",
          plan: [
            { when: 'Starting today', title: 'Apply your first Vivelle-Dot patch', detail: 'Apply the 0.05mg/24hr estradiol patch to clean, dry skin on your lower abdomen or upper buttock. Rotate the site with each change. You\'ll replace it every 3-4 days, twice weekly on a consistent schedule. This is the primary treatment targeting the hypothalamic misfires causing your night sweats.' },
            { when: 'Starting tonight', title: 'Take progesterone 100mg at bedtime', detail: 'Take one oral micronized progesterone capsule (100mg) at bedtime every night. Because you have a uterus, this is required alongside estrogen. The mild sedative effect works with your sleep window, so don\'t take it earlier in the evening.' },
            { when: 'Ongoing, 6 weeks', title: 'Track night sweat frequency via Oura', detail: 'Each morning, note how many times you woke from a hot flash and how long it took to fall back asleep. Watch your Oura nightly temperature deviation trend down from +0.4°C average as estradiol levels stabilize. Bring this data to your 6-week follow-up.' },
            { when: 'Before 6-week visit', title: 'Schedule your DEXA scan', detail: "I'm ordering a DEXA scan to assess your bone density. Given your maternal hip fracture history, this surveillance is overdue. Call the imaging center to schedule it so we have results in hand when we meet in 6 weeks." },
          ],
          stat: { value: '+0.4°C', label: 'avg nightly temperature deviation (Oura, 30 days)' },
          body: null,
          providerNote: null,
        },
        sleep: {
          lead: "You described waking at 3 AM, mind racing after cooling down, and needing 20 to 30 minutes to fall back asleep. That's happening 2 to 3 times every night. Your Oura data backs this up: your sleep score has dropped to an average of 68 and is still trending down.",
          dr_card: "You told me the night sweats and fatigue are making it hard to function at work, and your wearable data confirms your sleep has been deteriorating for weeks. We're starting a treatment plan designed to address the root cause of those wake-ups directly.",
          dr_quote: "Your sleep fragmentation isn't a separate problem from your night sweats. It's the same problem, and the treatment we're starting addresses both at once.",
          dr_body: "The oral micronized progesterone 100mg you're taking at bedtime has a mild sedative effect through its GABA-A receptor activity, meaning it works with your brain's own calming system to help you stay asleep. The transdermal estradiol patch addresses the vasomotor events themselves, which your Oura data has been capturing as temperature deviations averaging +0.4°C nightly. With those two working together, I expect your 3 AM wake-ups to become less frequent as your estradiol levels stabilize over the coming weeks.",
          plan: [
            { when: 'Tonight', title: 'Take your progesterone at bedtime, not earlier', detail: 'Take your oral micronized progesterone 100mg right before you get into bed. Timing matters because its calming effect peaks within the first hour. Taking it earlier means you may lose that benefit before your most vulnerable sleep window.' },
            { when: 'This week', title: 'Apply your first estradiol patch', detail: 'Apply your Vivelle-Dot 0.05mg/24hr patch to clean, dry skin on your lower abdomen or upper buttock. Replace it twice a week on the same two days each week.' },
            { when: 'Ongoing', title: 'Keep your Oura Ring charged through the night', detail: 'Your Oura sleep score, temperature deviation, and resting heart rate are giving us objective data to track how your sleep architecture responds to treatment. Make sure your ring is charged and worn every night so we have a clean 6-week picture.' },
            { when: '6-week follow-up', title: 'Report any breakthrough bleeding or breast tenderness', detail: 'Some spotting or breast tenderness can occur in the first weeks as your body adjusts to combined estrogen-progesterone therapy. Jot down any episodes with the date so we can assess the pattern together.' },
          ],
          stat: { value: '68', label: 'your avg Oura sleep score over the past 30 days, trending down' },
          body: null,
          providerNote: null,
        },
        mood: {
          lead: "You said it clearly: 'The irritability is affecting my relationships.' That's not stress. That's estrogen-driven disruption to the brain circuits that regulate mood, and it's something we can directly address.",
          dr_card: "You told me the irritability doesn't match the size of the stressors, and that you don't feel like yourself. Starting estradiol and progesterone together targets exactly the hormonal fluctuation driving that.",
          dr_quote: "What you're experiencing isn't a personality change — it's a neurochemical one, and it's directly tied to the estrogen fluctuations we're now treating.",
          dr_body: "Estrogen regulates serotonin, dopamine, and norepinephrine — the brain's primary mood stabilizers. As your levels have been swinging in perimenopause, your brain has been running short on the chemistry it needs to buffer stress and stay even. The transdermal estradiol 0.05mg patch will work toward steadying those levels, and the oral micronized progesterone 100mg at bedtime carries its own calming effect through progesterone's action on GABA receptors, the same pathway targeted by anti-anxiety medications.",
          plan: [
            { when: 'Starting this week', title: 'Apply your first estradiol patch', detail: "Apply the Vivelle-Dot 0.05mg/24hr patch to clean, dry skin on your lower abdomen or upper buttock. Change it every 3-4 days on a consistent schedule. Steady estradiol levels are key to mood stabilization, so consistency with patch changes matters." },
            { when: 'Every night at bedtime', title: 'Take your progesterone at the same time each night', detail: "Take the oral micronized progesterone 100mg at bedtime, not in the morning. This timing is intentional — progesterone has a mild calming effect that supports both sleep and mood." },
            { when: 'Over the next 6 weeks', title: 'Track your mood and irritability weekly', detail: "Note your irritability level and any moments where you felt disconnected or not yourself. A brief note in your phone works fine. This gives us something concrete to compare at your 6-week follow-up." },
            { when: 'At your 6-week follow-up', title: 'Report what\'s changed in your relationships and sense of self', detail: "The benchmark you gave me is clear: the irritability affecting your relationships. At our follow-up, I want to hear specifically whether that has improved." },
          ],
          stat: { value: '3/5', label: 'your mood and cognition score at today\'s visit' },
          body: null,
          providerNote: null,
        },
        brain: {
          lead: "You told me brain fog is making it hard to track things at work. That's not stress or distraction. That's your brain responding to shifting estrogen levels, and it's measurable.",
          dr_card: "You described losing your train of thought at work and struggling to find words, and your Oura readiness score has been averaging 64 and declining. Starting the estradiol patch will directly address the hormonal driver behind these cognitive changes.",
          dr_quote: "The brain fog you're experiencing is a direct neurological effect of declining estrogen, and it's measurable in your data. We're treating the root cause.",
          dr_body: "Your Oura readiness score has dropped to an average of 64 over the past 30 days, your resting heart rate is running 6 bpm above your personal baseline, and you're losing 20-30 minutes of sleep two to three times a night. That cumulative deficit is compounding the cognitive impact of estrogen fluctuation. The transdermal estradiol 0.05mg patch will work to stabilize your estrogen levels, and the oral micronized progesterone 100mg at bedtime will improve your sleep architecture, giving your brain the overnight restoration it's currently missing.",
          plan: [
            { when: 'This week', title: 'Apply your first Vivelle-Dot patch', detail: 'Apply the transdermal estradiol 0.05mg/24hr patch to clean, dry skin on your lower abdomen or upper buttock. Change it every 3-4 days on a consistent schedule. This is the primary driver for stabilizing the hormone fluctuations behind your brain fog and word-finding difficulty.' },
            { when: 'Nightly', title: 'Take oral micronized progesterone 100mg at bedtime', detail: "Take your progesterone at the same time every night before sleep. Its mild sedative effect is intentional — better sleep architecture directly improves working memory and concentration." },
            { when: 'Ongoing', title: 'Track cognitive clarity alongside your Oura readiness score', detail: "Use your Oura app to monitor your readiness score weekly. As your sleep fragmentation improves, you should see readiness trending back toward your baseline. Bring any concentration or word-finding patterns to your 6-week follow-up." },
            { when: '6 weeks', title: 'Follow-up to evaluate cognitive response', detail: "We'll review your Oura sleep and readiness trends, assess whether work-related concentration and word retrieval have improved, and determine whether the estradiol dose needs adjustment." },
          ],
          stat: { value: '64', label: 'your avg Oura readiness score over the past 30 days, and declining' },
          body: null,
          providerNote: null,
        },
        hormonal: {
          lead: "You told me that night sweats and fatigue are making it hard to function at work, and that you don't feel like yourself. Those aren't vague complaints. They're the direct result of falling estrogen and progesterone, and today we're doing something about it.",
          dr_card: "You came in ready to act after months of holding back, and I think that decision was the right one. We have a clear, straightforward plan to bring your hormone levels back into a range where you can feel like yourself again.",
          dr_quote: "Your symptoms aren't just uncomfortable — they're objective. Your Oura data shows your resting heart rate climbed from a baseline of 62 to an average of 68 bpm over the past two weeks, with temperature deviations that map directly onto those 2-3 nightly wake events.",
          dr_body: "The estradiol patch we're starting delivers a steady 0.05mg of estrogen daily through your skin, bypassing the liver and stabilizing the hormonal swings driving your night sweats, sleep fragmentation, and the cognitive symptoms you're noticing at work. Because your uterus is intact, we're pairing it with oral micronized progesterone 100mg taken at bedtime, which protects your uterine lining and has a mild calming effect that should help you stay asleep. I expect to see your resting heart rate trend back toward your baseline as estradiol levels stabilize over the first few weeks.",
          plan: [
            { when: 'Starting today', title: 'Apply your first estradiol patch (Vivelle-Dot 0.05mg)', detail: "Apply the patch to clean, dry skin on your lower abdomen or upper buttock. Rotate the site with each change. Replace it every 3-4 days, twice weekly, on a consistent schedule you choose today." },
            { when: 'Starting tonight', title: 'Take oral micronized progesterone 100mg at bedtime', detail: "Take one capsule with a small snack at bedtime, every night. The timing matters: the mild sedative effect works with your sleep window, so don't take it earlier in the evening." },
            { when: 'This week', title: 'Schedule your DEXA bone density scan', detail: "Given your maternal hip fracture history, this scan is overdue. Call to schedule it now so we have your baseline before your 6-week follow-up." },
            { when: 'In 6 weeks', title: 'Follow-up visit to review your response', detail: "We'll look at how your night sweat frequency, sleep scores, and resting heart rate have changed on your Oura data. Note any breakthrough bleeding or breast tenderness in the meantime." },
          ],
          stat: { value: '18 months', label: 'duration of irregular cycles confirming your perimenopause transition' },
          body: null,
          providerNote: null,
        },
        bone: {
          lead: "You told me you keep forgetting to get the bone scan done. With your mother's hip fracture history and estrogen levels actively shifting, this is the right time to stop putting it off.",
          dr_card: "You mentioned your mother had a hip fracture, and you've never had a baseline DEXA scan. Starting estrogen now actually works in your favor here, and we're getting that scan scheduled.",
          dr_quote: "Your mother's hip fracture is a real signal, and starting transdermal estradiol now means we're acting on your bone health at exactly the right window.",
          dr_body: "Estrogen directly slows the bone-dissolving cells called osteoclasts, so initiating the Vivelle-Dot patch does double duty: it targets your night sweats and sleep fragmentation, and it begins protecting your skeletal density at the same time. Your DEXA scan is ordered so we have a true baseline to measure against at every visit going forward. With strength training already in your routine twice a week, you're ahead of most patients.",
          plan: [
            { when: 'Within the next 2 weeks', title: 'Complete your DEXA scan', detail: "Your DEXA scan order is in. Call to schedule it this week. This gives us a concrete baseline bone density measurement to track against as estrogen therapy gets underway. Given your mother's hip fracture, we're not waiting any longer." },
            { when: 'Daily', title: 'Increase protein toward 80-100g per day', detail: "You're currently averaging about 60g of protein daily. Bone and muscle both depend on adequate protein. Aim to add one additional high-protein serving per day, such as Greek yogurt, eggs, or cottage cheese." },
            { when: 'Ongoing', title: 'Keep your twice-weekly strength training', detail: "Weight-bearing and resistance exercise is one of the most effective non-medication tools for maintaining bone density. Your current 2x-per-week routine is a real asset. Keep it consistent." },
            { when: '6-week follow-up', title: 'Review DEXA results and adjust the plan', detail: "Bring your DEXA results to your follow-up appointment. We'll interpret your T-scores and Z-scores together and determine if additional support like vitamin D or calcium optimization is warranted." },
          ],
          stat: null,
          body: null,
          providerNote: null,
        },
        metabolism: {
          lead: "You told us you've noticed midsection changes over the past year, and you're already doing the right things: strength training twice a week, keeping alcohol minimal. The missing piece is hormonal, and we're addressing it directly.",
          dr_card: "You're already strength training and keeping alcohol low, which matters more than most people realize. Starting estradiol will work alongside those habits to help shift where your body stores fat.",
          dr_quote: "The midsection changes you're seeing are a direct consequence of estrogen decline, and starting the Vivelle-Dot patch will help stabilize the hormonal driver behind them.",
          dr_body: "Your current protein intake is around 60 grams per day, which is below what your body needs to preserve muscle during perimenopause, especially with the fatigue and sleep disruption you've been dealing with. The transdermal estradiol 0.05mg patch will help shift fat distribution patterns over time, but pairing that with a meaningful protein increase will give your twice-weekly strength sessions the support they actually need.",
          plan: [
            { when: 'Starting this week', title: 'Increase daily protein to at least 100g', detail: "You're currently getting about 60g of protein per day. For a woman in perimenopause who strength trains, that's not enough to preserve muscle mass. Add a high-quality protein source to at least two meals each day." },
            { when: 'Ongoing', title: 'Protect your strength training sessions', detail: "Your two weekly sessions are a genuine asset. As the estradiol patch begins working over the next 4-8 weeks, your energy and sleep should improve, which will make those sessions more productive." },
            { when: 'Once therapy is underway', title: 'Track midsection changes, not just weight on a scale', detail: "Estrogen helps regulate where your body stores fat. A monthly waist measurement is a more meaningful marker here than scale weight alone, since muscle gain can offset fat loss on the scale." },
            { when: 'At your 6-week follow-up', title: 'Reassess metabolism markers in context of treatment response', detail: "We'll look at how your energy, body composition, and midsection changes are responding to the combination of estradiol, progesterone, and your updated nutrition approach." },
          ],
          stat: { value: '60g', label: 'your current daily protein intake — roughly half of what your body needs right now' },
          body: null,
          providerNote: null,
        },
        cardiovascular: {
          lead: "Your Oura data shows your resting heart rate has climbed from a baseline of 62 bpm to an average of 68 bpm over the past 14 days, a shift that tracks directly with your vasomotor activity. Starting estradiol therapy addresses this proactively, not just for your night sweats, but for your cardiovascular health as well.",
          dr_card: "Your wearable picked up something important: a sustained resting heart rate elevation that correlates with your vasomotor burden. As we bring your estradiol levels into a therapeutic range, I'll be watching that number alongside your blood pressure and lipids.",
          dr_quote: "Your resting heart rate trend is a signal worth tracking, and starting estradiol therapy now puts you in a strong position to protect your heart health through this transition.",
          dr_body: "During perimenopause, declining estrogen begins to remove a layer of natural cardiovascular protection, and your elevated resting heart rate over the past two weeks reflects that your body is under real physiological stress right now. The transdermal estradiol 0.05mg patch we're initiating has a favorable cardiovascular profile, particularly when started in the perimenopausal window, and bypasses first-pass liver metabolism, which keeps clotting risk low.",
          plan: [
            { when: 'Ongoing, starting now', title: 'Track your resting heart rate through your Oura ring', detail: "Your baseline has shifted from 62 to 68 bpm over the past 14 days. Watch for that number trending back toward your personal baseline as the estradiol patch takes effect over the coming weeks." },
            { when: 'Before your 6-week follow-up', title: 'Schedule a fasting lipid panel', detail: "As estrogen levels fluctuate in perimenopause, lipid profiles can shift. A baseline fasting lipid panel now gives us a clear picture to compare against at future visits." },
            { when: 'Before your 6-week follow-up', title: 'Record a few blood pressure readings at home', detail: "If you have access to a home cuff, take your blood pressure in the morning and evening on three separate days. This gives us context alongside your wearable data." },
            { when: 'At your 6-week follow-up', title: 'Review cardiovascular markers alongside your hormone response', detail: "We'll look at your resting heart rate trend, any blood pressure readings you've logged, and your lipid results together to see how your cardiovascular picture is shifting." },
          ],
          stat: { value: '+6 bpm', label: 'your resting heart rate increase over the past 14 days vs. your personal baseline' },
          body: null,
          providerNote: null,
        },
        gsm: {
          lead: "You noted mild vaginal dryness on your intake form. You haven't raised it as a pressing concern, and that's worth noting as a starting point, not a finish line.",
          dr_card: "You mentioned mild dryness on your intake, and I want to make sure it stays mild. The estradiol patch we're starting will provide systemic support to these tissues, and we'll keep a close eye on how you feel at your six-week follow-up.",
          dr_quote: "Vaginal and urinary tissues are among the most estrogen-sensitive in your body, and right now yours are sending an early signal. Early attention here is how we stay ahead of it.",
          dr_body: "The transdermal estradiol 0.05mg patch you're starting twice weekly delivers systemic estrogen that supports vaginal tissue health, so we're already addressing this alongside your night sweats and sleep fragmentation. Because your dryness is currently mild, I want to reassess at your six-week visit to determine whether the systemic estrogen is enough or whether we should add a low-dose topical vaginal estrogen for more targeted support.",
          plan: [
            { when: 'Starting now', title: 'Begin your estradiol patch as prescribed', detail: "Apply the Vivelle-Dot 0.05mg/24hr patch twice weekly. Systemic estradiol supports vaginal tissue health in addition to addressing your night sweats, so this is already working on your genitourinary symptoms from day one." },
            { when: 'Over the next 6 weeks', title: 'Notice and note any changes in vaginal comfort', detail: "Pay attention to whether dryness, discomfort, or any urinary symptoms stay the same, improve, or worsen. Jot a quick note so you can give me a clear picture at your follow-up." },
            { when: 'At your 6-week follow-up', title: 'Reassess genitourinary symptoms', detail: "We'll evaluate whether the estradiol patch has been sufficient for your mild dryness or whether adding a low-dose topical vaginal estrogen cream or insert makes sense to give these tissues more direct support." },
          ],
          stat: { value: '2/5', label: 'your genitourinary symptom score at your pre-visit check-in' },
          body: null,
          providerNote: null,
        },
        skin: {
          lead: "You haven't raised skin or hair concerns, and that's worth noting. Starting transdermal estradiol 0.05mg/24hr proactively supports collagen production and skin integrity, even before visible changes begin. We'll keep a close eye on this domain as your estrogen levels stabilize.",
          dr_card: "You came in focused on night sweats and fatigue, and that's exactly what we're treating first. The estradiol patch we're starting also works quietly in the background to protect your skin and hair, so we're getting ahead of changes before they become something you notice.",
          dr_quote: "Starting your estradiol patch now gives your skin a head start. Estrogen decline is the main driver of collagen loss, and intervening during perimenopause rather than waiting means we're protecting this tissue before significant loss accumulates.",
          dr_body: "The transdermal estradiol 0.05mg/24hr you're beginning twice weekly delivers consistent estrogen levels transdermally, which supports collagen synthesis and skin hydration alongside its primary role in addressing your vasomotor and sleep symptoms. At your six-week follow-up, I'll check in on any early changes you notice in skin texture or hair, even if they're subtle.",
          plan: [
            { when: 'Starting now', title: 'Apply your estradiol patch twice weekly', detail: "Apply the Vivelle-Dot 0.05mg/24hr patch to clean, dry skin on your lower abdomen or upper buttock, rotating sites with each application. Consistent use maintains steady estradiol levels that support both your vasomotor symptoms and collagen maintenance." },
            { when: 'Daily', title: 'Use SPF 30 or higher every morning', detail: "Sun exposure is the single largest accelerant of collagen breakdown. A broad-spectrum SPF applied daily works alongside your estradiol to slow visible skin changes." },
            { when: 'Ongoing', title: 'Note any skin or hair changes to report at follow-up', detail: "You haven't described skin or hair symptoms, so we're not treating a problem right now. But pay attention to any changes in skin texture, dryness, or hair shedding and mention them at your six-week visit." },
            { when: 'At your 6-week follow-up', title: 'Review skin and hair response alongside your primary symptoms', detail: "At your follow-up I'll ask specifically about this domain alongside your vasomotor and sleep response. If you notice breast tenderness or breakthrough bleeding before then, contact us promptly." },
          ],
          stat: null,
          body: null,
          providerNote: null,
        },
      },
    },
  })
}
