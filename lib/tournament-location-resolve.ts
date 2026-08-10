/**
 * tournament-location-resolve.ts (pure — no database, unit-testable, safe on the client)
 *
 * Phase 3 of "game location — one source of truth": the rules behind the admin review screen
 * that turns hand-typed field names into real references.
 *
 * The screen's whole premise is that the unit of work is a NAME, not a game. "Diamond 1" is one
 * decision that moves 39 games, so this module groups a tournament's games into:
 *
 *   - `typedGroups`   — one per distinct typed name still awaiting a decision, with an exact-match
 *                       suggestion where one exists (via `lib/venue-name-match.ts`, shared with
 *                       the importer so the two can never disagree);
 *   - `linkedGroups`  — one per field games already point at. NOT busywork: it is what makes a
 *                       wrong pick recoverable after the session's undo is gone, because a whole
 *                       group can be re-pointed in one action (owner decision 2026-08-10).
 *
 * Classification is NOT re-derived here — `resolveVenuePlacement` from `lib/venue-identity.ts`
 * decides what each game carries, which is the module that owns that question and whose header
 * explicitly asks new callers to use it rather than branch locally. This module adds only what
 * that module cannot know: the catalog (to name a surface's parent venue, and to render labels).
 *
 * Two exclusions are enforced here rather than in the UI, so no caller can forget them:
 *
 *   - **Placeholder text names no field** (owner ruling R2). "TBD" is a promise to decide later.
 *     It must never be offered as something convertible, or the screen would invite an admin to
 *     turn "TBD" into a diamond called TBD.
 *   - **Lane-tethered games belong to the Resolve Temporary Facilities panel.** Phase 2 made an
 *     explicit venue pick DETACH a game from its generator lane; doing that wholesale from here
 *     would silently dismantle a draft schedule the organizer is still working on.
 *
 * Every status is included, completed games among them (owner decision 2026-08-10). Location is
 * display-only for a played game, but leaving them out would leave the history wrong AND leave a
 * group permanently half-converted, so the screen could never reach empty.
 */

import { formatVenueLocation } from './venue-label.ts';
import { isPlaceholderLocation, resolveVenuePlacement } from './venue-identity.ts';
import {
  buildVenueNameIndex,
  matchVenueName,
  normalizeVenueNameToken,
  type VenueNameCatalog,
} from './venue-name-match.ts';

/**
 * The venue-ish columns this module needs off a game row. Optional-and-nullable throughout so the
 * same function serves a server row (absent columns come back as `null`) and the client's `Game`
 * (absent columns are `undefined`) — the whole point of the module being pure is that both sides
 * can build the identical plan.
 */
export interface ResolveGameRow {
  id: string;
  location?: string | null;
  venueId?: string | null;
  venueFacilityId?: string | null;
  scheduleFacilityLaneId?: string | null;
  status?: string | null;
}

/** Which record a typed name should become. */
export interface ResolveTarget {
  venueId: string;
  facilityId: string | null;
}

export type TypedGroupMatch = 'exact' | 'ambiguous' | 'unmatched';

export interface TypedLocationGroup {
  /** Normalized key — the stable identity a client sends back when applying. */
  token: string;
  /** The spelling to show: the most-used exact wording, ties broken alphabetically. */
  name: string;
  gameIds: string[];
  gameCount: number;
  /** Games already played. Surfaced so the admin knows what a conversion is touching. */
  completedCount: number;
  match: TypedGroupMatch;
  /** Set only when `match === 'exact'`. */
  suggestion: ResolveTarget | null;
  /** Set only when `match === 'ambiguous'` — what the name could have meant. */
  ambiguousTargets: ResolveTarget[];
  /**
   * Venues that ALREADY have a surface with this exact name. The UI must not offer
   * "create it here" for those: a second "Diamond 1" in one park makes the name permanently
   * ambiguous, so the screen would be manufacturing the problem it exists to clear up.
   */
  existingAtVenueIds: string[];
}

export interface LinkedLocationGroup {
  /** `${venueId}:${facilityId ?? ''}` — the identity a client sends back to re-point a group. */
  key: string;
  venueId: string;
  venueFacilityId: string | null;
  /** Derived "Venue — Facility", never a stored string. */
  label: string;
  gameIds: string[];
  gameCount: number;
}

export interface LocationResolvePlan {
  typedGroups: TypedLocationGroup[];
  linkedGroups: LinkedLocationGroup[];
  /** Counts for the "not shown here" note — the screen explains its own exclusions. */
  excluded: {
    placeholderGames: number;
    laneGames: number;
  };
  /** Drives the zero-venue variant of the row (create is the only real option). */
  hasVenues: boolean;
  /** Total games behind `typedGroups` — the banner's headline number. */
  typedGameCount: number;
}

export function linkedGroupKey(venueId: string, facilityId: string | null): string {
  return `${venueId}:${facilityId ?? ''}`;
}

