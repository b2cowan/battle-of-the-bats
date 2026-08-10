/**
 * tournament-venue.ts (server-only — touches supabaseAdmin)
 *
 * The tournament twin of `lib/league-venue.ts`'s selection rail: the ONLY way a venue
 * reference gets onto a tournament game. The rules are pure and live in
 * `lib/tournament-venue-selection.ts` (unit-tested there); this module owns the catalog
 * fetch, so bulk writers (generator saves, bracket saves, imports) resolve N games on one
 * pair of queries.
 */

import { supabaseAdmin } from './supabase-admin';
import {
  resolveVenueSelectionFromCatalog,
  type TournamentVenueCatalog,
  type TournamentVenueSelectionResult,
} from './tournament-venue-selection';

export {
  resolveVenueSelectionFromCatalog,
  type TournamentVenueCatalog,
  type TournamentVenueSelection,
  type TournamentVenueSelectionResult,
} from './tournament-venue-selection';

export async function loadTournamentVenueCatalog(tournamentId: string): Promise<TournamentVenueCatalog> {
  const [venuesRes, facilitiesRes] = await Promise.all([
    supabaseAdmin.from('diamonds').select('id, name').eq('tournament_id', tournamentId),
    supabaseAdmin.from('venue_facilities').select('id, venue_id, name').eq('tournament_id', tournamentId),
  ]);
  if (venuesRes.error) throw venuesRes.error;
  if (facilitiesRes.error) throw facilitiesRes.error;

  return {
    tournamentId,
    venues: new Map((venuesRes.data ?? []).map(v => [v.id as string, { id: v.id as string, name: v.name as string }])),
    facilities: new Map((facilitiesRes.data ?? []).map(f => [
      f.id as string,
      { id: f.id as string, venueId: f.venue_id as string, name: f.name as string },
    ])),
  };
}

/** Load + resolve in one step — the single-game (PATCH) convenience. */
export async function resolveTournamentVenueSelection(args: {
  tournamentId: string;
  venueId?: string | null;
  venueFacilityId?: string | null;
  locationText?: string | null;
}): Promise<TournamentVenueSelectionResult> {
  const catalog = await loadTournamentVenueCatalog(args.tournamentId);
  return resolveVenueSelectionFromCatalog(catalog, args);
}
