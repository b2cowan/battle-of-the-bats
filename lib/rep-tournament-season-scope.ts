import 'server-only';
import { getActiveRepProgramYear } from './db';
import {
  getMergedTournamentHistoryForRepTeam,
  type BasicCoachTournamentHistoryEntry,
} from './basic-coach-teams';
import { resolveSeasonFloor } from './rep-tournament-game-mirror';
import { tournamentReachesSeason } from './tournament-game-mirror';

/**
 * lib/rep-tournament-season-scope.ts — which of a team's tournaments belong to the WORKING season.
 *
 * ⚠ OWNER RULING 2026-09-12: the Tournaments page, the Overview's Tournaments tile and the
 * Schedule's read-only game chips show THIS SEASON'S tournaments only. A team's registration
 * record is lifetime by nature — a workspace's basic-coach team keeps every registration it ever
 * claimed, and an admin link never expires — but the coach portal reads it through a season, and
 * a season that has been rolled forward must not carry last year's weekend into the new record.
 * The day it shipped, a freshly rolled 2027 season showed all of last July's tournament on its
 * Schedule (scores and all) and counted it on Overview.
 *
 * THE BOUNDARY IS THE MIRROR'S, NOT A NEW ONE. `resolveSeasonFloor` is the same start marker the
 * tournament-game mirror uses to decide which games become calendar events (its header explains
 * why a first season has no floor and why a later one is softened by the coach's own earliest
 * event). Reading the tournament list through the same marker is what keeps the three surfaces
 * agreeing: a tournament the Schedule shows is one the Tournaments page lists and the tile counts.
 *
 * The per-tournament rule is `tournamentReachesSeason` (pure, unit-tested): a tournament that
 * finished before the season began contributes nothing; one with no dates at all stays visible.
 *
 * Accepted trade-off, flagged to the owner with the ruling: an entry fee still owed on LAST
 * season's tournament leaves the coach's view with it. The organizer's own record and reminders
 * carry that debt; if the coach portal needs to as well, that is a shelf on the closed-season
 * page (per the season-close plan), not a lifetime exception here.
 *
 * The one caller that must NOT use this is the mirror itself — it reads the merged history and
 * applies the floor PER GAME, which is the tighter rule a calendar needs.
 */
export async function getSeasonTournamentHistoryForRepTeam(repTeamId: string): Promise<{
  history: BasicCoachTournamentHistoryEntry[];
  basicCoachTeamId: string | null;
  linkage: 'workspace' | 'admin-link' | 'none';
  /** The working season's start marker (YYYY-MM-DD), or null: a first season, or no open season. */
  seasonFloor: string | null;
}> {
  const [merged, programYear] = await Promise.all([
    getMergedTournamentHistoryForRepTeam(repTeamId),
    getActiveRepProgramYear(repTeamId),
  ]);
  // No open season ⇒ no floor, which is the lifetime read every caller had before. The live
  // surfaces are not mounted for such a team anyway (CoachTeamSeasonGate sends the coach to the
  // closed-season page), so this only ever narrows, never widens, what a coach can reach.
  const seasonFloor = programYear
    ? await resolveSeasonFloor(repTeamId, programYear.id, programYear.createdAt)
    : null;
  return {
    ...merged,
    seasonFloor,
    history: merged.history.filter(h => tournamentReachesSeason(h.tournament, seasonFloor)),
  };
}
