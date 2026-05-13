'use client'

import DashboardHero from '@/components/patient/DashboardHero'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_APT = {
  id: 'apt-preview-1',
  starts_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
  daily_room_url: 'https://womenkind.daily.co/preview-room',
}

const HERO_VARIANTS: { label: string; note?: string; props: React.ComponentProps<typeof DashboardHero> }[] = [
  {
    label: 'Book initial consult',
    note: 'Shows after intake brief is ready, before any appointment is booked.',
    props: {
      action: { kind: 'book_consult' },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Pre-visit check-in',
    note: 'Shows when upcoming appointment exists and patient hasn\'t checked in yet.',
    props: {
      action: { kind: 'prep_visit', appointment: MOCK_APT, minutesUntilStart: 5 * 24 * 60 },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Pre-visit check-in — tomorrow',
    props: {
      action: { kind: 'prep_visit', appointment: MOCK_APT, minutesUntilStart: 24 * 60 },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Pre-visit check-in — today',
    props: {
      action: { kind: 'prep_visit', appointment: MOCK_APT, minutesUntilStart: 2 * 60 },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Join video call',
    note: 'Shows ≤15 min before appointment start when video room URL is present.',
    props: {
      action: { kind: 'join_video', appointment: MOCK_APT },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Awaiting care plan',
    note: 'Shows up to 48 h after appointment ends while encounter note is not yet finalized.',
    props: {
      action: { kind: 'awaiting_plan' },
      patientFirstName: 'Sarah',
      onDismiss: () => {},
    },
  },
  {
    label: 'Log this week\'s check-in',
    note: 'Shows when no daily check-in has been submitted this calendar week.',
    props: {
      action: { kind: 'log_checkin' },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Re-engagement (lapsed 21+ days)',
    note: 'Shows after a finalized visit when patient hasn\'t checked in for 3+ weeks.',
    props: {
      action: { kind: 'reengagement' },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Prescription refill due',
    note: 'Shows when a prescription runs out within 3 days.',
    props: {
      action: {
        kind: 'refill_due',
        prescription: { medication_name: 'Estradiol 0.025mg patch', runs_out_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
      },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Follow-up overdue',
    note: 'Shows when Dr. Urban\'s recommended follow-up date has passed.',
    props: {
      action: { kind: 'followup_overdue', recommendedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Follow-up recommended (upcoming)',
    note: 'Shows when a follow-up is recommended but not yet overdue.',
    props: {
      action: { kind: 'followup_recommended', recommendedAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Unread message from Dr. Urban',
    props: {
      action: { kind: 'unread_message', message: { read_at: null, sender: 'provider' } },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'New lab results',
    props: {
      action: { kind: 'new_labs', lab: { posted_at: new Date().toISOString() } },
      patientFirstName: 'Sarah',
    },
  },
  {
    label: 'Care plan updated',
    note: 'Shows when blueprint was updated more recently than patient last viewed it.',
    props: {
      action: { kind: 'care_plan_updated' },
      patientFirstName: 'Sarah',
    },
  },
]

// ─── Alert card variants (DashboardAlerts) ────────────────────────────────────

function AlertNew_Blueprint() {
  return (
    <div className="relative rounded-card overflow-hidden" style={{ minHeight: '160px' }}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/care-presentation-bg.png)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to right, rgba(26,9,48,0.88) 0%, rgba(26,9,48,0.65) 50%, rgba(26,9,48,0.25) 100%)' }}
      />
      <div className="relative z-10 flex flex-col justify-end h-full p-6 md:p-8" style={{ minHeight: '160px' }}>
        <p className="font-sans font-semibold text-xl md:text-2xl text-white leading-tight mb-2">
          Your Health Blueprint is ready
        </p>
        <p className="text-sm font-sans text-white/60 leading-relaxed mb-4 max-w-md">
          Dr. Urban has prepared your personalized care plan. Take a look at what's next for your health journey.
        </p>
        <div>
          <span className="inline-flex items-center gap-2 text-sm font-sans font-medium text-white bg-violet rounded-full px-5 py-2 shadow-sm">
            View Blueprint
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}

function AlertAppointmentCanceled() {
  return (
    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 border border-rose-200 p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-50 text-rose-500">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans font-medium text-aubergine">Your appointment has been canceled</p>
        <p className="text-xs font-sans text-aubergine/60 mt-1 line-clamp-2">Your Initial Consultation on May 15 at 10:00 AM was canceled. Please reschedule at your convenience.</p>
        <span className="inline-block mt-2 text-xs font-sans font-medium text-violet">Book a new appointment →</span>
      </div>
    </div>
  )
}

function AlertLabResults() {
  return (
    <div className="bg-white rounded-card shadow-sm shadow-aubergine/5 border border-violet/15 p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-500">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans font-medium text-aubergine">Your lab results are ready</p>
        <p className="text-xs font-sans text-aubergine/50 mt-1 line-clamp-1">Estradiol, FSH, LH panel — posted May 12</p>
      </div>
      <div className="flex-shrink-0 mt-1">
        <svg className="w-4 h-4 text-violet/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BannerPreviewPage() {
  return (
    <div className="min-h-screen bg-[#f5f0eb] py-12 px-6">
      <div className="max-w-3xl mx-auto">

        <div className="mb-10">
          <h1 className="font-serif text-4xl text-aubergine mb-2">Banner Preview</h1>
          <p className="font-sans text-sm text-aubergine/50">All dashboard hero states and notification cards. Read-only — buttons are inert.</p>
        </div>

        {/* ── Hero banners ── */}
        <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-aubergine/40 mb-5">
          Hero Banner — one shows at a time
        </h2>

        <div className="space-y-8 mb-16">
          {HERO_VARIANTS.map(({ label, note, props }) => (
            <div key={label}>
              <div className="mb-2 flex items-baseline gap-3">
                <span className="font-sans text-sm font-semibold text-aubergine">{label}</span>
                {note && <span className="font-sans text-xs text-aubergine/40">{note}</span>}
              </div>
              <DashboardHero {...props} />
            </div>
          ))}
        </div>

        {/* ── Notification cards ── */}
        <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-aubergine/40 mb-5">
          Notification Cards — stack above the hero
        </h2>

        <div className="space-y-8">
          <div>
            <div className="mb-2">
              <span className="font-sans text-sm font-semibold text-aubergine">New blueprint / care plan ready</span>
              <span className="ml-3 font-sans text-xs text-aubergine/40">Fires when Dr. Urban sends the care plan. Dismisses when clicked.</span>
            </div>
            <AlertNew_Blueprint />
          </div>

          <div>
            <div className="mb-2">
              <span className="font-sans text-sm font-semibold text-aubergine">Appointment canceled</span>
              <span className="ml-3 font-sans text-xs text-aubergine/40">Fires when an appointment is canceled. Dismisses when clicked.</span>
            </div>
            <AlertAppointmentCanceled />
          </div>

          <div>
            <div className="mb-2">
              <span className="font-sans text-sm font-semibold text-aubergine">Lab results ready</span>
              <span className="ml-3 font-sans text-xs text-aubergine/40">Fires when lab results are posted. Dismisses when clicked.</span>
            </div>
            <AlertLabResults />
          </div>
        </div>

      </div>
    </div>
  )
}
