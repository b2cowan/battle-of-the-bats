import type { BillingTournamentSummary } from './billing-retention-types';

/**
 * Which tournaments a downgrade KEEPS when an org no longer fits its plan's cap.
 *
 * Deliberately a pure module with no `server-only` and no I/O: this is the one piece of the
 * downgrade that decides what a customer loses, so it has to be directly testable. (It lived in
 * lib/billing-retention.ts first, where `import 'server-only'` made it unreachable from a unit
 * test — which is how the defect below went unnoticed.)
 *
 * ⚠ THE RULE IT ENFORCES: never archive a tournament that is happening right now. The candidate
 * list arrives sorted for DISPLAY (year DESC, then name ASC), and simply keeping the first N of
 * that is pure alphabet within a year — "April Open" (finished in the spring) would be kept over
 * "Summer Showdown" running today. Archiving a live tournament 404s its whole public site
 * instantly, mid-event, for every family watching. So rank by what the org is actually USING:
 *
 *   0 — running now (`active`, or today falls inside its dates)
 *   1 — upcoming (starts in the future) — nearest first
 *   2 — being planned (draft, no dates yet)
 *   3 — finished — most recent first
 */
export function rankForKeeping(
  t: Pick<BillingTournamentSummary, 'status' | 'startDate' | 'endDate'>,
  todayIso: string,
): number {
  // 'active' is trusted first, on purpose: an organizer marking a tournament active is a
  // deliberate signal, and keeping a stale-active event costs nothing — whereas archiving a live
  // one is unrecoverable mid-event. The bias is toward keeping.
  if (t.status === 'active') return 0;
  const startsInFuture = t.startDate != null && t.startDate > todayIso;
  const endedAlready = t.endDate != null && t.endDate < todayIso;
  const started = t.startDate != null && t.startDate <= todayIso;
  if (started && !endedAlready) return 0;      // inside its date window, whatever the status says
  if (startsInFuture) return 1;
  if (t.status === 'draft') return 2;
  return 3;
}

/**
 * The keep-order itself: rank first, then break ties usefully. Returns a NEW array, most-worth-
 * keeping first, so callers can `slice(cap)` for what to archive.
 */
export function orderByKeepPriority<T extends Pick<BillingTournamentSummary, 'status' | 'startDate' | 'endDate' | 'year' | 'name'>>(
  tournaments: readonly T[],
  todayIso: string,
): T[] {
  return [...tournaments].sort((a, b) => {
    const ra = rankForKeeping(a, todayIso);
    const rb = rankForKeeping(b, todayIso);
    if (ra !== rb) return ra - rb;
    // Within "upcoming" the soonest matters most; everywhere else the most recent does.
    if (ra === 1) return (a.startDate ?? '').localeCompare(b.startDate ?? '');
    if ((b.year ?? 0) !== (a.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
    return a.name.localeCompare(b.name);
  });
}
