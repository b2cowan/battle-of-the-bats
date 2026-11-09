import type { FamilyScheduleEntry } from './family-view';
import type { FeedTeamEvent } from './export/team-feed-words';

/* Pure (no database): the family's house-league schedule rule, read by lib/family-team-schedule.ts (Signed-in family accounts
   Stage 4a, Part 6) and tested straight (tests/unit/family-home.test.ts). */

/** A house-league team's events as the family list's entries: in time order, a past game done, the next one marked. */
export function leagueEntries(events: readonly FeedTeamEvent[], now: number): FamilyScheduleEntry[] {
  const dated = events.filter((e): e is FeedTeamEvent & { startsAt: string } => !!e.startsAt)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  const isPast = (e: { startsAt: string }) => new Date(e.startsAt).getTime() < now;
  const next = dated.find(e => e.status !== 'cancelled' && !isPast(e))?.id ?? null;
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
    status: e.status === 'cancelled' ? 'cancelled' : 'scheduled',
    completed: e.eventType !== 'practice' && isPast(e),
    hasScore: false,
    isNextUp: e.id === next,
  }));
}
