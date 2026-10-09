/**
 * where-field.ts — the one Venue field's pure rules (Club Tier Stage 6a, Ask 13, ratified 2026-10-08). Client-safe;
 * the shared field (`components/venue/WhereField.tsx`), the import and the fixture read the same rules.
 *
 * The field is two fields, the same on every form: **Venue** (a search box whose list is grouped — the program's
 * venues, then a coach's own places, then the typed row) and **the facility under the sport's own word** (the
 * picked venue's facilities with "Not set" first; a short typed box for a typed venue or a coach's own place).
 * Only what the Venue list offers differs by program. The address belongs to the venue, never typed on an event.
 */
import { surfaceLabel } from './sports.ts';
import { filterPlaces, placeKey } from './coach-places.ts';
import { VENUE_FACILITY_SEPARATOR, formatVenueLocation } from './venue-label.ts';
import type { ClubVenueOption, OrgVenue, RepTeamPlace } from './types';

/** Where a booking is, as the field holds it. `source` says which book the venue came from. */
export interface WhereValue {
  /** 'club' = one of the club's venues · 'place' = the team's own place · 'typed' = words · null = nothing yet. */
  source: 'club' | 'place' | 'typed' | null;
  /** The venue's name (the booking's `location` copy). */
  location: string;
  /** The venue's or place's address — shown under the field, never typed on an event. */
  locationAddress: string;
  /** The facility: a club facility's name, or the typed box's words. */
  fieldNumber: string;
  placeId: string | null;
  orgVenueId: string | null;
  orgVenueFacilityId: string | null;
}

export const EMPTY_WHERE: WhereValue = {
  source: null, location: '', locationAddress: '', fieldNumber: '', placeId: null, orgVenueId: null, orgVenueFacilityId: null,
};

/** A stored booking's where, read back into the field. */
export function whereOf(e: {
  location?: string | null; locationAddress?: string | null; fieldNumber?: string | null;
  placeId?: string | null; orgVenueId?: string | null; orgVenueFacilityId?: string | null;
}): WhereValue {
  const location = e.location ?? '';
  return {
    source: e.orgVenueId ? 'club' : e.placeId ? 'place' : location.trim() ? 'typed' : null,
    location,
    locationAddress: e.locationAddress ?? '',
    fieldNumber: e.fieldNumber ?? '',
    placeId: e.placeId ?? null,
    orgVenueId: e.orgVenueId ?? null,
    orgVenueFacilityId: e.orgVenueFacilityId ?? null,
  };
}

/** The field's value as a write sends it — the server proves the links and copies a club venue's own words. */
export function whereBody(w: WhereValue): {
  location: string | null; locationAddress: string | null; fieldNumber: string | null;
  placeId: string | null; orgVenueId: string | null; orgVenueFacilityId: string | null;
} {
  return {
    location: w.location.trim() || null,
    locationAddress: w.locationAddress.trim() || null,
    fieldNumber: w.fieldNumber.trim() || null,
    placeId: w.source === 'place' ? w.placeId : null,
    orgVenueId: w.source === 'club' ? w.orgVenueId : null,
    orgVenueFacilityId: w.source === 'club' ? w.orgVenueFacilityId : null,
  };
}

/** Picking one of the club's venues: its name and address come with it, and its facility opens on the usual one. */
export function pickClubVenue(venue: ClubVenueOption, usualFacilityId?: string | null): WhereValue {
  const fac = usualFacilityId ? venue.facilities.find(f => f.id === usualFacilityId) ?? null : null;
  return {
    source: 'club',
    location: venue.name,
    locationAddress: venue.address ?? '',
    fieldNumber: fac?.name ?? '',
    placeId: null,
    orgVenueId: venue.id,
    orgVenueFacilityId: fac?.id ?? null,
  };
}

/** Picking a club facility ("Not set" = null). */
export function pickClubFacility(w: WhereValue, venue: ClubVenueOption | null, facilityId: string | null): WhereValue {
  const fac = facilityId && venue ? venue.facilities.find(f => f.id === facilityId) ?? null : null;
  return { ...w, orgVenueFacilityId: fac?.id ?? null, fieldNumber: fac?.name ?? '' };
}

/**
 * Picking one of the team's own places (Arrival & Places D8): its name and address, and its usual field ONLY when
 * the booking has none yet (a park has six diamonds; a field the coach already typed wins).
 */
export function pickPlace(w: WhereValue, place: Pick<RepTeamPlace, 'id' | 'name' | 'address' | 'fieldNumber'>): WhereValue {
  return {
    source: 'place',
    location: place.name,
    locationAddress: place.address ?? '',
    fieldNumber: w.source !== 'club' && w.fieldNumber.trim() ? w.fieldNumber : (place.fieldNumber ?? ''),
    placeId: place.id,
    orgVenueId: null,
    orgVenueFacilityId: null,
  };
}

/**
 * Typing in Venue. Typing over a picked venue or place detaches it, and its address (it belonged to the old one);
 * a typed facility stays (it is this booking's own), a club facility does not (it belonged to that venue).
 */
export function typeVenue(w: WhereValue, text: string): WhereValue {
  const stillPicked = w.source === 'club' || w.source === 'place'
    ? text.trim().toLowerCase() === w.location.trim().toLowerCase()
    : false;
  if (stillPicked) return { ...w, location: text };
  return {
    source: text.trim() ? 'typed' : null,
    location: text,
    locationAddress: w.source === 'typed' || w.source === null ? w.locationAddress : '',
    fieldNumber: w.source === 'club' ? '' : w.fieldNumber,
    placeId: null,
    orgVenueId: null,
    orgVenueFacilityId: null,
  };
}

