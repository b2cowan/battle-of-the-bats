import type { ClubSourceRead } from './club-schedule-coach';

/**
 * ⚖ Hand-back dollars go only to people who can open Money (owner 2026-11-14, Q-A — the same rule as the schedule send's
 * bill, `docs/projects/active/LATE_BILL_MONEY_AUDIENCE_PLAN.md`). A staff member without Money still sees that a practice
 * was handed back, that the club was asked, and how it answered; the figure is taken out on the SERVER, so it never
 * reaches their browser: a waiting ask's cents, the figure a later ask could make (0 = something to ask, figure withheld),
 * a late ask's cents and what the club settled (credited / to pay).
 */
export function withoutClubMoney(sources: Record<string, ClubSourceRead>): Record<string, ClubSourceRead> {
  return Object.fromEntries(Object.entries(sources).map(([slot, s]) => [slot, {
    ...s,
    ask: s.ask ? { ...s.ask, cents: null } : null,
    handBack: s.handBack ? {
      ...s.handBack,
      askCents: s.handBack.askCents ? 0 : null,
      late: s.handBack.late ? { ...s.handBack.late, cents: null } : null,
      settled: s.handBack.settled ? { on: s.handBack.settled.on, creditedCents: null, toPayCents: null } : null,
    } : null,
  }]));
}
