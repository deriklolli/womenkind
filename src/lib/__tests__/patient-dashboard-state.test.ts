import { detectDashboardState } from '../patient-dashboard-state'

const baseSnapshot = {
  intake: { status: 'submitted', ai_brief: { summary: 'x' }, wmi_scores: { wmi: 70 } },
  appointments: [],
  prescriptions: [],
  messages: [],
  labs: [],
  blueprintVersionUpdatedAt: null,
  lastBlueprintViewedAt: null,
  lastLabsViewedAt: null,
  lastCheckinAt: null,
  recommendedFollowUpAt: null,
  now: new Date('2026-04-27T12:00:00Z'),
}

describe('detectDashboardState', () => {
  it('returns S2 when brief is ready and no appointments exist', () => {
    expect(detectDashboardState(baseSnapshot).state).toBe('S2')
  })

  it('returns S3 when an upcoming appointment exists', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-04-30T12:00:00Z'), ends_at: new Date('2026-04-30T13:00:00Z') }],
    })
    expect(result.state).toBe('S3')
  })

  it('returns S4 when most recent visit ended within 48h and no encounter notes finalized', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-04-26T12:00:00Z'), ends_at: new Date('2026-04-26T13:00:00Z'), encounterNoteFinalized: false }],
    })
    expect(result.state).toBe('S4')
  })

  it('returns S5 when treatment is active and nothing is overdue', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-04-20T12:00:00Z'), ends_at: new Date('2026-04-20T13:00:00Z'), encounterNoteFinalized: true }],
      lastCheckinAt: new Date('2026-04-25T12:00:00Z'),
    })
    expect(result.state).toBe('S5')
  })

  it('returns S6 when no check-in in >= 21 days and no upcoming visit', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-03-01T12:00:00Z'), ends_at: new Date('2026-03-01T13:00:00Z'), encounterNoteFinalized: true }],
      lastCheckinAt: new Date('2026-04-01T12:00:00Z'),
    })
    expect(result.state).toBe('S6')
  })

  it('S3 beats S6: upcoming visit overrides lapsed', () => {
    const result = detectDashboardState({
      ...baseSnapshot,
      appointments: [{ starts_at: new Date('2026-04-30T12:00:00Z'), ends_at: new Date('2026-04-30T13:00:00Z') }],
      lastCheckinAt: new Date('2026-04-01T12:00:00Z'),
    })
    expect(result.state).toBe('S3')
  })
})

describe('detectDashboardState rotation (S5)', () => {
  const s5Base = {
    ...baseSnapshot,
    appointments: [{ starts_at: new Date('2026-04-20T12:00:00Z'), ends_at: new Date('2026-04-20T13:00:00Z'), encounterNoteFinalized: true }],
    // now is Mon 2026-04-27; checkin done same week (Mon 08:00 UTC)
    lastCheckinAt: new Date('2026-04-27T08:00:00Z'),
  }

  it('default S5 hero is "log_checkin" when checkin not done this week', () => {
    const result = detectDashboardState({ ...s5Base, lastCheckinAt: new Date('2026-04-15T12:00:00Z') })
    expect(result.heroAction.kind).toBe('log_checkin')
  })

  it('refill <=3 days wins over message and follow-up', () => {
    const result = detectDashboardState({
      ...s5Base,
      prescriptions: [{ runs_out_at: new Date('2026-04-29T12:00:00Z'), medication_name: 'Estradiol' }],
      messages: [{ read_at: null, sender: 'provider' }],
      recommendedFollowUpAt: new Date('2026-04-20T12:00:00Z'),
    })
    expect(result.heroAction.kind).toBe('refill_due')
  })

  it('overdue follow-up wins over unread message', () => {
    const result = detectDashboardState({
      ...s5Base,
      messages: [{ read_at: null, sender: 'provider' }],
      recommendedFollowUpAt: new Date('2026-04-20T12:00:00Z'),
    })
    expect(result.heroAction.kind).toBe('followup_overdue')
  })

  it('all caught up returns "all_caught_up"', () => {
    const result = detectDashboardState(s5Base)
    expect(result.heroAction.kind).toBe('all_caught_up')
  })
})
