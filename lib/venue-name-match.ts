/**
 * venue-name-match.ts (pure — no database, unit-testable)
 *
 * ONE answer to "does this typed string name one of this tournament's fields?"
 *
 * Why this module exists
 * ----------------------
 * `lib/venue-identity.ts` is deliberate about NEVER letting typed text match a structured
 * reference on its own — a silent match would move real games onto fields nobody confirmed.
 * But there are two places where deciding that a string names a record is legitimate, because
 * a human sees the result before it becomes truth:
 *
 *   - the schedule importer's bare `Location` cell (Phase 2) — reported in the preview first;
 *   - the Phase 3 resolve screen — an admin confirms every match by hand.
 *
 * Both must use the SAME rule. Phase 2 shipped the rule inside the importer; Phase 3 shares it
 * from here rather than growing a second, subtly different matcher. (A drifting second copy is
 * exactly the class of bug this whole project exists to end — see the `venue-identity` header.)
 *
 * The rule, in full
 * -----------------
 * - Trim + case-fold + flatten punctuation via `normalizeToken`, so a legacy
 *   "Lions Park - Diamond 1" and the live "Lions Park — Diamond 1" read as the same string.
 * - A string may name a venue, a facility, or the combined "Venue - Facility" label.
 * - **Exact only. No fuzzy matching** — "Field 1" never resolves to "diamond #1". A false match
 *   moves a real game to the wrong field, which is the worst outcome this project recognizes.
 * - **Ambiguous means no match.** If a name reaches two different records (a venue and a
 *   facility of the same name, say), the caller is told it is ambiguous and a human picks.
 * - **Placeholder text is not a failed match** — "TBD" names no field, so it is `none`, and
 *   callers must not offer it as something to convert (owner ruling R2).
 *
 * Matching never crosses a tournament: the index is built from one tournament's catalog.
 *
 * Generic over the caller's own record types on purpose: the importer needs the venue and
 * facility NAMES back (it renders them into the preview), so an id-only result would force it to
 * look the records up again immediately after this module had them in hand.
 */

import { normalizeToken } from './normalize-token.ts';
import { isPlaceholderLocation } from './venue-identity.ts';

/** The minimum this module needs to know about a venue and one of its surfaces. */
export interface VenueNameVenue {
  id: string;
  name: string;
}
export interface VenueNameFacility {
  id: string;
  venueId: string;
  name: string;
}

/** What a typed name resolved to. `facility: null` means the venue itself. */
export interface VenueNameTarget<V extends VenueNameVenue, F extends VenueNameFacility> {
  venue: V;
  facility: F | null;
}

export type VenueNameIndex<
  V extends VenueNameVenue = VenueNameVenue,
  F extends VenueNameFacility = VenueNameFacility,
> = Map<string, VenueNameTarget<V, F>[]>;

export interface VenueNameCatalog<
  V extends VenueNameVenue = VenueNameVenue,
  F extends VenueNameFacility = VenueNameFacility,
> {
  venues: readonly V[];
  facilities: readonly F[];
}

export type VenueNameMatch<V extends VenueNameVenue, F extends VenueNameFacility> =
  | { kind: 'matched'; target: VenueNameTarget<V, F> }
  /** The text names no field at all — empty, or a placeholder like "TBD". Not a failed match. */
  | { kind: 'none' }
  /** A real name that reaches nothing in this tournament. */
  | { kind: 'unmatched' }
  /** A real name that reaches more than one record. A human decides. */
  | { kind: 'ambiguous'; targets: VenueNameTarget<V, F>[] };

/**
 * The normalization the MATCHING rule uses. Exported because callers sometimes need to ask a
 * related question ("would adding this name collide with one already in use?") and must ask it
 * with the same rule the matcher will apply, or they will permit a collision the matcher then
 * reports as ambiguous forever.
 */
export function normalizeVenueNameToken(value: string | null | undefined): string {
  return value ? normalizeToken(value) : '';
}

/**
 * Build the lookup once per tournament. Callers with many strings to resolve (a 1500-row upload,
 * or a whole schedule's distinct names) must not re-tokenize the catalog per string.
 */
export function buildVenueNameIndex<V extends VenueNameVenue, F extends VenueNameFacility>(
  catalog: VenueNameCatalog<V, F>,
): VenueNameIndex<V, F> {
  const index: VenueNameIndex<V, F> = new Map();
  const venueById = new Map(catalog.venues.map(venue => [venue.id, venue]));

  const add = (token: string, target: VenueNameTarget<V, F>) => {
    if (!token) return;
    const list = index.get(token) ?? [];
    // The same record reached by two spellings of the same token is one candidate, not two.
    const key = `${target.venue.id}:${target.facility?.id ?? ''}`;
    if (!list.some(item => `${item.venue.id}:${item.facility?.id ?? ''}` === key)) list.push(target);
    index.set(token, list);
  };

  for (const venue of catalog.venues) {
    add(normalizeToken(venue.name), { venue, facility: null });
  }
  for (const facility of catalog.facilities) {
    const venue = venueById.get(facility.venueId);
    // A facility whose parent is outside this catalog cannot be addressed by name here.
    if (!venue) continue;
    const target: VenueNameTarget<V, F> = { venue, facility };
    add(normalizeToken(facility.name), target);
    add(normalizeToken(`${venue.name} - ${facility.name}`), target);
  }

  return index;
}

/** Resolve one typed string against the index. See the module header for the full rule. */
export function matchVenueName<V extends VenueNameVenue, F extends VenueNameFacility>(
  text: string | null | undefined,
  index: VenueNameIndex<V, F>,
): VenueNameMatch<V, F> {
  if (!text) return { kind: 'none' };
  const token = normalizeToken(text);
  if (!token || isPlaceholderLocation(text)) return { kind: 'none' };

  const targets = index.get(token) ?? [];
  if (targets.length === 1) return { kind: 'matched', target: targets[0] };
  if (targets.length === 0) return { kind: 'unmatched' };
  return { kind: 'ambiguous', targets };
}
