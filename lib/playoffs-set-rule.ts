/**
 * WHEN "PLAYOFFS ARE SET" IS TRUE — the rule, pure (Tournament admin redesign, Stage 3 addendum: A69 ruled 2026-10-12;
 * build-start P4, owner 2026-10-12).
 *
 * It used to go on the first bracket SAVED anywhere in the tournament — published or not, before the round robin was
 * played (no seeding existed yet), once per tournament (F102). It now goes once per DIVISION, at the moment it is true:
 * the division is published and every one of its playoff teams is known. Wherever that becomes true — the last
 * round-robin score, a coin toss, a bracket saved after the round robin, publishing the division (a playoffs-only
 * event, its seeds set by hand) — the server asks this, then that no coin toss is still owed, and claims
 * `divisions.playoffs_announced_at` once while the division is published (lib/playoffs-set.ts).
 *
 * "Every playoff team is known": every side of every playoff game still on is either a team or the winner/loser of an
 * earlier game — no side still waits on a seed or a pool place — and at least one game has both its teams. A coin toss
 * still owed is not known: the seeds it decides can swap, so the moment waits for the toss.
 */

/** A playoff game's sides, as the rule reads them. */
export interface PlayoffSidesGame {
  status: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
}

/** "Winner SF1" / "Loser QF2" — a side decided by an earlier game, never by the standings. */
const FEEDER = /^\s*(winner|loser)\b/i;

export function playoffTeamsKnown(games: readonly PlayoffSidesGame[]): boolean {
  const live = games.filter(g => g.status !== 'cancelled');
  if (live.length === 0) return false;
  let aGameWithBoth = false;
  for (const g of live) {
    const sides: Array<[string | null, string | null]> = [[g.homeTeamId, g.homePlaceholder], [g.awayTeamId, g.awayPlaceholder]];
    for (const [team, placeholder] of sides) {
      if (team) continue;
      if (FEEDER.test(placeholder ?? '')) continue;
      return false; // waits on a seed, a pool place, or nothing at all
    }
    if (g.homeTeamId && g.awayTeamId) aGameWithBoth = true;
  }
  return aGameWithBoth;
}