export function buildLocationResolvePlan(
  games: readonly ResolveGameRow[],
  catalog: VenueNameCatalog,
): LocationResolvePlan {
  const index = buildVenueNameIndex(catalog);
  const venueById = new Map(catalog.venues.map(venue => [venue.id, venue]));
  const facilityById = new Map(catalog.facilities.map(facility => [facility.id, facility]));

  const typedByToken = new Map<string, {
    token: string;
    gameIds: string[];
    completedCount: number;
    spellings: Map<string, number>;
  }>();
  const linkedByKey = new Map<string, LinkedLocationGroup>();
  let placeholderGames = 0;
  let laneGames = 0;

  for (const game of games) {
    const placement = resolveVenuePlacement(game);

    if (placement.kind === 'facility' || placement.kind === 'venue') {
      // Already pointing at a real record. Group it by the surface it names, so the whole group
      // can be re-pointed later — the durable half of the undo story.
      const facility = placement.facilityId ? facilityById.get(placement.facilityId) ?? null : null;
      // `resolveVenuePlacement` reports the parent venue only when the row itself carried it; the
      // catalog is what fills that in for a surface-only game. That lookup is this module's job,
      // not the identity module's — it has no catalog to consult.
      const venueId = placement.venueId ?? facility?.venueId ?? null;
      const venue = venueId ? venueById.get(venueId) : undefined;
      // A reference we cannot resolve against this tournament's catalog is not addressable here;
      // offering to re-point it would write against a record we cannot even name.
      if (!venue) continue;
      if (placement.facilityId && !facility) continue;

      const key = linkedGroupKey(venue.id, facility?.id ?? null);
      const existing = linkedByKey.get(key);
      if (existing) {
        existing.gameIds.push(game.id);
        existing.gameCount += 1;
      } else {
        linkedByKey.set(key, {
          key,
          venueId: venue.id,
          venueFacilityId: facility?.id ?? null,
          label: formatVenueLocation(venue.name, facility?.name),
          gameIds: [game.id],
          gameCount: 1,
        });
      }
      continue;
    }

    if (placement.kind === 'lane') {
      laneGames += 1;
      continue;
    }

    if (placement.kind === 'none') {
      // A blank location is nothing to report — there is no decision to explain. Text that SAYS
      // "not decided yet" is worth naming, because an organizer who typed "TBD" on twelve games
      // should know why this screen is ignoring them. (`isPlaceholderLocation` also answers true
      // for whitespace, since it names no field either — hence the explicit non-blank test.)
      if (game.location?.trim() && isPlaceholderLocation(game.location)) placeholderGames += 1;
      continue;
    }

    // `placement.kind === 'text'`. Grouped by the MATCHER's normalization, deliberately not by
    // `placement.textKey`: the identity module normalizes conservatively (no punctuation
    // flattening) because it must never merge two placements a human has not reviewed. Here a
    // human reviews every row, and the question being asked is "which name is this?" — so
    // "Diamond-1" and "Diamond 1" must be ONE row. Grouping them differently while matching them
    // identically would show two rows suggesting the same field, and resolving one would leave
    // the other behind forever.
    const token = normalizeVenueNameToken(game.location);
    if (!token) continue;

    const spelling = game.location!.trim().replace(/\s+/g, ' ');
    const entry = typedByToken.get(token);
    if (entry) {
      entry.gameIds.push(game.id);
      if (game.status === 'completed') entry.completedCount += 1;
      entry.spellings.set(spelling, (entry.spellings.get(spelling) ?? 0) + 1);
    } else {
      typedByToken.set(token, {
        token,
        gameIds: [game.id],
        completedCount: game.status === 'completed' ? 1 : 0,
        spellings: new Map([[spelling, 1]]),
      });
    }
  }

  // Which venues already own a surface by each name — computed once, not per group, and keyed by
  // the matcher's normalization so "Diamond #1" is recognised as already taken by "diamond 1".
  const venuesByFacilityToken = new Map<string, string[]>();
  for (const facility of catalog.facilities) {
    const token = normalizeVenueNameToken(facility.name);
    if (!token) continue;
    const list = venuesByFacilityToken.get(token) ?? [];
    if (!list.includes(facility.venueId)) list.push(facility.venueId);
    venuesByFacilityToken.set(token, list);
  }

  const typedGroups: TypedLocationGroup[] = [...typedByToken.values()]
    .map(entry => {
      const name = pickSpelling(entry.spellings);
      const match = matchVenueName(name, index);
      return {
        token: entry.token,
        name,
        gameIds: entry.gameIds,
        gameCount: entry.gameIds.length,
        completedCount: entry.completedCount,
        match: (match.kind === 'matched' ? 'exact' : match.kind === 'ambiguous' ? 'ambiguous' : 'unmatched') as TypedGroupMatch,
        suggestion: match.kind === 'matched' ? asTarget(match.target) : null,
        ambiguousTargets: match.kind === 'ambiguous' ? match.targets.map(asTarget) : [],
        existingAtVenueIds: venuesByFacilityToken.get(entry.token) ?? [],
      };
    })
    // Most games first — the biggest cleanup is the one worth doing.
    .sort((a, b) => b.gameCount - a.gameCount || a.name.localeCompare(b.name));

  const linkedGroups = [...linkedByKey.values()].sort(
    (a, b) => b.gameCount - a.gameCount || a.label.localeCompare(b.label),
  );

  return {
    typedGroups,
    linkedGroups,
    excluded: { placeholderGames, laneGames },
    hasVenues: catalog.venues.length > 0,
    typedGameCount: typedGroups.reduce((total, group) => total + group.gameCount, 0),
  };
}

function asTarget(target: { venue: { id: string }; facility: { id: string } | null }): ResolveTarget {
  return { venueId: target.venue.id, facilityId: target.facility?.id ?? null };
}

/** Most-used wording wins; ties break by locale order so the label is stable across reloads. */
function pickSpelling(spellings: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [spelling, count] of spellings) {
    if (count > bestCount || (count === bestCount && spelling.localeCompare(best) < 0)) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}
