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
import type { FacilityType } from './types';
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

/**
 * Create a venue for a tournament. Thin, but it belongs here rather than inline in a route: the
 * Phase 3 resolve screen creates venues from a typed name, and the venues admin creates them from
 * a form, and a future hardening (a uniqueness rule, a plan cap, an audit row) must land once.
 * Callers remain responsible for authorization — this is the write, not the gate.
 */
export async function createTournamentVenue(args: {
  tournamentId: string;
  name: string;
  address?: string | null;
  notes?: string | null;
  sourceOrgVenueId?: string | null;
}): Promise<{ id: string; name: string }> {
  const { data, error } = await supabaseAdmin
    .from('diamonds')
    .insert({
      tournament_id: args.tournamentId,
      name: args.name,
      address: args.address ?? null,
      notes: args.notes ?? null,
      source_org_venue_id: args.sourceOrgVenueId ?? null,
    })
    .select('id, name')
    .single();
  if (error) throw error;
  return { id: data.id as string, name: data.name as string };
}

/**
 * Create a surface inside a venue.
 *
 * `tournamentId` is taken from the PARENT VENUE by the caller, never from client input — a
 * mismatched `tournament_id` here poisons every tenant-scoped facility read, which is the hardening
 * Phase 2's review applied to the venues route and the reason this write is shared rather than
 * copied.
 */
export async function createTournamentFacility(args: {
  tournamentId: string;
  venueId: string;
  name: string;
  facilityType: FacilityType;
  displayOrder?: number;
  notes?: string | null;
}): Promise<{ id: string; venueId: string; name: string }> {
  const { data, error } = await supabaseAdmin
    .from('venue_facilities')
    .insert({
      venue_id: args.venueId,
      tournament_id: args.tournamentId,
      name: args.name,
      facility_type: args.facilityType,
      display_order: args.displayOrder ?? 0,
      notes: args.notes ?? null,
    })
    .select('id, venue_id, name')
    .single();
  if (error) throw error;
  return { id: data.id as string, venueId: data.venue_id as string, name: data.name as string };
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
