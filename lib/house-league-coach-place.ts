import { fieldPartName, sectionsOf, type FieldSections } from './field-parts';
import type { GameFaceFields } from './league-game-changes';

/**
 * A house-league game's place as the coach's page, the coach's calendar and the family pages say it (pure: no database, so
 * the test holds it). The club's names for the venue and the field, with the part the game holds worded at read time from
 * (mask, how the field splits) — "Maple Grove Park · Diamond 2, side A" (Club schedules Stage 2, 2E part 2). A whole field,
 * or a field that is not split, reads exactly as before parts: "Maple Grove Park · Diamond 2". A game with no venue of the
 * club's reads its typed place.
 */
export interface PlaceNames {
  venues: ReadonlyMap<string, { name: string }>;
  facilities: ReadonlyMap<string, string>;
  /** How each field splits; a field absent here is whole. */
  sections: ReadonlyMap<string, FieldSections>;
}

export function placeNamer(places: PlaceNames) {
  return (g: Pick<GameFaceFields, 'orgVenueId' | 'orgVenueFacilityId' | 'location' | 'sectionMask'>): string | null => {
    const venue = g.orgVenueId ? places.venues.get(g.orgVenueId)?.name : null;
    if (!venue) return g.location || null;
    const facility = g.orgVenueFacilityId ? places.facilities.get(g.orgVenueFacilityId) : null;
    if (!facility) return venue;
    const sections = sectionsOf(places.sections.get(g.orgVenueFacilityId!));
    // dot-join-ok: the one place word, park · field (two items), as before parts; the part joins the field with a comma.
    return `${venue} · ${fieldPartName(facility, g.sectionMask, sections, ', ')}`;
  };
}
