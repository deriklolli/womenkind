export type DashboardState = 'S2' | 'S3' | 'S4' | 'S5' | 'S6'

export type HeroAction =
  | { kind: 'book_consult' }
  | { kind: 'prep_visit'; appointment: AppointmentLike; minutesUntilStart: number }
  | { kind: 'join_video'; appointment: AppointmentLike }
  | { kind: 'awaiting_plan' }
  | { kind: 'log_checkin' }
  | { kind: 'refill_due'; prescription: PrescriptionLike }
  | { kind: 'followup_overdue'; recommendedAt: Date }
  | { kind: 'unread_message'; message: MessageLike }
  | { kind: 'new_labs'; lab: LabLike }
  | { kind: 'followup_recommended'; recommendedAt: Date }
  | { kind: 'care_plan_updated' }
  | { kind: 'all_caught_up' }
  | { kind: 'reengagement' }

export interface AppointmentLike {
  starts_at: Date | string
  ends_at: Date | string
  encounterNoteFinalized?: boolean
  daily_room_url?: string | null
}
export interface PrescriptionLike {
  runs_out_at: Date | string | null
  medication_name: string
}
export interface MessageLike {
  read_at: Date | string | null
  sender: 'provider' | 'patient'
}
export interface LabLike {
  posted_at: Date | string
}

export interface DashboardSnapshot {
  intake: { status: string; ai_brief: unknown | null; wmi_scores?: { wmi?: number } | null } | null
  appointments: AppointmentLike[]
  prescriptions: PrescriptionLike[]
  messages: MessageLike[]
  labs: LabLike[]
  blueprintVersionUpdatedAt: Date | string | null
  lastBlueprintViewedAt: Date | string | null
  lastLabsViewedAt: Date | string | null
  lastCheckinAt: Date | string | null
  recommendedFollowUpAt: Date | string | null
  now: Date
}

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null
  return v instanceof Date ? v : new Date(v)
}

const startOfWeek = (d: Date): Date => {
  const day = d.getUTCDay()
  const diff = (day + 6) % 7
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - diff)
  return start
}

export function detectDashboardState(s: DashboardSnapshot): { state: DashboardState; heroAction: HeroAction } {
  const now = s.now
  const upcoming = s.appointments
    .map(a => ({ ...a, _start: toDate(a.starts_at)!, _end: toDate(a.ends_at)! }))
    .filter(a => a._start.getTime() > now.getTime())
    .sort((a, b) => a._start.getTime() - b._start.getTime())[0]

  const recentlyEnded = s.appointments
    .map(a => ({ ...a, _end: toDate(a.ends_at)! }))
    .filter(a => a._end.getTime() <= now.getTime() && (now.getTime() - a._end.getTime()) <= 48 * 60 * 60 * 1000)
    .sort((a, b) => b._end.getTime() - a._end.getTime())[0]

  const lastCheckin = toDate(s.lastCheckinAt)
  const daysSinceCheckin = lastCheckin ? (now.getTime() - lastCheckin.getTime()) / (24 * 60 * 60 * 1000) : Infinity
  const isLapsed = daysSinceCheckin >= 21

  const hasFinalizedVisit = s.appointments.some(a => a.encounterNoteFinalized && toDate(a.ends_at)!.getTime() <= now.getTime())
  const briefReady = !!s.intake?.ai_brief

  // State precedence: S3 > S6 > S4 > S2 > S5
  if (upcoming) {
    const minutesUntilStart = (upcoming._start.getTime() - now.getTime()) / 60000
    if (minutesUntilStart <= 15 && upcoming.daily_room_url) {
      return { state: 'S3', heroAction: { kind: 'join_video', appointment: upcoming } }
    }
    return { state: 'S3', heroAction: { kind: 'prep_visit', appointment: upcoming, minutesUntilStart } }
  }

  if (isLapsed && hasFinalizedVisit) {
    return { state: 'S6', heroAction: { kind: 'reengagement' } }
  }

  if (recentlyEnded && !recentlyEnded.encounterNoteFinalized) {
    return { state: 'S4', heroAction: { kind: 'awaiting_plan' } }
  }

  if (briefReady && !hasFinalizedVisit) {
    return { state: 'S2', heroAction: { kind: 'book_consult' } }
  }

  return { state: 'S5', heroAction: pickS5Hero(s, now) }
}

function pickS5Hero(s: DashboardSnapshot, now: Date): HeroAction {
  const refill = s.prescriptions
    .map(p => ({ ...p, _runsOut: toDate(p.runs_out_at) }))
    .filter(p => p._runsOut && (p._runsOut!.getTime() - now.getTime()) <= 3 * 24 * 60 * 60 * 1000 && (p._runsOut!.getTime() - now.getTime()) > 0)
    .sort((a, b) => a._runsOut!.getTime() - b._runsOut!.getTime())[0]
  if (refill) return { kind: 'refill_due', prescription: refill }

  const recAt = toDate(s.recommendedFollowUpAt)
  if (recAt && recAt.getTime() < now.getTime()) {
    return { kind: 'followup_overdue', recommendedAt: recAt }
  }

  const unread = s.messages.find(m => !m.read_at && m.sender === 'provider')
  if (unread) return { kind: 'unread_message', message: unread }

  const lastLabsView = toDate(s.lastLabsViewedAt)
  const newLab = s.labs
    .map(l => ({ ...l, _posted: toDate(l.posted_at)! }))
    .filter(l => !lastLabsView || l._posted.getTime() > lastLabsView.getTime())
    .sort((a, b) => b._posted.getTime() - a._posted.getTime())[0]
  if (newLab) return { kind: 'new_labs', lab: newLab }

  if (recAt) return { kind: 'followup_recommended', recommendedAt: recAt }

  const planUpdated = toDate(s.blueprintVersionUpdatedAt)
  const lastPlanView = toDate(s.lastBlueprintViewedAt)
  if (planUpdated && (!lastPlanView || planUpdated.getTime() > lastPlanView.getTime())) {
    return { kind: 'care_plan_updated' }
  }

  const lastCheckin = toDate(s.lastCheckinAt)
  const weekStart = startOfWeek(now)
  if (!lastCheckin || lastCheckin.getTime() < weekStart.getTime()) {
    return { kind: 'log_checkin' }
  }

  return { kind: 'all_caught_up' }
}
