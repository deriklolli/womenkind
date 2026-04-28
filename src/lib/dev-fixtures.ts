/**
 * Development fixtures for the provider dashboard.
 *
 * Used as fallback data when API fetches fail in local dev (RDS is Vercel-only,
 * so live data is unreachable from localhost). NEVER referenced in production —
 * components only fall back to this when `process.env.NODE_ENV === 'development'`.
 */

const now = Date.now()
const minutes = (n: number) => new Date(now + n * 60_000).toISOString()
const hours = (n: number) => minutes(n * 60)
const dayAt = (daysFromNow: number, hour: number, minute = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const devFixtures = {
  todayAppointments: [
    {
      id: 'fx-appt-1',
      starts_at: hours(-1),
      ends_at: hours(-0.5),
      status: 'completed',
      video_room_url: null,
      appointment_types: { name: 'Initial Consultation', duration_minutes: 50, color: '#7C3AED' },
      patients: {
        id: 'fx-p-1',
        profiles: { first_name: 'Sarah', last_name: 'Chen' },
      },
    },
    {
      id: 'fx-appt-2',
      starts_at: hours(0.5),
      ends_at: hours(1),
      status: 'scheduled',
      video_room_url: 'https://womenkind.daily.co/fx-room-1',
      appointment_types: { name: 'Follow-up Visit', duration_minutes: 30, color: '#7C3AED' },
      patients: {
        id: 'fx-p-2',
        profiles: { first_name: 'Maya', last_name: 'Patel' },
      },
    },
    {
      id: 'fx-appt-3',
      starts_at: hours(2),
      ends_at: hours(2.75),
      status: 'scheduled',
      video_room_url: 'https://womenkind.daily.co/fx-room-2',
      appointment_types: { name: 'Initial Consultation', duration_minutes: 45, color: '#7C3AED' },
      patients: {
        id: 'fx-p-3',
        profiles: { first_name: 'Jessica', last_name: 'Brooks' },
      },
    },
    {
      id: 'fx-appt-4',
      starts_at: hours(4),
      ends_at: hours(4.5),
      status: 'scheduled',
      video_room_url: null,
      appointment_types: { name: 'Care Plan Review', duration_minutes: 30, color: '#7C3AED' },
      patients: {
        id: 'fx-p-4',
        profiles: { first_name: 'Aisha', last_name: 'Williams' },
      },
    },
  ],

  scheduleAppointments: [
    // Today
    { id: 'fx-s-1', starts_at: dayAt(0, 9, 0), ends_at: dayAt(0, 9, 50), status: 'confirmed', is_paid: true, amount_cents: 65000, patient_notes: null, provider_notes: null, video_room_url: 'https://womenkind.daily.co/fx-room-1',
      appointment_types: { name: 'Initial Consultation', duration_minutes: 50, price_cents: 65000, color: '#944fed' },
      patients: { id: 'fx-p-1', profiles: { first_name: 'Lauren', last_name: 'Hayes', email: 'lauren@example.com' }, subscriptions: [{ status: 'active', plan_type: 'membership' }] } },
    { id: 'fx-s-2', starts_at: dayAt(0, 10, 30), ends_at: dayAt(0, 11, 0), status: 'confirmed', is_paid: true, amount_cents: 0, patient_notes: null, provider_notes: null, video_room_url: 'https://womenkind.daily.co/fx-room-2',
      appointment_types: { name: 'Follow-up Visit', duration_minutes: 30, price_cents: 0, color: '#5d9ed5' },
      patients: { id: 'fx-p-2', profiles: { first_name: 'Priya', last_name: 'Desai', email: 'priya@example.com' }, subscriptions: [{ status: 'active', plan_type: 'membership' }] } },
    { id: 'fx-s-3', starts_at: dayAt(0, 14, 0), ends_at: dayAt(0, 14, 30), status: 'confirmed', is_paid: false, amount_cents: 35000, patient_notes: null, provider_notes: null, video_room_url: null,
      appointment_types: { name: 'Care Plan Review', duration_minutes: 30, price_cents: 35000, color: '#e8a838' },
      patients: { id: 'fx-p-3', profiles: { first_name: 'Emma', last_name: 'Sullivan', email: 'emma@example.com' }, subscriptions: [] } },
    { id: 'fx-s-4', starts_at: dayAt(0, 16, 0), ends_at: dayAt(0, 16, 50), status: 'confirmed', is_paid: true, amount_cents: 65000, patient_notes: null, provider_notes: null, video_room_url: 'https://womenkind.daily.co/fx-room-3',
      appointment_types: { name: 'Initial Consultation', duration_minutes: 50, price_cents: 65000, color: '#944fed' },
      patients: { id: 'fx-p-4', profiles: { first_name: 'Sarah', last_name: 'Chen', email: 'sarah@example.com' }, subscriptions: [{ status: 'active', plan_type: 'membership' }] } },
    // Tomorrow
    { id: 'fx-s-5', starts_at: dayAt(1, 9, 30), ends_at: dayAt(1, 10, 20), status: 'confirmed', is_paid: true, amount_cents: 65000, patient_notes: null, provider_notes: null, video_room_url: 'https://womenkind.daily.co/fx-room-4',
      appointment_types: { name: 'Initial Consultation', duration_minutes: 50, price_cents: 65000, color: '#944fed' },
      patients: { id: 'fx-p-5', profiles: { first_name: 'Maya', last_name: 'Patel', email: 'maya@example.com' }, subscriptions: [] } },
    { id: 'fx-s-6', starts_at: dayAt(1, 11, 0), ends_at: dayAt(1, 11, 30), status: 'confirmed', is_paid: true, amount_cents: 0, patient_notes: null, provider_notes: null, video_room_url: null,
      appointment_types: { name: 'Follow-up Visit', duration_minutes: 30, price_cents: 0, color: '#5d9ed5' },
      patients: { id: 'fx-p-1', profiles: { first_name: 'Lauren', last_name: 'Hayes', email: 'lauren@example.com' }, subscriptions: [{ status: 'active', plan_type: 'membership' }] } },
    { id: 'fx-s-7', starts_at: dayAt(1, 15, 0), ends_at: dayAt(1, 15, 30), status: 'confirmed', is_paid: false, amount_cents: 35000, patient_notes: null, provider_notes: null, video_room_url: 'https://womenkind.daily.co/fx-room-5',
      appointment_types: { name: 'Care Plan Review', duration_minutes: 30, price_cents: 35000, color: '#e8a838' },
      patients: { id: 'fx-p-2', profiles: { first_name: 'Priya', last_name: 'Desai', email: 'priya@example.com' }, subscriptions: [{ status: 'active', plan_type: 'membership' }] } },
    // In 3 days
    { id: 'fx-s-8', starts_at: dayAt(3, 10, 0), ends_at: dayAt(3, 10, 50), status: 'confirmed', is_paid: true, amount_cents: 65000, patient_notes: null, provider_notes: null, video_room_url: 'https://womenkind.daily.co/fx-room-6',
      appointment_types: { name: 'Initial Consultation', duration_minutes: 50, price_cents: 65000, color: '#944fed' },
      patients: { id: 'fx-p-3', profiles: { first_name: 'Emma', last_name: 'Sullivan', email: 'emma@example.com' }, subscriptions: [] } },
    { id: 'fx-s-9', starts_at: dayAt(3, 13, 30), ends_at: dayAt(3, 14, 0), status: 'confirmed', is_paid: true, amount_cents: 0, patient_notes: null, provider_notes: null, video_room_url: null,
      appointment_types: { name: 'Follow-up Visit', duration_minutes: 30, price_cents: 0, color: '#5d9ed5' },
      patients: { id: 'fx-p-4', profiles: { first_name: 'Sarah', last_name: 'Chen', email: 'sarah@example.com' }, subscriptions: [{ status: 'active', plan_type: 'membership' }] } },
    // In 5 days
    { id: 'fx-s-10', starts_at: dayAt(5, 9, 0), ends_at: dayAt(5, 9, 50), status: 'confirmed', is_paid: true, amount_cents: 65000, patient_notes: null, provider_notes: null, video_room_url: 'https://womenkind.daily.co/fx-room-7',
      appointment_types: { name: 'Initial Consultation', duration_minutes: 50, price_cents: 65000, color: '#944fed' },
      patients: { id: 'fx-p-5', profiles: { first_name: 'Maya', last_name: 'Patel', email: 'maya@example.com' }, subscriptions: [] } },
    { id: 'fx-s-11', starts_at: dayAt(5, 14, 0), ends_at: dayAt(5, 14, 30), status: 'confirmed', is_paid: false, amount_cents: 35000, patient_notes: null, provider_notes: null, video_room_url: null,
      appointment_types: { name: 'Care Plan Review', duration_minutes: 30, price_cents: 35000, color: '#e8a838' },
      patients: { id: 'fx-p-1', profiles: { first_name: 'Lauren', last_name: 'Hayes', email: 'lauren@example.com' }, subscriptions: [{ status: 'active', plan_type: 'membership' }] } },
  ],

  newIntakes: [
    {
      id: 'fx-intake-p1',
      patient_id: 'fx-p-1',
      status: 'submitted',
      answers: {
        full_name: 'Lauren Hayes',
        dob: '1976-03-12',
        priorities: ['Hot flashes', 'Sleep disruption', 'Brain fog'],
      },
      submitted_at: minutes(-20),
      ai_brief: { metadata: { symptom_burden: 'severe', menopausal_stage: 'late perimenopause' } },
    },
    {
      id: 'fx-intake-p2',
      patient_id: 'fx-p-2',
      status: 'submitted',
      answers: {
        full_name: 'Priya Desai',
        dob: '1981-07-04',
        priorities: ['Mood changes', 'Heavy bleeding'],
      },
      submitted_at: hours(-2),
      ai_brief: { metadata: { symptom_burden: 'high', menopausal_stage: 'early perimenopause' } },
    },
    {
      id: 'fx-intake-p3',
      patient_id: 'fx-p-3',
      status: 'submitted',
      answers: {
        full_name: 'Emma Sullivan',
        dob: '1968-11-22',
        priorities: ['Joint pain', 'Vaginal dryness'],
      },
      submitted_at: hours(-6),
      ai_brief: { metadata: { symptom_burden: 'moderate', menopausal_stage: 'postmenopause' } },
    },
  ],

  unreadThreads: [
    {
      id: 'fx-thread-1',
      thread_id: 'fx-thread-1',
      body: 'Quick question about the dosage you mentioned — should I take it with food?',
      created_at: minutes(-15),
      unreadCount: 2,
      senderName: 'Rachel Kim',
    },
    {
      id: 'fx-thread-2',
      thread_id: 'fx-thread-2',
      body: 'Following up on my labs — wanted to share an update on my symptoms this week.',
      created_at: hours(-3),
      unreadCount: 1,
      senderName: 'Megan O\'Brien',
    },
  ],

  pendingRefills: [
    {
      id: 'fx-refill-1',
      created_at: minutes(-45),
      patient_note: 'Running low — about a week left.',
      prescriptions: { medication_name: 'Estradiol', dosage: '0.05 mg/24hr patch', frequency: 'twice weekly' },
      patients: {
        id: 'fx-p-5',
        profiles: { first_name: 'Nina', last_name: 'Martinez' },
      },
    },
    {
      id: 'fx-refill-2',
      created_at: hours(-5),
      patient_note: null,
      prescriptions: { medication_name: 'Progesterone', dosage: '100 mg', frequency: 'nightly' },
      patients: {
        id: 'fx-p-6',
        profiles: { first_name: 'Hannah', last_name: 'Goldberg' },
      },
    },
  ],

  patients: [
    {
      id: 'fx-p-1',
      profile_id: 'fx-prof-1',
      date_of_birth: '1976-03-12',
      phone: '415-555-0142',
      state: 'CA',
      profiles: { first_name: 'Lauren', last_name: 'Hayes', email: 'lauren.hayes@example.com' },
      intakes: [
        {
          id: 'fx-intake-p1',
          status: 'submitted',
          ai_brief: { metadata: { symptom_burden: 'severe', menopausal_stage: 'late perimenopause' } },
          submitted_at: minutes(-20),
        },
      ],
      visits: [
        { id: 'fx-v-1', visit_type: 'initial_consultation', visit_date: hours(-24 * 30) },
        { id: 'fx-v-2', visit_type: 'follow_up', visit_date: hours(-24 * 7) },
      ],
      subscriptions: [{ status: 'active', plan_type: 'membership' }],
    },
    {
      id: 'fx-p-2',
      profile_id: 'fx-prof-2',
      date_of_birth: '1981-07-04',
      phone: '212-555-0188',
      state: 'NY',
      profiles: { first_name: 'Priya', last_name: 'Desai', email: 'priya.desai@example.com' },
      intakes: [
        {
          id: 'fx-intake-p2',
          status: 'reviewed',
          ai_brief: { metadata: { symptom_burden: 'high', menopausal_stage: 'early perimenopause' } },
          submitted_at: hours(-48),
        },
      ],
      visits: [
        { id: 'fx-v-3', visit_type: 'initial_consultation', visit_date: hours(-24 * 14) },
      ],
      subscriptions: [{ status: 'active', plan_type: 'membership' }],
    },
    {
      id: 'fx-p-3',
      profile_id: 'fx-prof-3',
      date_of_birth: '1968-11-22',
      phone: '617-555-0133',
      state: 'MA',
      profiles: { first_name: 'Emma', last_name: 'Sullivan', email: 'emma.sullivan@example.com' },
      intakes: [
        {
          id: 'fx-intake-p3',
          status: 'care_plan_sent',
          ai_brief: { metadata: { symptom_burden: 'moderate', menopausal_stage: 'postmenopause' } },
          submitted_at: hours(-24 * 5),
        },
      ],
      visits: [
        { id: 'fx-v-4', visit_type: 'initial_consultation', visit_date: hours(-24 * 60) },
        { id: 'fx-v-5', visit_type: 'follow_up', visit_date: hours(-24 * 30) },
        { id: 'fx-v-6', visit_type: 'follow_up', visit_date: hours(-24 * 3) },
      ],
      subscriptions: [],
    },
    {
      id: 'fx-p-4',
      profile_id: 'fx-prof-4',
      date_of_birth: '1973-02-09',
      phone: '305-555-0199',
      state: 'FL',
      profiles: { first_name: 'Sarah', last_name: 'Chen', email: 'sarah.chen@example.com' },
      intakes: [
        {
          id: 'fx-intake-p4',
          status: 'care_plan_sent',
          ai_brief: { metadata: { symptom_burden: 'high', menopausal_stage: 'perimenopause' } },
          submitted_at: hours(-24 * 21),
        },
      ],
      visits: [
        { id: 'fx-v-7', visit_type: 'initial_consultation', visit_date: hours(-24 * 45) },
        { id: 'fx-v-8', visit_type: 'follow_up', visit_date: hours(-24 * 1) },
      ],
      subscriptions: [{ status: 'active', plan_type: 'membership' }],
    },
    {
      id: 'fx-p-5',
      profile_id: 'fx-prof-5',
      date_of_birth: '1985-09-30',
      phone: '503-555-0156',
      state: 'OR',
      profiles: { first_name: 'Maya', last_name: 'Patel', email: 'maya.patel@example.com' },
      intakes: [
        {
          id: 'fx-intake-p5',
          status: 'reviewed',
          ai_brief: { metadata: { symptom_burden: 'low', menopausal_stage: 'premenopause' } },
          submitted_at: hours(-24 * 10),
        },
      ],
      visits: [
        { id: 'fx-v-9', visit_type: 'initial_consultation', visit_date: hours(-24 * 12) },
      ],
      subscriptions: [],
    },
  ],

  patientProfile: {
    'fx-p-1': {
      patient: {
        id: 'fx-p-1',
        profile_id: 'fx-prof-1',
        date_of_birth: '1976-03-12',
        phone: '415-555-0142',
        state: 'CA',
        profiles: { first_name: 'Lauren', last_name: 'Hayes', email: 'lauren.hayes@example.com' },
      },
      intakes: [
        {
          id: 'fx-intake-p1',
          status: 'reviewed',
          answers: {
            full_name: 'Lauren Hayes',
            dob: '1976-03-12',
            height: `5'6"`,
            weight: '148 lbs',
            priorities: ['Hot flashes', 'Sleep disruption', 'Brain fog'],
            cycle_status: 'Periods irregular, last 4 months apart',
            lmp: '4 months ago',
            vasomotor: 'Hot flashes 6–8 times daily, night sweats waking me 3–4 times per night',
            sleep: 'Waking multiple times nightly, difficulty falling back asleep, feeling unrefreshed in the morning',
            mood: 'Increased anxiety, short fuse, some low-grade depression',
            cognitive: 'Struggling to find words at work, difficulty concentrating during meetings',
            gsm: 'Some vaginal dryness, discomfort during intercourse',
            energy: 'Fatigue most afternoons, relying on coffee to get through the day',
            meds_detail: 'Daily multivitamin, occasional ibuprofen for headaches',
            supplements: 'Magnesium 400mg at night',
            family_history: 'Mother menopause at 51, osteoporosis. No personal or family history of breast or uterine cancer.',
            smoking: 'Never',
            alcohol: '2–3 glasses of wine per week',
            exercise: '3x per week — walking and light yoga',
            goals: 'Manage hot flashes, sleep through the night, regain mental clarity, protect long-term bone health',
            concerns: 'Worried about HRT risks, wants to understand options before committing',
            bp_known: 'Yes',
            bp_sys: '118',
            bp_dia: '74',
            pcp: 'Dr. Ellen Park, SF General',
            pharmacy: 'Walgreens — 18th & Castro, San Francisco',
          },
          ai_brief: {
            metadata: {
              symptom_burden: 'severe',
              menopausal_stage: 'late perimenopause',
              complexity: 'moderate',
            },
            summary: 'Lauren is a 50-year-old in late perimenopause presenting with severe vasomotor symptoms, significant sleep disruption, and cognitive complaints affecting her daily functioning. Symptoms have progressed over the past 8 months. She is motivated to address quality of life and has expressed interest in understanding HRT options.',
            symptom_summary: {
              overview: 'Lauren presents with a high vasomotor burden driving significant secondary impairment across sleep, cognition, and mood. Her symptoms have escalated over 8 months and are meaningfully affecting her professional and personal functioning.',
              domains: [
                {
                  domain: 'Vasomotor',
                  severity: 'Severe',
                  findings: 'Reports 6–8 hot flashes daily with significant night sweats disrupting sleep 3–4 times per night. Frequency and intensity have increased over the past 8 months.',
                  patient_language: 'I wake up completely soaked and can\'t get back to sleep. During the day I have to step out of meetings.',
                },
                {
                  domain: 'Sleep',
                  severity: 'Severe',
                  findings: 'Fragmented sleep due to night sweats. Reports unrefreshing sleep, difficulty falling back asleep after waking. Magnesium supplementation has provided partial relief.',
                  patient_language: 'I haven\'t had a full night\'s sleep in months. I\'m exhausted but I can\'t stay asleep.',
                },
                {
                  domain: 'Cognitive / Brain Fog',
                  severity: 'Moderate',
                  findings: 'Word-finding difficulties and concentration issues in professional settings. Likely secondary to sleep deprivation and estrogen decline. No red flags for other neurological causes.',
                  patient_language: 'I\'ll be mid-sentence and just lose the word. My team has noticed.',
                },
                {
                  domain: 'Mood & Anxiety',
                  severity: 'Moderate',
                  findings: 'Increased irritability, anxiety, and low-grade depressive symptoms. Patient attributes these to both hormonal changes and sleep deprivation. No suicidal ideation.',
                  patient_language: 'I snap at my husband over nothing. I\'ve never been an anxious person before.',
                },
                {
                  domain: 'Genitourinary (GSM)',
                  severity: 'Mild',
                  findings: 'Early GSM symptoms — vaginal dryness and dyspareunia. Patient reports these are bothersome but secondary to her primary concerns.',
                  patient_language: 'It\'s uncomfortable but not my main issue right now.',
                },
              ],
            },
            risk_flags: {
              urgent: [],
              contraindications: [
                'No personal or family history of hormone-sensitive cancers — HRT is not contraindicated on that basis.',
                'Blood pressure well-controlled (118/74) — transdermal estradiol is preferred over oral to minimize VTE risk.',
                'Family history of osteoporosis (maternal) — bone density baseline recommended; HRT will provide protective benefit.',
              ],
              considerations: [
                'Patient has expressed anxiety about HRT risks — allocate time for shared decision-making discussion.',
                'Sleep deprivation may be amplifying cognitive and mood symptoms; expect improvement once vasomotor symptoms are addressed.',
                'Alcohol intake (2–3 glasses/week) is within range but worth monitoring; discuss breast tissue considerations if initiating estrogen.',
                'Patient is physically active (walking + yoga 3x/week) — positive prognostic factor for overall response to treatment.',
              ],
            },
            treatment_pathway: {
              recommended_approach: 'Initiate transdermal estradiol (patch) combined with micronized progesterone (oral) given intact uterus. Transdermal route preferred given her blood pressure profile and to minimize hepatic first-pass and VTE risk. Start low, titrate based on symptom response at 6–8 weeks.',
              options: [
                {
                  treatment: 'Transdermal Estradiol 0.05mg patch + Micronized Progesterone 100mg nightly',
                  rationale: 'First-line approach for late perimenopause with severe vasomotor symptoms. Transdermal route minimizes VTE risk. Progesterone provides endometrial protection and may also improve sleep architecture.',
                  considerations: 'Patch site rotation required. Efficacy typically felt at 4–8 weeks. If insufficient at 12 weeks, consider uptitrating to 0.075mg.',
                },
                {
                  treatment: 'Low-dose SSRI (e.g., paroxetine 7.5mg) as adjunct or alternative',
                  rationale: 'FDA-approved non-hormonal option for vasomotor symptoms. May also benefit mood and anxiety symptoms. Appropriate if patient declines HRT after counseling.',
                  considerations: 'Less effective than estrogen for vasomotor symptom control. Does not address GSM, sleep architecture, or bone density. May take 4–6 weeks to show effect.',
                },
                {
                  treatment: 'Vaginal Estradiol cream (local) for GSM',
                  rationale: 'Low systemic absorption — appropriate as an adjunct regardless of decision on systemic HRT. Addresses dyspareunia and dryness directly.',
                  considerations: 'Can be initiated independently of systemic therapy. Reassess GSM symptoms at follow-up.',
                },
              ],
              patient_preferences: 'Lauren wants to understand all options before committing to HRT. She is open to it but concerned about cancer risk. She values her quality of life and has specifically mentioned wanting to protect her bone health long-term. Shared decision-making visit recommended before prescribing.',
            },
            suggested_questions: [
              {
                question: 'Can you describe what a typical hot flash feels like for you — how long does it last, and where in your body do you feel it most?',
                context: 'Helps calibrate severity and distinguish vasomotor from other heat/flush causes. Lauren reports 6–8 daily but hasn\'t described duration or pattern.',
              },
              {
                question: 'When you wake up at night, are you waking because of sweating, or are you having trouble staying asleep even without sweats?',
                context: 'Distinguishes primary insomnia from vasomotor-driven sleep disruption — this matters for treatment sequencing.',
              },
              {
                question: 'Have you noticed any changes in your periods beyond irregularity — heavier flow, spotting between cycles, or any postmenopausal bleeding?',
                context: 'Irregular periods expected in late perimenopause, but abnormal bleeding warrants endometrial evaluation before initiating estrogen.',
              },
              {
                question: 'When you say you\'re worried about HRT risks, what specific risks are on your mind? Have you read anything in particular?',
                context: 'Opens the shared decision-making conversation. Many patients cite the 2002 WHI study, which had design limitations not applicable to modern transdermal therapy.',
              },
              {
                question: 'Has your mother or anyone else in your family been diagnosed with osteoporosis — and do you know if she was ever treated for it?',
                context: 'Family history is flagged. Understanding the severity and treatment of maternal osteoporosis helps stratify Lauren\'s bone risk and reinforces the case for HRT.',
              },
              {
                question: 'How are your symptoms affecting your relationship with your husband? Is that something you\'d like to address as part of your care?',
                context: 'Lauren mentions snapping at her husband. GSM and libido changes in perimenopause are often underreported. Opening this conversation normalizes it.',
              },
            ],
            md_command: {
              phenotype: 'VMS-dominant + SE',
              wmi_interpretation: 'Lauren\'s WMI of 60/100 places her in the Active Rebuild Zone — meaningful systemic strain driven by severe vasomotor and sympathetic excess. This is the highest-yield zone for HRT: structured intervention typically yields 15–25 point WMI improvement within 8–12 weeks as VMS burden lifts and secondary domains (sleep, mood, cognition) follow.',
              safety_decision: {
                hrt_eligible: true,
                contraindications: [],
                cautions: [
                  'Blood pressure is well-controlled (118/74) — continue transdermal route to minimize hepatic first-pass and VTE risk vs. oral estrogen.',
                  'Alcohol 2–3 glasses/week — mild background breast tissue risk; discuss at shared decision-making visit.',
                  'Family history of osteoporosis (maternal) — baseline DEXA recommended; HRT provides protective benefit.',
                ],
                flags: [],
              },
              treatment_options: [
                {
                  rank: 1,
                  therapy: 'Estradiol patch 0.05mg/day (twice weekly) + Micronized Progesterone 100mg oral nightly',
                  rationale: 'First-line for late perimenopause with severe VMS. Transdermal estradiol avoids hepatic first-pass, minimizes VTE and triglyceride effects. Progesterone 100mg provides endometrial protection and improves sleep architecture — particularly valuable given Lauren\'s sleep fragmentation.',
                  monitoring: 'Symptom check at 6–8 weeks. If partial response, uptitrate to 0.075mg patch. Breast exam annually. Consider DEXA baseline.',
                },
                {
                  rank: 2,
                  therapy: 'Vaginal Estradiol cream 0.5g (2–3× per week) as GSM adjunct',
                  rationale: 'Minimal systemic absorption. Addresses dyspareunia and vaginal dryness independently of systemic HRT decision. Can initiate at same visit.',
                  monitoring: 'Reassess GSM symptoms at 3-month follow-up.',
                },
                {
                  rank: 3,
                  therapy: 'Fezolinetant (Veozah) 45mg/day — if patient declines systemic HRT after counseling',
                  rationale: 'NK3 receptor antagonist — non-hormonal, FDA-approved for VMS. Effective for vasomotor burden without hormonal exposure. Does not address GSM, bone, or SE components.',
                  monitoring: 'LFTs at baseline and 3 months (hepatotoxicity signal in trials). Reassess efficacy at 12 weeks.',
                },
              ],
              labs_to_order: [
                'TSH — rule out thyroid contribution to fatigue, mood, and cognitive symptoms',
                'FSH + Estradiol — confirm late perimenopause staging (FSH >25 IU/L expected)',
                'CMP — baseline metabolic panel before initiating systemic therapy',
                'Lipid panel — cardiovascular baseline; estrogen has favorable effect on LDL/HDL',
                'DEXA — bone density baseline given maternal osteoporosis history',
              ],
              follow_up: '6–8 weeks after initiation: assess VMS frequency and severity, sleep quality, mood. Then 3-month comprehensive review: titrate estradiol dose if needed, confirm endometrial safety, address any new concerns.',
            },
            soap_note: {
              subjective: 'Lauren Hayes, 50F, presents with an 8-month history of progressive perimenopausal symptoms significantly impacting quality of life. Chief complaint: "I wake up completely soaked and can\'t get back to sleep. During the day I have to step out of meetings." Reports 6–8 hot flashes daily with night sweats disrupting sleep 3–4 times nightly. Secondary to sleep deprivation: word-finding difficulties ("I\'ll be mid-sentence and just lose the word — my team has noticed"), afternoon fatigue requiring caffeine, and new-onset irritability and low-grade anxiety ("I snap at my husband over nothing — I\'ve never been an anxious person before"). Mild GSM symptoms (vaginal dryness, dyspareunia) present but not primary concern. Patient is motivated to address symptoms and protect long-term bone health. Has reservations about HRT risks — wants thorough shared decision-making before committing.',
              objective: 'BMI: calculated from 5\'6" / 148 lbs ≈ 23.9 (Normal). BP: 118/74 (well-controlled). Reproductive status: Late perimenopause — irregular cycles, LMP 4 months ago. Current medications: Daily multivitamin, magnesium 400mg nightly, occasional ibuprofen. No prescription medications. No allergies reported. WMI: 60/100 (Active Rebuild Zone). Domain scores: VMS 17/20, Sleep 7/13, MAMS 5/12, COG 4/8, GSM 3/12, MSK 0/4, CARDIO 0/4. Phenotype signal: VMS-dominant + Sympathetic Excess.',
              assessment: 'Late perimenopause — phenotype VMS-dominant + SE. WMI 60/100 indicating meaningful systemic strain with high treatment-response potential. Severe vasomotor burden (VMS 17/20) driving secondary impairment across sleep, cognition, and mood. No hormonal contraindications identified. Safety profile favorable for transdermal HRT. Key clinical decision point: patient ambivalence about HRT requires shared decision-making — most of her concern likely relates to the 2002 WHI data, which is not applicable to modern transdermal therapy in a healthy perimenopausal patient. Family history of osteoporosis (maternal) adds motivation for bone-protective intervention.',
              plan: '1. Initiate transdermal Estradiol 0.05mg patch (twice weekly) + Micronized Progesterone 100mg oral nightly (uterus intact). Counsel on expected timeline: symptom improvement typically begins at 4–6 weeks, full effect at 8–12 weeks.\n2. Add vaginal Estradiol cream 0.5g 2–3× per week for GSM — can initiate independently.\n3. Order labs: TSH, FSH, Estradiol, CMP, lipid panel, DEXA.\n4. Patient education: review WHI study limitations vs. current evidence; discuss transdermal vs. oral route rationale; address breast cancer risk data in context of absolute vs. relative risk.\n5. Follow-up 6–8 weeks: assess VMS frequency, sleep quality, mood. Titrate to 0.075mg if partial response.',
            },
          },
          provider_notes: null,
          submitted_at: minutes(-20),
          reviewed_at: null,
          // Pre-computed WMI scores for Lauren's profile (severe VMS + sleep, moderate mood/cog, mild GSM)
          // VMS=17, SLEEP=7, MAMS=5, COG=4, GSM=3, HSDD=1, CARDIO=0, MSK=0
          wmi_scores: {
            vms: 17, sleep: 7, mams: 5, cog: 4, gsm: 3, hsdd: 1, cardio: 0, msk: 0, gaba: 8, se: 15.5,
            wmi: 60,
            phenotype: 'VMS + SE',
            wmi_band: '55-69',
            wmi_label: 'Active Rebuild Zone',
            wmi_message: 'Your body is under meaningful strain, but this is exactly the zone where structured treatment can create visible progress.',
            safety_flags: [],
            bleeding_band: 'NONE',
            confidence: 'moderate',
            missing_fields: ['hf_freq', 'sleep_falling', 'sleep_waking', 'low_mood', 'anxiety', 'brain_fog', 'fatigue'],
          },
        },
      ],
      visits: [
        {
          id: 'fx-v-1',
          intake_id: null,
          visit_type: 'initial_consultation',
          visit_date: hours(-24 * 30),
          symptom_scores: { vasomotor: 8, sleep: 7, energy: 6, mood: 5, gsm: 3, overall: 65 },
          provider_notes: 'Initial consultation. Discussed treatment options.',
          treatment_updates: null,
        },
        {
          id: 'fx-v-2',
          intake_id: null,
          visit_type: 'follow_up',
          visit_date: hours(-24 * 7),
          symptom_scores: { vasomotor: 6, sleep: 5, energy: 7, mood: 6, gsm: 3, overall: 72 },
          provider_notes: 'Patient reporting moderate improvement on current regimen.',
          treatment_updates: null,
        },
      ],
      subscriptions: [
        {
          id: 'fx-sub-1',
          status: 'active',
          plan_type: 'membership',
          current_period_end: hours(24 * 60),
        },
      ],
      prescriptions: [
        {
          id: 'fx-rx-1',
          medication_name: 'Estradiol',
          dosage: '0.05 mg/24hr patch',
          frequency: 'twice weekly',
          quantity_dispensed: 8,
          refills: 2,
          status: 'active',
          prescribed_at: hours(-24 * 28),
          created_at: hours(-24 * 28),
        },
        {
          id: 'fx-rx-2',
          medication_name: 'Progesterone',
          dosage: '100 mg',
          frequency: 'nightly',
          quantity_dispensed: 30,
          refills: 2,
          status: 'active',
          prescribed_at: hours(-24 * 28),
          created_at: hours(-24 * 28),
        },
      ],
      labOrders: [],
      providerNotes: [],
      encounterNotesCount: 1,
      latestEncounterNote: null,
    },
  } as Record<string, any>,

  recentCancellations: [
    {
      id: 'fx-cancel-1',
      canceled_at: hours(-4),
      appointment_types: { name: 'Follow-up Visit' },
      patients: {
        profiles: { first_name: 'Olivia', last_name: 'Reyes' },
      },
    },
  ],
}
