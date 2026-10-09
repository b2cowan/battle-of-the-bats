/**
 * rep-event-where.ts (server-only) — WHERE a rep booking is, as a write stores it (Club Tier Stage 6a, Ask 13).
 *
 * One rail for every rep writer that takes a place from a form — the events POST and PATCH (one and a series)
 * and the tryout days — and one shape for a booking on one of the club's venues, which the schedule import uses
 * too, so the three ways to say where can't drift apart between them:
 *   - ONE OF THE CLUB'S VENUES — proved (`resolveClubVenueSelection`: the club's own venue, that venue's own
 *     facility), and its words COPIED onto the booking (name → location, address → locationAddress, the facility's
 *     name → fieldNumber), the way a picked place's words are copied (mig 307). The client's words are ignored for
 *     a club venue: the club's names are the record, so the family calendar can't drift from them.
 *   - THE TEAM'S OWN PLACE — `resolvePlaceId` (this team's, else dropped), with the form's words, as built.
 *   - TYPED WORDS — as built.
 * ⚠ NEVER BOTH a club venue and a place: picking either clears the other here, and the database refuses the pair
 * (mig 319's `rep_team_events_place_or_club_venue`), so no writer can store it.
 */
import { resolvePlaceId } from './rep-event-places';
import { resolveClubVenueSelection } from './venue-clash-lookup';
import type { OrgPlan } from './types';

export interface RepWhereFields {
  location?: string | null;
  locationAddress?: string | null;
  fieldNumber?: string | null;
  placeId?: string | null;
  orgVenueId?: string | null;
  orgVenueFacilityId?: string | null;
}

export type RepWhereResult = { ok: true; fields: RepWhereFields } | { ok: false; error: string };

/**
 * A booking on one of the club's venues: its two links, the club's own words as the booking's copy, and never a
 * place (`withPlace: false` for a tryout day, which has no place link to clear).
 */
export function clubVenueFields(
  venue: { id: string; name: string; address: string | null },
  facility: { id: string; name: string } | null,
  withPlace = true,
): RepWhereFields {
  return {
    orgVenueId: venue.id,
    orgVenueFacilityId: facility?.id ?? null,
    location: venue.name,
    locationAddress: venue.address,
    fieldNumber: facility?.name ?? null,
    ...(withPlace ? { placeId: null } : {}),
  };
}

const trimmed = (v: unknown): string | null | undefined =>
  v === undefined ? undefined : (typeof v === 'string' ? v.trim() || null : null);

/**
 * `partial` (a PATCH): only the fields the body spoke about come back, so an edit that never touched where
 * leaves it alone. A create gets every field. `withPlace: false` for a tryout day (it has no place book).
 * `storedVenueId` (a PATCH): the club venue the booking stands on now — keeping it never meets the plan gate.
 */
export async function resolveRepEventWhere(args: {
  org: { id: string; planId?: OrgPlan | null };
  teamId: string;
  body: Record<string, unknown>;
  partial: boolean;
  withPlace?: boolean;
  storedVenueId?: string | null;
}): Promise<RepWhereResult> {
  const { org, teamId, body, partial, storedVenueId } = args;
  const withPlace = args.withPlace !== false;
  const spokeVenue = body.orgVenueId !== undefined || body.orgVenueFacilityId !== undefined;

  if (spokeVenue) {
    const sel = await resolveClubVenueSelection({ org, orgVenueId: body.orgVenueId, orgVenueFacilityId: body.orgVenueFacilityId, storedVenueId });
    if (!sel.ok) return { ok: false, error: sel.error };
    if (sel.value.venue) return { ok: true, fields: clubVenueFields(sel.value.venue, sel.value.facility, withPlace) };
  }

  // Not on a club venue: the team's place or typed words, exactly as built — and any club link cleared when the
  // body spoke about it (or when a create, which states everything).
  const fields: RepWhereFields = {};
  if (spokeVenue || !partial) { fields.orgVenueId = null; fields.orgVenueFacilityId = null; }
  const location = trimmed(body.location);
  const address = trimmed(body.locationAddress);
  const field = trimmed(body.fieldNumber);
  if (!partial || location !== undefined) fields.location = location ?? null;
  if (!partial || address !== undefined) fields.locationAddress = address ?? null;
  if (!partial || field !== undefined) fields.fieldNumber = field ?? null;
  if (withPlace && (!partial || body.placeId !== undefined)) {
    fields.placeId = (await resolvePlaceId(teamId, body.placeId ?? null)) ?? null;
    // A place picked on an edit that didn't mention the club venue still clears it: never both.
    if (fields.placeId && !spokeVenue) { fields.orgVenueId = null; fields.orgVenueFacilityId = null; }
  }
  return { ok: true, fields };
}
