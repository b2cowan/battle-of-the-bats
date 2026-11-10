import type { FamilyScheduleEntry } from './family-view';
import type { FeedTeamEvent } from './export/team-feed-words';

/* Pure (no database): the family's house-league schedule rule, read by lib/family-team-schedule.ts (Signed-in family accounts
   Stage 4a, Part 6) and tested straight (tests/unit/family-home.test.ts). */

/** A house-league team's events as the family list's entries: in time order, a past game done, the next one marked.
 *  A postponed game stays on the day it had, never done and never "up next", until it has a new date (Prospect Demo P2b). */
export function leagueEntries(events: readonly FeedTeamEvent[], now: number): FamilyScheduleEntry[] {
  const dated = events.filter((e): e is FeedTeamEvent & { startsAt: string } => !!e.startsAt)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  const isPast = (e: { startsAt: string }) => new Date(e.startsAt).getTime() < now;
  const on = (e: FeedTeamEvent) => e.status !== 'cancelled' && e.status !== 'postponed';
  const next = dated.find(e => on(e) && !isPast(e))?.id ?? null;
  return dated.map(e => ({
    id: e.id,
    eventType: e.eventType,
    name: e.name,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    location: e.location,
    locationAddress: e.locationAddress,
    fieldNumber: e.fieldNumber,
    arrivalTime: e.arrivalTime,
    opponent: e.opponent,
    homeAway: e.homeAway === 'home' || e.homeAway === 'away' ? e.homeAway : null,
    teamScore: null,
    opponentScore: null,
    result: null,
    status: e.status === 'cancelled' ? 'cancelled' : e.status === 'postponed' ? 'postponed' : 'scheduled',
    completed: e.eventType !== 'practice' && e.status !== 'postponed' && isPast(e),
    hasScore: false,
    isNextUp: e.id === next,
  }));
}
