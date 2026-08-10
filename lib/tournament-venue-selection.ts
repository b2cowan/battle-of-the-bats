/**
 * tournament-venue-selection.ts (pure — no database, unit-testable)
 *
 * The rules half of the tournament venue rail (`lib/tournament-venue.ts` owns the catalog
 * fetch): given a tournament's fields and a client's venue selection, decide what actually
 * gets written. The display string is DERIVED via {@link formatVenueLocation}, so
 * `games.location` can never disagree with the reference it sits beside; free text survives
 * only when nothing is picked — the explicit "somewhere else" path.
 *
 * Multi-tenant: the catalog is tournament-scoped by construction, so a venue id from
 * another tournament — or another org — resolves to "not found" rather than being written
 * through. (The bare FK never enforced tenancy; this rail does.)
 */

import { formatVenueLocation } from './venue-label';

export interface TournamentVenueCatalog {
  tournamentId: string;
  /** venue id → name (`diamonds`) */
  venues: Map<string, { id: string; name: string }>;
  /** facility id → parent venue + name (`venue_facilities`) */
  facilities: Map<string, { id: string; venueId: string; name: string }>;
}

export interface TournamentVenueSelection {
  venueId: string | null;
  venueFacilityId: string | null;
  /** Derived "Venue — Facility" when picked; the trimmed typed text otherwise. */
  location: string | null;
}

export type TournamentVenueSelectionResult =
  | { ok: true; value: TournamentVenueSelection }
  | { ok: false; error: string };

export function resolveVenueSelectionFromCatalog(
  catalog: TournamentVenueCatalog,
  args: {
    venueId?: string | null;
    venueFacilityId?: string | null;
    /** Typed free text — used ONLY when no venue is picked. */
    locationText?: string | null;
  },
): TournamentVenueSelectionResult {
  const venueId = args.venueId || null;
  const facilityId = args.venueFacilityId || null;

  if (!venueId && !facilityId) {
    const text = args.locationText?.trim() || null;
    return { ok: true, value: { venueId: null, venueFacilityId: null, location: text } };
  }

  // A facility alone is enough — its parent venue is on the record.
  const facility = facilityId ? catalog.facilities.get(facilityId) : null;
  if (facilityId && !facility) {
    return { ok: false, error: 'That field no longer exists in this tournament.' };
  }

  const resolvedVenueId = venueId ?? facility!.venueId;
  const venue = catalog.venues.get(resolvedVenueId);
  // "not found" for a foreign tournament's venue too — don't confirm it exists.
  if (!venue) {
    return { ok: false, error: 'That venue no longer exists in this tournament.' };
  }
  if (facility && facility.venueId !== venue.id) {
    return { ok: false, error: 'That field belongs to a different venue.' };
  }

  return {
    ok: true,
    value: {
      venueId: venue.id,
      venueFacilityId: facility?.id ?? null,
      location: formatVenueLocation(venue.name, facility?.name),
    },
  };
}
