// ─────────────────────────────────────────────────────────────────────────────
// Insights weekly digest — the two "is there anything to say THIS week?" gates
// (owner ruling 2026-11-15; INSIGHTS_DIGEST_QUIET_TEAMS_AND_NEXT_UP_HORIZON_PLAN.md).
//
// Pure on purpose: no database import, so the rules unit-test without a server.
//
// The digest's findings are season-to-date facts ("this lineup is 2-0", "you've won 9
// straight"). On their own they never go quiet, so a team that stopped playing in
// September kept getting the same Sunday notification forever. Two gates fix that:
//   1. Activity — something actually happened for the team in the last week.
//   2. Repeat  — the coach isn't being told exactly what last week's notification said.
// ─────────────────────────────────────────────────────────────────────────────

/** How far back "something happened this week" looks. One week, matching the Sunday cadence. */
export const DIGEST_ACTIVITY_DAYS = 7;

/** The slice of an event the activity gate reads. */
export interface DigestActivityEvent {
  startsAt: string;
  status: 'scheduled' | 'cancelled';
}

/**
 * True when the team had at least one event that took place inside the last week — a game, a
 * tournament game or a practice that was not cancelled and has already started. A future event
 * is not activity yet, and a cancelled one never happened.
 */
export function teamHadActivityInWindow(
  events: readonly DigestActivityEvent[],
  now: Date,
  days: number = DIGEST_ACTIVITY_DAYS,
): boolean {
  const nowMs = now.getTime();
  const sinceMs = nowMs - days * 86400000;
  return events.some(e => {
    if (e.status === 'cancelled') return false;
    const t = new Date(e.startsAt).getTime();
    return Number.isFinite(t) && t > sinceMs && t <= nowMs;
  });
}

/**
 * True when this digest says exactly what the coach's previous one said. `previous` is the facts
 * the last digest stored in its metadata (null when they have none, or it predates the facts).
 */
export function isRepeatOfLastDigest(previous: unknown, next: unknown): boolean {
  if (previous == null || next == null) return false;
  return canonical(previous) === canonical(next);
}

/** JSON with object keys sorted — the stored copy came back from a jsonb column, which does not keep key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}
