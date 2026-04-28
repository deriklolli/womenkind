'use client'

import type { HeroAction } from '@/lib/patient-dashboard-state'

interface Props {
  action: HeroAction
  onPrimaryClick?: () => void
  patientFirstName?: string
}

export default function DashboardHero({ action, onPrimaryClick, patientFirstName }: Props) {
  switch (action.kind) {
    case 'book_consult':
      return (
        <HeroDark
          eyebrow="Next step"
          headline="Book your initial consultation"
          body={`${patientFirstName ? patientFirstName + ', y' : 'Y'}our intake is in. Schedule your visit with Dr. Urban to start treatment.`}
          cta="Schedule appointment"
          onClick={onPrimaryClick}
        />
      )
    case 'prep_visit': {
      const days = Math.max(0, Math.round(action.minutesUntilStart / (60 * 24)))
      const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
      return (
        <HeroLight
          eyebrow="Upcoming visit"
          headline={`Your visit is ${when}`}
          body="Take 60 seconds to log how you're feeling so Dr. Urban can prepare."
          cta="Complete pre-visit check-in"
          onClick={onPrimaryClick}
        />
      )
    }
    case 'join_video':
      return (
        <HeroLight
          eyebrow="Your visit is starting"
          headline="Join your video visit"
          body="Dr. Urban is ready when you are."
          cta="Join video call"
          onClick={onPrimaryClick}
        />
      )
    case 'awaiting_plan':
      return (
        <HeroCream
          eyebrow="After your visit"
          headline="Dr. Urban is finalizing your care plan"
          body="You'll be notified when it's ready — typically within 48 hours. No action needed right now."
        />
      )
    case 'log_checkin':
    case 'reengagement':
      return (
        <HeroDark
          eyebrow={action.kind === 'reengagement' ? 'Welcome back' : 'This week'}
          headline={action.kind === 'reengagement' ? "It's been a few weeks — how are you feeling?" : "Log this week's symptoms"}
          body="A quick 60-second check-in helps Dr. Urban tailor your treatment."
          cta="Start check-in"
          onClick={onPrimaryClick}
        />
      )
    case 'refill_due':
      return (
        <HeroBordered
          accent="amber"
          eyebrow="Prescription"
          headline={`${action.prescription.medication_name} runs out soon`}
          body="Request a refill so you don't have a gap in treatment."
          cta="Request refill"
          onClick={onPrimaryClick}
        />
      )
    case 'followup_overdue':
      return (
        <HeroBordered
          accent="red"
          eyebrow="Follow-up overdue"
          headline="Time to schedule your follow-up visit"
          body="Dr. Urban recommended a check-in by now. Let's get it on the calendar."
          cta="Schedule follow-up"
          onClick={onPrimaryClick}
        />
      )
    case 'unread_message':
      return (
        <HeroBordered
          accent="violet"
          eyebrow="From Dr. Urban"
          headline="You have a new message"
          body="Open your inbox to read and reply."
          cta="Read message"
          onClick={onPrimaryClick}
        />
      )
    case 'new_labs':
      return (
        <HeroBordered
          accent="emerald"
          eyebrow="Lab results"
          headline="New lab results are ready"
          body="Take a look at your latest results."
          cta="View labs"
          onClick={onPrimaryClick}
        />
      )
    case 'followup_recommended':
      return (
        <HeroBordered
          accent="aubergine"
          eyebrow="Follow-up"
          headline="Dr. Urban recommends a follow-up visit"
          body="When you're ready, schedule your next visit."
          cta="Schedule follow-up"
          onClick={onPrimaryClick}
        />
      )
    case 'care_plan_updated':
      return (
        <HeroBordered
          accent="violet-soft"
          eyebrow="Care plan"
          headline="Your care plan was updated"
          body="See what's new in your health blueprint."
          cta="View blueprint"
          onClick={onPrimaryClick}
        />
      )
    case 'all_caught_up':
      return (
        <HeroCream
          eyebrow="You're on track"
          headline="All caught up"
          body="Nothing to action right now. Keep up your weekly check-ins to keep your data flowing."
        />
      )
  }
}

function HeroDark(props: { eyebrow: string; headline: string; body: string; cta: string; onClick?: () => void }) {
  return (
    <section className="bg-aubergine text-white rounded-card p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-white/60 mb-2">{props.eyebrow}</div>
        <h2 className="font-serif text-3xl text-white mb-2">{props.headline}</h2>
        <p className="font-sans text-sm text-white/70 max-w-lg">{props.body}</p>
      </div>
      {props.cta && (
        <button onClick={props.onClick} className="bg-violet hover:bg-violet-dark text-white rounded-pill px-7 py-3.5 font-sans text-sm font-medium transition-colors whitespace-nowrap">
          {props.cta}
        </button>
      )}
    </section>
  )
}

function HeroLight(props: { eyebrow: string; headline: string; body: string; cta: string; onClick?: () => void }) {
  return (
    <section className="bg-white rounded-card shadow-sm border border-aubergine/5 p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-violet mb-2">{props.eyebrow}</div>
        <h2 className="font-serif text-3xl text-aubergine mb-2">{props.headline}</h2>
        <p className="font-sans text-sm text-aubergine/60 max-w-lg">{props.body}</p>
      </div>
      <button onClick={props.onClick} className="bg-violet hover:bg-violet-dark text-white rounded-pill px-7 py-3.5 font-sans text-sm font-medium transition-colors whitespace-nowrap">
        {props.cta}
      </button>
    </section>
  )
}

function HeroCream(props: { eyebrow: string; headline: string; body: string }) {
  return (
    <section className="bg-cream rounded-card p-7">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-aubergine/50 mb-2">{props.eyebrow}</div>
      <h2 className="font-serif text-2xl text-aubergine mb-2">{props.headline}</h2>
      <p className="font-sans text-sm text-aubergine/60 max-w-2xl">{props.body}</p>
    </section>
  )
}

function HeroBordered(props: { accent: 'amber' | 'red' | 'violet' | 'emerald' | 'aubergine' | 'violet-soft'; eyebrow: string; headline: string; body: string; cta: string; onClick?: () => void }) {
  const borderClass = {
    amber: 'border-l-amber-600',
    red: 'border-l-red-600',
    violet: 'border-l-violet',
    emerald: 'border-l-emerald-600',
    aubergine: 'border-l-aubergine/30',
    'violet-soft': 'border-l-violet/40',
  }[props.accent]
  return (
    <section className={`bg-white rounded-card shadow-sm border border-aubergine/5 border-l-4 ${borderClass} p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5`}>
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-aubergine/50 mb-2">{props.eyebrow}</div>
        <h2 className="font-serif text-2xl text-aubergine mb-2">{props.headline}</h2>
        <p className="font-sans text-sm text-aubergine/60 max-w-lg">{props.body}</p>
      </div>
      <button onClick={props.onClick} className="bg-aubergine hover:bg-aubergine-light text-white rounded-pill px-7 py-3.5 font-sans text-sm font-medium transition-colors whitespace-nowrap">
        {props.cta}
      </button>
    </section>
  )
}
