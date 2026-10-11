import 'server-only';
import {
  getActiveRepProgramYear,
  getOrganizationBySlug,
  getRepTeam,
  getRepTeamEvents,
  getRepTryout,
  getRepTryoutSessions,
} from './db';
import { getOrgForGate } from './family-access';
import { getCalendarLinkState, recordCalendarRead } from './coach-membership';
import { getActiveTeamEntitlement, isTeamWorkspaceOrg } from './team-workspace-entitlements';
import { orgPlanCarriesCoachesPortal } from './coach-portal-plan';
import { resolveCoachCapabilities } from './coach-capabilities';
import { getSeasonTournamentHistoryForRepTeam } from './rep-tournament-season-scope';
import { getRegistrationGamesForTeam } from './basic-coach-teams';
import { onOrAfterSeasonFloor } from './tournament-game-mirror';
import { tournamentToday } from './timezone';
import type { ICSInstantEventInput } from './export/ics';
import { teamCalendarName, teamFeedEntries, type FeedOrganizerGame } from './export/team-feed-words';
import {
  calendarLinkSecret,
  coachLinkStopReason,
  shouldRecordCalendarRead,
  verifyCoachCalendarToken,
} from './coach-calendar-link';

/**
 * lib/coach-calendar-feed.ts — WHAT A COACH'S CALENDAR LINK ANSWERS (Club Tier Stage 6d, A2; Asks 1, 2, 9).
 *
 * Asked on EVERY read, because a calendar app polls for months and the coach's place on the team can change under it:
 *   · a link we never issued (bad shape, bad signature) → `refused`, "not found";
 *   · a link we issued that has stopped → `stopped`, an EMPTY calendar under the team's name, so its events leave the
 *     subscriber's calendar instead of freezing there (S6D-04). It stops when: the membership is gone, removed or reset
 *     (`coachLinkStopReason`), its schedule access is off, the team is archived, the club has cancelled
 *     (`getOrgForGate`, the family layer's chokepoint), the team isn't entitled (the coach's own Schedule read's rule,
 *     `getEntitledTeamMembership`: a standalone portal needs its team entitlement), or there is no live season;
 *   · otherwise `live`: what the coach's Schedule shows (Ask 2) — every event of the live season, the organizer's games
 *     the list doesn't hold yet (the overlay's own server read, de-duplicated the overlay's way), and the tryout days
 *     ONLY for a coach who holds the tryouts capability — in the coach's words (F6: arrival, uniform, notes).
 *
 * There are no staff-only events to add (S6D-06): an event has no visibility of its own.
 *
 * The last read is recorded at most once a day (the owner's cost ruling), on a live read only.
 */
export type CoachFeedAnswer =
  | { kind: 'unconfigured' }
  | { kind: 'refused' }
  | { kind: 'stopped'; calendarName: string }
  | { kind: 'live'; calendarName: string; entries: ICSInstantEventInput[] };

export async function readCoachFeed(token: string, origin: string): Promise<CoachFeedAnswer> {
  const secret = calendarLinkSecret();
  if (!secret) return { kind: 'unconfigured' };
  const named = verifyCoachCalendarToken(token, secret);
  if (!named) return { kind: 'refused' };

  // The membership first: every stop it can decide costs one point read and nothing more.
  const link = await getCalendarLinkState(named.membershipId);
  if (!link || coachLinkStopReason(link, named.generation)) {
    return { kind: 'stopped', calendarName: link ? await stoppedName(link) : 'Team schedule' };
  }

  // Then the team, the club and the live season together — each needs only the ids the link holds.
  const [team, org, season] = await Promise.all([
    getRepTeam(link.teamId),
    getOrgForGate(link.orgId),
    getActiveRepProgramYear(link.teamId),
  ]);
  const calendarName = team ? teamCalendarName(team.name, org?.name) : 'Team schedule';
  if (!team || team.orgId !== link.orgId || team.isArchived || !org || !season) return { kind: 'stopped', calendarName };
  // The entitlement: the coach's own Schedule read's rule (`getEntitledTeamMembership`) — a standalone portal needs its
  // team entitlement, asked of this one team with the membership already in hand — and the portal's own wall: a club's
  // team rides the club's PLAN, which must still carry the Coaches Portal (`orgPlanCarriesCoachesPortal`, B05 — the
  // portal layout walls a club that moved down; found walking dev's feed 2026-10-11, where it had kept serving).
  if (isTeamWorkspaceOrg(org)) {
    if (!(await getActiveTeamEntitlement(org.id, team.id))) return { kind: 'stopped', calendarName };
  } else {
    const club = await getOrganizationBySlug(org.slug);
    if (!club || !orgPlanCarriesCoachesPortal(club)) return { kind: 'stopped', calendarName };
  }

  const capabilities = resolveCoachCapabilities(link.coachRole, link.capabilities);
  const [events, tryoutDays, organizerGames] = await Promise.all([
    getRepTeamEvents(season.id),
    capabilities.tryouts
      ? getRepTryout(season.id).then(t => (t ? getRepTryoutSessions(t.id) : []))
      : Promise.resolve([]),
    readOrganizerGames(team.id),
  ]);

  const today = tournamentToday();
  if (shouldRecordCalendarRead(link.lastReadOn, today)) {
    // Awaited (Amplify drops work after the response), and never fatal: a feed that answers is worth more than the line.
    await recordCalendarRead(link.membershipId, link.generation, today).catch(e => {
      console.error('[coach-calendar-feed] recording the last read failed (the feed still answers):', e);
    });
  }

  const base = `${origin.replace(/\/$/, '')}/${org.slug}/coaches/teams/${team.id}`;
  return {
    kind: 'live',
    calendarName,
    entries: teamFeedEntries({
      teamName: team.name,
      sport: team.sport,
      reader: 'coach',
      events,
      tryoutDays,
      organizerGames,
      // F7 — a coach's entry opens the event in the portal (the Schedule's own deep link); a tryout day the Tryouts page.
      linkFor: (kind, id) => (kind === 'event' ? `${base}/schedule?event=${encodeURIComponent(id)}`
        : kind === 'tryout' ? `${base}/tryouts` : `${base}/schedule`),
    }),
  };
}

/** A stopped link's calendar still carries the team's name (F8) — two reads, paid only by a link that has stopped. */
async function stoppedName(link: { teamId: string; orgId: string }): Promise<string> {
  const [team, org] = await Promise.all([getRepTeam(link.teamId), getOrgForGate(link.orgId)]);
  return team ? teamCalendarName(team.name, org?.name) : 'Team schedule';
}

/**
 * The organizer's games for the team's season — the SAME server read the Schedule's overlay route makes
 * (`app/api/coaches/[orgSlug]/teams/[teamId]/tournament-games`), never the route. Non-fatal, as there: a failure leaves
 * the coach's own events in the feed.
 */
async function readOrganizerGames(teamId: string): Promise<FeedOrganizerGame[]> {
  try {
    const { history, seasonFloor } = await getSeasonTournamentHistoryForRepTeam(teamId);
    if (history.length === 0) return [];
    return (await getRegistrationGamesForTeam(history)).filter(g => onOrAfterSeasonFloor(g.gameDate, seasonFloor));
  } catch (e) {
    console.error('[coach-calendar-feed] organizer games read failed (the feed keeps the team\'s own events):', e);
    return [];
  }
}