/**
 * What the Venue list offers, by group, for what is typed: the club's venues first — ONLY in a club with a Venue
 * library (a team outside a club sees exactly the picker as built: its own places) — then the team's own places.
 * Eight of each at most, as the built picker shows.
 */
export function venueListGroups<P extends Pick<RepTeamPlace, 'name' | 'address'>>(opts: {
  inClub: boolean;
  clubVenues: readonly ClubVenueOption[];
  places?: readonly P[];
  query: string;
}): { venues: ClubVenueOption[]; places: P[] } {
  // One search rule for both groups — the place book's (name or address, trim + case-fold).
  const venues = opts.inClub ? filterPlaces(opts.clubVenues, opts.query).slice(0, 8) : [];
  const places = opts.places ? filterPlaces(opts.places, opts.query).slice(0, 8) : [];
  return { venues, places };
}

/**
 * An imported row's location IS one of the club's venues by name (exact after trim + case-fold — a prefix is a
 * suggestion, not a match), and its field cell picks a facility by name: "Diamond 2", or a bare "2" read with the
 * sport's noun. A field that names none of the venue's facilities leaves the facility unset ("busy then").
 */
export function matchClubVenue(
  venues: readonly ClubVenueOption[], location: string | null | undefined, field: string | null | undefined, sport: string | null | undefined,
): { venue: ClubVenueOption; facility: { id: string; name: string } | null } | null {
  const key = location ? placeKey(location) : '';
  if (!key) return null;
  const venue = venues.find(v => placeKey(v.name) === key);
  if (!venue) return null;
  const f = field?.trim() ?? '';
  if (!f) return { venue, facility: null };
  const said = placeKey(surfaceLabel(sport, f) || f);
  const facility = venue.facilities.find(x => placeKey(x.name) === placeKey(f) || placeKey(surfaceLabel(sport, x.name) || x.name) === said) ?? null;
  return { venue, facility };
}

// ---------------------------------------------------------------------------
// Programs whose bookings point at the library directly (house league)
// ---------------------------------------------------------------------------

/** The org library as the Venue field offers it: active venues, their facilities in the club's order. */
export function clubVenueOptions(venues: readonly OrgVenue[]): ClubVenueOption[] {
  return venues
    .filter(v => v.isActive !== false)
    .map(v => ({
      id: v.id,
      name: v.name,
      address: v.address ?? null,
      facilities: [...(v.facilities ?? [])].sort((a, b) => a.displayOrder - b.displayOrder).map(f => ({ id: f.id, name: f.name })),
    }));
}

/**
 * A booking that holds library links and ONE line of text (house league's games and practices), read back into the
 * field: its venue and facility named from the library, or its whole typed line in Venue.
 */
export function whereOfLibraryRow(
  row: { orgVenueId?: string | null; orgVenueFacilityId?: string | null; location?: string | null } | null,
  venues: readonly ClubVenueOption[],
): WhereValue {
  if (!row) return EMPTY_WHERE;
  if (row.orgVenueId) {
    const v = venues.find(x => x.id === row.orgVenueId);
    if (!v) {
      // ⚠ A VENUE THE LIST DOESN'T CARRY — an ARCHIVED one (Club Tier 6b, Ask 9: archived venues leave every picker and
      // keep every booking). Read the booking's own words back, "Venue — Facility" split at its one separator, and keep
      // BOTH links: rebuilding it from the list would leave the facility unset, and the next save would drop the link.
      const line = row.location ?? '';
      const at = row.orgVenueFacilityId ? line.lastIndexOf(VENUE_FACILITY_SEPARATOR) : -1;
      return {
        source: 'club', location: at > 0 ? line.slice(0, at) : line, locationAddress: '',
        fieldNumber: at > 0 ? line.slice(at + VENUE_FACILITY_SEPARATOR.length) : '',
        placeId: null, orgVenueId: row.orgVenueId, orgVenueFacilityId: row.orgVenueFacilityId ?? null,
      };
    }
    const f = v.facilities.find(x => x.id === row.orgVenueFacilityId) ?? null;
    return {
      source: 'club', location: v.name, locationAddress: v.address ?? '',
      fieldNumber: f?.name ?? '', placeId: null, orgVenueId: row.orgVenueId, orgVenueFacilityId: f?.id ?? null,
    };
  }
  const text = row.location ?? '';
  return { ...EMPTY_WHERE, source: text.trim() ? 'typed' : null, location: text };
}

/**
 * The field → a program that keeps ONE line of text beside its library links (house league). It differs from
 * `whereBody` on purpose: a club venue sends its links and the server derives the words; typed words send one line,
 * "Venue — Facility" when a facility was typed, because that program has no separate facility column.
 */
export function whereLibraryBody(w: WhereValue): { orgVenueId: string | null; orgVenueFacilityId: string | null; location: string | null } {
  if (w.source === 'club' && w.orgVenueId) return { orgVenueId: w.orgVenueId, orgVenueFacilityId: w.orgVenueFacilityId, location: null };
  const text = w.location.trim();
  return { orgVenueId: null, orgVenueFacilityId: null, location: text ? formatVenueLocation(text, w.fieldNumber.trim() || null) : null };
}
