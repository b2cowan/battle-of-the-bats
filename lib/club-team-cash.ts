import 'server-only';
import { getRepProgramYearsForTeams } from './db';
import { seasonClosingCashCents } from './coach-register-book';
import { toDollars } from './coach-register';
import { orgDayKey } from './timezone';
import { inParallel } from './supabase-paging';
import { latestClosedSeasonOf, liveSeasonOf } from './season-live';
import type { TeamCashHeld } from './club-money-figures';
import type { RepProgramYear } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A TEAM'S CASH, READ BY THE CLUB (Club Tier Stage 3b; ruling D1, C15, Ask 4e).
 *
 * The coaches' records are the truth for a team's money; the club READS one figure from them — the
 * team's Cash on hand, exactly the figure the coach's Money shows — when its page loads. It is never
 * stored by the club, never added into a club figure, and totalled only in its own band
 * (`teamsCashTotal`, lib/club-money-figures.ts).
 *
 * ⚖ THROUGH THE COACH'S OWN FUNCTION, never a second arithmetic: `seasonClosingCashCents` is
 * `cashOnHandCents` over the season's own register walk plus the season's opening — the same figure
 * the register prints at Today and `money-summary` prints as Cash on hand, which `check:register`
 * holds equal. A team between seasons shows its last closed season's closing figure: the same
 * function, the figure "Start next season" would carry.
 *
 * ⚠ WHICH SEASON is the coach's own rule, read for every team at once: the LIVE season (`liveSeasonOf`,
 * `getActiveRepProgramYear`'s pure twin), else the last closed one (`latestClosedSeasonOf`).
 *
 * ⚠ NO YEAR PARAMETER INTO A COACH ROUTE (CLAUDE.md's look-back rule; `coach-history-endpoint-guard`).
 * This is a server-side call into the coach's library for the team's own LIVE season (or its last
 * closed one), from a club route. Nothing here gives a coach route a way to read another year.
 *
 * ⚠ A SEASON STORES NO CLOSE DATE. Closing flips its status (lib/rep-season-rollover.ts) and stamps
 * `updated_at`, so `closedOn` is the club day of that stamp — the close, for a season nobody has
 * edited since. Recorded as a finding in the plan; a real close stamp is its own migration.
 *
 * ⚠ COST: one register walk per team (~13 reads each), three teams at a time. Fine for a 15- or 30-team
 * club; it is the slowest read on the board summary, so the summary starts it first.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export async function teamCashHeld(teamIds: readonly string[]): Promise<TeamCashHeld[]> {
  const byTeam = new Map<string, RepProgramYear[]>();
  for (const s of await getRepProgramYearsForTeams(teamIds)) byTeam.set(s.teamId, [...(byTeam.get(s.teamId) ?? []), s]);
  const seasonOf = new Map<string, { season: RepProgramYear; live: boolean }>();
  for (const [id, mine] of byTeam) {
    const live = liveSeasonOf(mine);
    const season = live ?? latestClosedSeasonOf(mine);
    if (season) seasonOf.set(id, { season, live: !!live });
  }
  return inParallel(teamIds, 3, async (teamId): Promise<TeamCashHeld> => {
    const found = seasonOf.get(teamId);
    if (!found) return { teamId, cash: null, season: null };
    const { season, live } = found;
    try {
      const cents = await seasonClosingCashCents(season, teamId);
      return {
        teamId,
        cash: toDollars(cents),
        season: { id: season.id, name: season.name, live, closedOn: live ? null : orgDayKey(season.updatedAt) },
      };
    } catch (e) {
      // A team whose books can't be read shows no figure — never a guess, never a zero.
      console.error('[club-team-cash] could not read a team’s cash on hand:', teamId, e);
      return { teamId, cash: null, season: null };
    }
  });
}
