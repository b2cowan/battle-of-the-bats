import 'server-only';
import { getOrgForGate, isFamilyLayerEnabled } from './family-access';
import { getFamilyTeamView, type FamilyScheduleEntry } from './family-view';
import { isLiveLeagueSeasonStatus, type TeamKind } from './family-link-reach';
import { readCoachFeedEvents, readCoachFeedTeam } from './house-league-coach';
import { leagueEntries } from './family-league-entries';

/**
 * ONE TEAM'S SCHEDULE AS A CONNECTED FAMILY READS IT, either kind (Signed-in family accounts Stage 4a, Parts 6–7). The family
 * team page and the parent's one calendar address both read a team through here, so the page and the calendar can never
 * disagree on what a family sees.
 *
 *   rep     the team's family view (lib/family-view.ts): its live season, the schedule-visibility rule (a team set to staff
 *           shares nothing) and the premium gate (`isFamilyLayerEnabled`) — exactly as the rep family page always read it.
 *   league  a house-league team's games AS LAST SENT once the division's schedule is published (a held change is never shown),
 *           and its practices — the same reader the house-league coach's calendar uses (`readCoachFeedEvents`), so a family is
 *           never told a time the coach wasn't. A finished season shares nothing. A connected family gets practices (owner
 *           2026-10-20: families get every kind; only the PUBLIC page is games-only).
 *
 * ⚠ Team-level only. The entries carry no player field (lib/family-view.ts's allow-list); nothing here reads a roster.
 * ⚠ The CALLER proves the parent reaches the team (`getFamilyReach`); this module never authorizes.
 * House-league scores are not carried in 4a (the sent-games reader keeps them, the feed shape doesn't): a past game reads as done.
 */

export interface FamilyTeamSchedule {
  kind: TeamKind;
  teamId: string;
  orgId: string;
  orgName: string;
  teamName: string;
  /** House league: the division ("U9 Rookie"), shown after the team name. Null on a rep team. */
  divisionName: string | null;
  /** "2027" / "House League 2027". */
  seasonLine: string | null;
  /** A rep team's record ("12–6–2") once it has one. */
  record: { wins: number; losses: number; ties: number } | null;
  sport: string | null;
  entries: FamilyScheduleEntry[];
}

/** A team this family reaches but whose schedule is not shared right now (staff only, premium lapsed, season finished). */
export const HIDDEN = 'hidden' as const;

export async function familyTeamSchedule(kind: TeamKind, teamId: string): Promise<FamilyTeamSchedule | typeof HIDDEN | null> {
  return kind === 'rep' ? repSchedule(teamId) : leagueSchedule(teamId);
}

async function repSchedule(teamId: string): Promise<FamilyTeamSchedule | typeof HIDDEN | null> {
  const view = await getFamilyTeamView({ repTeamId: teamId, requireVisibility: 'families' });
  if (!view) return HIDDEN;
  // Re-checked on every read: a team whose entitlement lapses stops serving families the same day.
  const org = await getOrgForGate(view.orgId);
  if (!org || !(await isFamilyLayerEnabled({ org, repTeamId: teamId }))) return HIDDEN;
  const { wins, losses, ties } = view.record;
  return {
    kind: 'rep',
    teamId,
    orgId: view.orgId,
    orgName: view.orgName,
    teamName: view.teamName,
    divisionName: null,
    seasonLine: view.seasonYear ? String(view.seasonYear) : null,
    record: wins + losses + ties > 0 ? view.record : null,
    sport: view.sport,
    entries: view.entries,
  };
}

async function leagueSchedule(teamId: string): Promise<FamilyTeamSchedule | typeof HIDDEN | null> {
  const team = await readCoachFeedTeam(teamId);
  if (!team) return null;
  // A cancelled club's family pages stop (the same chokepoint the rep side rides).
  const org = await getOrgForGate(team.card.orgId);
  if (!org || !isLiveLeagueSeasonStatus(team.season.status)) return HIDDEN;
  const events = await readCoachFeedEvents({
    orgId: team.card.orgId, seasonId: team.seasonId, divisionId: team.divisionId,
    schedulePublished: team.schedulePublished, teamId,
  });
  return {
    kind: 'league',
    teamId,
    orgId: team.card.orgId,
    orgName: team.card.orgName,
    teamName: team.card.teamName,
    divisionName: team.card.divisionName || null,
    seasonLine: team.card.seasonName || null,
    record: null,
    sport: null,
    entries: leagueEntries(events, Date.now()),
  };
}
