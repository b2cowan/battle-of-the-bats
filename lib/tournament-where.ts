/**
 * THE TOURNAMENT ON THE ONE VENUE FIELD (Tournament admin redesign Stage 3, S2 — "Venue + Diamond is the club's field",
 * Club Tier Stage 6a, Ask 13, worn as built). Pure: the game window and a unit test read the same rules.
 *
 * The field speaks venues and their facilities. A tournament's own venues (`diamonds`, each with its facilities) are
 * offered as the field's program venues — "This tournament's venues", then typed words — and a game reads back into the
 * field and writes out of it here:
 *   · a picked venue → the game's `venueId` + `venueFacilityId` (the server derives the display words from them);
 *   · typed words → the game's `location`, the typed diamond joined the house way ("Lions Park — Diamond 2");
 *   · nothing → no place yet.
 * The quiet line under Venue says where a picked venue came from, in the tournament's words (specimen 7): a copy of
 * the club's library venue, or one added in this tournament.
 */
import type { ClubVenueOption, Game, Venue } from './types';
import { EMPTY_WHERE, type WhereValue } from './where-field.ts';
import { formatVenueLocation } from './venue-label.ts';

/** The tournament's venues as the field's options (its facilities, in their order). */
export function tournamentVenueOptions(venues: readonly Venue[]): ClubVenueOption[] {
  return venues.map(v => ({
    id: v.id,
    name: v.name,
    address: v.address?.trim() || null,
    facilities: (v.facilities ?? []).map(f => ({ id: f.id, name: f.name })),
  }));
}

/** A game's place, read back into the field. */
export function whereOfGame(g: Pick<Game, 'venueId' | 'venueFacilityId' | 'location'>, venues: readonly Venue[]): WhereValue {
  if (g.venueId) {
    const venue = venues.find(v => v.id === g.venueId);
    const facility = g.venueFacilityId ? venue?.facilities?.find(f => f.id === g.venueFacilityId) : undefined;
    return {
      ...EMPTY_WHERE,
      source: 'club',
      location: venue?.name ?? g.location ?? '',
      locationAddress: venue?.address ?? '',
      fieldNumber: facility?.name ?? '',
      orgVenueId: g.venueId,
      orgVenueFacilityId: g.venueFacilityId ?? null,
    };
  }
  const text = (g.location ?? '').trim();
  return text ? { ...EMPTY_WHERE, source: 'typed', location: text } : { ...EMPTY_WHERE };
}

/** The field's value as the games route takes it: a picked venue's ids, or the typed words, or nothing. */
export function placeOfWhere(w: WhereValue): { venueId: string | null; venueFacilityId: string | null; location: string | null } {
  if (w.source === 'club' && w.orgVenueId) return { venueId: w.orgVenueId, venueFacilityId: w.orgVenueFacilityId, location: null };
  const text = w.location.trim();
  if (!text) return { venueId: null, venueFacilityId: null, location: null };
  return { venueId: null, venueFacilityId: null, location: formatVenueLocation(text, w.fieldNumber.trim() || null) };
}

/** Two places are the same place (a move is a change of day, time or place — a re-pick of the same diamond is not). */
export function samePlace(a: WhereValue, b: WhereValue): boolean {
  const x = placeOfWhere(a), y = placeOfWhere(b);
  return x.venueId === y.venueId && x.venueFacilityId === y.venueFacilityId && (x.location ?? '') === (y.location ?? '');
}

/** The quiet line under Venue: where a picked venue came from (specimen 7's tournament line), and its address. */
export function tournamentSourceLine(w: WhereValue, venues: readonly Venue[], words: { library: string; tournament: string }): string {
  if (w.source !== 'club' || !w.orgVenueId) return '';
  const venue = venues.find(v => v.id === w.orgVenueId);
  return [venue?.sourceOrgVenueId ? words.library : words.tournament, w.locationAddress.trim()].filter(Boolean).join(' · ');
}
