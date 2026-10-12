/**
 * club-slot-event.ts — is this team event the CLUB'S booking (Club Tier Stage 11a, mig 326; Stage 11 Ask 1, Asks 16–17)?
 * Dependency-free, as `isMirroredEvent` is, so the coach's routes, the coach's screens and the guards read one predicate.
 *
 * A practice a club schedule wrote is the club's booking on the team's schedule — the published-tournament-game pattern:
 * its time, place, name and whether it happens at all are the club's (written at Finalize, changed at Send the changes,
 * never on read); the coach keeps arrival, notes, uniform, links, tags, attendance, the lineup and the practice plan, and
 * can HAND IT BACK (`/api/coaches/…/events/[eventId]/hand-back`). The server refuses the rest, not just the screen.
 */

/** The club's practice: one with a club schedule slot. ONE named predicate — when "the club's" needs a second
 *  condition, it changes here. */
export function isClubSlotEvent(event: { clubScheduleSlotId?: string | null } | null | undefined): boolean {
  return Boolean(event?.clubScheduleSlotId);
}

/**
 * The API fields a coach may NOT write on the club's practice — its WHEN, WHERE, WHAT and whether it happens (a coach
 * hands a practice back; they never cancel or delete the club's). The coach's own fields (arrivalTime, description,
 * uniform, resources, tagIds, and the practice plan, attendance and lineup on their own routes) stay theirs.
 */
export const CLUB_OWNED_API_FIELDS = [
  'name', 'startsAt', 'endsAt', 'location', 'locationAddress', 'fieldNumber',
  'placeId', 'orgVenueId', 'orgVenueFacilityId', 'status',
  'opponent', 'homeAway', 'teamScore', 'opponentScore', 'result', 'isScrimmage',
] as const;

/** [marketing] The coach's refusals, in the mirror's construction (Ask 16) — `schedule` is the schedule's name. */
export const CLUB_SLOT_REFUSALS = {
  change: (schedule: string) =>
    `This practice comes from ${schedule}, the club’s schedule. Only the club can move or remove this practice. You can still set arrival, notes, uniform, links and tags — and take attendance or plan it. If you won’t use it, hand it back.`,
  remove: (schedule: string) =>
    `This practice comes from ${schedule}, the club’s schedule. Only the club can move or remove this practice. If you won’t use it, hand it back and the club can give the time to another team.`,
} as const;
