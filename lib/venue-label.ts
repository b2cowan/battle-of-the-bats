import type { Venue } from './types';

type GameLike = {
  venueId?: string;
  venueFacilityId?: string;
  location?: string;
};

/**
 * Resolve a game's display location LIVE from the venues array (which must be
 * loaded WITH facilities), so a venue or facility rename propagates everywhere
 * immediately. Falls back to the denormalized `game.location` snapshot for
 * free-text venues, pre-save preview rows, or when the managed venue can't be
 * found. Returns '' when there's nothing to show.
 *
 * This is the single source of truth for the "Venue — Facility" label shown on
 * the schedule list, the playoff bracket, the public home/schedule cards, and
 * the game-detail page.
 */
export function resolveGameVenueLabel(game: GameLike, venues: Venue[]): string {
  if (game.venueId) {
    const venue = venues.find(v => v.id === game.venueId);
    if (venue) {
      const facility = game.venueFacilityId
        ? venue.facilities?.find(f => f.id === game.venueFacilityId)
        : null;
      return facility ? `${venue.name} — ${facility.name}` : venue.name;
    }
  }
  return game.location ?? '';
}

/**
 * Resolve a game's SHORT field/diamond label LIVE — the most specific surface
 * within a venue (e.g. "Diamond 2"), without the parent venue name. For compact
 * UIs (the playoff bracket card) where the venue is usually constant across the
 * event and the field is the differentiator a fan needs. Falls back to the venue
 * name when there's no facility, then to the denormalized `game.location`
 * snapshot. Like {@link resolveGameVenueLabel}, a facility rename propagates
 * immediately rather than showing the stale string baked onto the game.
 */
export function resolveGameFieldLabel(game: GameLike, venues: Venue[]): string {
  if (game.venueId) {
    const venue = venues.find(v => v.id === game.venueId);
    if (venue) {
      const facility = game.venueFacilityId
        ? venue.facilities?.find(f => f.id === game.venueFacilityId)
        : null;
      return facility ? facility.name : venue.name;
    }
  }
  return game.location ?? '';
}
