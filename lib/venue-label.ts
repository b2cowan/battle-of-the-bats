import type { Venue } from './types';

type GameLike = {
  venueId?: string;
  venueFacilityId?: string;
  location?: string;
};

/**
 * THE one way a venue + surface becomes a display string — "Venue — Facility"
 * (em dash), or just the venue name when no surface is pinned. Every writer of a
 * denormalized `location` (games API, lane resolution, schedule import, league
 * venue rail) and every live label resolver must build the string here; two
 * corners of the product used to render a plain hyphen and drifted from the
 * live labels.
 */
/** The one separator between a venue and its facility in a stored line — `whereOfLibraryRow` splits a line at it. */
export const VENUE_FACILITY_SEPARATOR = ' — ';

export function formatVenueLocation(venueName: string, facilityName?: string | null): string {
  return facilityName ? `${venueName}${VENUE_FACILITY_SEPARATOR}${facilityName}` : venueName;
}

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
  const parts = resolveGameVenueParts(game, venues);
  return parts ? formatVenueLocation(parts.venue, parts.facility) : game.location ?? '';
}

/**
 * A game's managed venue and its facility, LIVE, as two names (the game row's Field column: the venue over the
 * facility). null when the game has no managed venue that can be found — the caller falls back to `game.location`,
 * which a stored line spells "Venue — Facility" (`VENUE_FACILITY_SEPARATOR`).
 */
export function resolveGameVenueParts(game: GameLike, venues: Venue[]): { venue: string; facility: string | null } | null {
  if (!game.venueId) return null;
  const venue = venues.find(v => v.id === game.venueId);
  if (!venue) return null;
  const facility = game.venueFacilityId ? venue.facilities?.find(f => f.id === game.venueFacilityId) : null;
  // null = no facility pinned or found; a found facility keeps its own name, even an empty one (the field label's rule).
  return { venue: venue.name, facility: facility ? facility.name : null };
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
  const parts = resolveGameVenueParts(game, venues);
  return parts ? (parts.facility ?? parts.venue) : game.location ?? '';
}
