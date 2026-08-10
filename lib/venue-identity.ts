/**
 * venue-identity.ts
 *
 * ONE answer to "are these two things on the same surface at the same time?"
 *
 * Why this module exists
 * ----------------------
 * Two engines used to answer that question independently and disagreed:
 *
 *   - `lib/schedule-metrics.ts` (the schedule-health panel) normalized free-text `location`
 *     and DID count typed-field clashes.
 *   - `lib/schedule-conflict.ts` (the save-time blocker + the list badges) skipped free text
 *     entirely, so the editor saved a double-booking in silence and showed no badge.
 *
 * Same schedule, two verdicts, and the silent one was the one attached to the Save button.
 * Both now resolve placement through here, so they cannot drift apart again. If you are adding
 * a third caller, call this — do not re-derive venue keys locally.
 *
 * Deliberately module-agnostic (owner ruling R3, 2026-08-08)
 * ---------------------------------------------------------
 * House league games and practices are getting the same venue model as tournament games, so
 * nothing here may know what a "tournament game" is. The input is a bag of optional venue
 * fields; anything carrying those fields can be placed and compared.
 *
 * What is deliberately NOT done here
 * ----------------------------------
 * - **No fuzzy matching.** Trim + case-fold only. "Diamond 1" and "Diamond One" are different
 *   surfaces as far as this module is concerned. A false clash that blocks a legitimate save is
 *   worse than a missed one.
 * - **Typed text never matches a structured reference.** A game typed as "Diamond 1" does not
 *   clash with a game pinned to the facility record named "Diamond 1". Deciding that the string
 *   names that record is the admin-reviewed job in Phase 3 — doing it silently here would move
 *   games onto fields nobody confirmed. This is a known, accepted gap; it is reported by the
 *   caller rather than guessed at.
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * The venue-ish fields any schedulable record may carry. Every field is optional: callers pass
 * what their table actually has, and anything absent simply lowers the resolved granularity.
 */
export interface VenuePlacementSource {
  /** The managed venue/park record (tournament games: `games.diamond_id`). */
  venueId?: string | null;
  /** The specific surface within that venue — the finest granularity available. */
  venueFacilityId?: string | null;
  /** A temporary generator lane, used before real venues exist. */
  scheduleFacilityLaneId?: string | null;
  /** The lane's human label, for draft lanes that have no id yet. */
  scheduleFacilityLaneLabel?: string | null;
  /** Free-text display string typed by an organizer. */
  location?: string | null;
}

/**
 * How precisely we know where this record is played, finest first.
 * `none` means the question cannot be answered at all — including placeholder text (see R2).
 */
export type VenuePlacementKind = 'facility' | 'venue' | 'lane' | 'text' | 'none';

export interface VenuePlacement {
  kind: VenuePlacementKind;
  /** Set only for `kind === 'facility'`. */
  facilityId: string | null;
  /** The parent venue when known — set for `venue`, and for `facility` when the row carries it. */
  venueId: string | null;
  /** Set only for `kind === 'lane'`. */
  laneKey: string | null;
  /** Normalized typed text — set only for `kind === 'text'`. */
  textKey: string | null;
}

const UNPLACED: VenuePlacement = {
  kind: 'none', facilityId: null, venueId: null, laneKey: null, textKey: null,
};

// ---------------------------------------------------------------------------
// Placeholder text (owner ruling R2, 2026-08-08)
// ---------------------------------------------------------------------------

/**
 * Strings that name no field at all. "TBD" is a promise to decide later, not a place — so two
 * unrelated TBD games must never look like they clash, and such a game is reported as unchecked
 * rather than quietly counted as located.
 *
 * Compared with every non-alphanumeric character stripped, so "T.B.D.", "(TBD)" and "tba" all
 * land here — as does a purely punctuation entry like "-" or "—", which strips to nothing.
 *
 * The list stays SHORT and unambiguous on purpose. Every entry is a word that cannot plausibly be
 * the name of a real playing surface, because the cost of a wrong guess falls on the wrong side:
 * two unrelated games sharing a "no venue yet" marker would be reported as a double-booking, and
 * a false clash that blocks legitimate work is worse than a missed one. Do not add anything here
 * that a field could actually be called.
 */
const PLACEHOLDER_LOCATIONS = new Set(['tbd', 'tba', 'na', 'none', 'unknown', 'nil', 'null']);

export function isPlaceholderLocation(value: string | null | undefined): boolean {
  if (!value) return false;
  const stripped = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Pure punctuation ("-", "--", "/") names nothing either.
  if (!stripped) return true;
  return PLACEHOLDER_LOCATIONS.has(stripped);
}

/** Trim + case-fold. The whole of our text normalization — see "no fuzzy matching" above. */
export function normalizeLocationText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (isPlaceholderLocation(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * A stable `text:`-prefixed key for a typed-only location, or null when the text names no
 * place at all (empty / placeholder). The scorekeeper field filter builds its synthetic
 * entries with this on the server and matches them with this on the client — one builder,
 * so the two sides cannot drift.
 */
export function typedLocationKey(value: string | null | undefined): string | null {
  const token = normalizeLocationText(value);
  return token ? `text:${token}` : null;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * A lane only counts while no real venue has been resolved onto the row. Once lane resolution
 * back-fills the venue and facility, the structured reference is the truth and the lane id is
 * just residue.
 */
function resolveLaneKey(source: VenuePlacementSource): string | null {
  if (source.venueId || source.venueFacilityId) return null;
  if (source.scheduleFacilityLaneId) return `lane:${source.scheduleFacilityLaneId}`;
  const label = source.scheduleFacilityLaneLabel?.trim();
  return label ? `lane-label:${label.toLowerCase()}` : null;
}

/** Resolve a row's placement at the finest granularity it actually carries. */
export function resolveVenuePlacement(source: VenuePlacementSource | null | undefined): VenuePlacement {
  if (!source) return UNPLACED;

  const venueId = source.venueId || null;

  if (source.venueFacilityId) {
    return { kind: 'facility', facilityId: source.venueFacilityId, venueId, laneKey: null, textKey: null };
  }
  if (venueId) {
    return { kind: 'venue', facilityId: null, venueId, laneKey: null, textKey: null };
  }
  const laneKey = resolveLaneKey(source);
  if (laneKey) {
    return { kind: 'lane', facilityId: null, venueId: null, laneKey, textKey: null };
  }
  const textKey = normalizeLocationText(source.location);
  if (textKey) {
    return { kind: 'text', facilityId: null, venueId: null, laneKey: null, textKey };
  }
  return UNPLACED;
}

/** True when we know where this is played well enough to check it against anything. */
export function isPlaced(placement: VenuePlacement): boolean {
  return placement.kind !== 'none';
}

/** Convenience: resolve and test in one step. */
export function hasKnownPlacement(source: VenuePlacementSource | null | undefined): boolean {
  return isPlaced(resolveVenuePlacement(source));
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Could these two records be occupying the same physical surface?
 *
 * Compared at the **coarsest granularity both sides actually specify** — which is the fix for a
 * blind spot both engines used to share. Previously a game pinned to a surface and a game
 * recorded only against that surface's parent venue never compared: the first demanded an exact
 * facility match, the second demanded the other side have no facility at all. Two games genuinely
 * on the same diamond passed each other unseen.
 *
 * Rules:
 *   facility vs facility → same facility id
 *   facility vs venue    → same PARENT venue id (the venue-only game might be on that surface)
 *   venue vs venue       → same venue id
 *   lane vs lane         → same lane
 *   text vs text         → same normalized text
 *   anything vs `none`   → false (nothing to compare)
 *   text vs structured   → false (see the module header — Phase 3's job, not a guess)
 *
 * Conservative by design: where the data cannot prove two rows share a surface, this returns
 * false rather than inventing a clash. A facility with an unknown parent venue compared against
 * a venue-only row is the one real case — rare in practice, since a surface row always has a
 * parent in the database.
 */
export function placementsShareSurface(a: VenuePlacement, b: VenuePlacement): boolean {
  if (!isPlaced(a) || !isPlaced(b)) return false;

  const aStructured = a.kind === 'facility' || a.kind === 'venue';
  const bStructured = b.kind === 'facility' || b.kind === 'venue';

  if (aStructured && bStructured) {
    // Both pin a specific surface → only the same surface clashes. Two different diamonds in
    // one park are not a conflict.
    if (a.facilityId && b.facilityId) return a.facilityId === b.facilityId;
    // Mixed granularity → fall back to the level both sides share.
    if (a.venueId && b.venueId) return a.venueId === b.venueId;
    return false;
  }

  if (a.kind === 'lane' && b.kind === 'lane') return a.laneKey === b.laneKey;
  if (a.kind === 'text' && b.kind === 'text') return a.textKey === b.textKey;

  return false;
}

/** Resolve both sides and compare — the common case for callers holding raw rows. */
export function sourcesShareSurface(
  a: VenuePlacementSource | null | undefined,
  b: VenuePlacementSource | null | undefined,
): boolean {
  return placementsShareSurface(resolveVenuePlacement(a), resolveVenuePlacement(b));
}

// ---------------------------------------------------------------------------
// Grouping keys (movement metrics — "did this team change venue between games?")
// ---------------------------------------------------------------------------

/**
 * A stable key for "which venue is this at", for counting a team's venue changes across a day.
 * Null when unknown — an unknown placement must not be counted as a move, because we cannot
 * tell whether the team actually went anywhere.
 */
export function venueGroupKey(placement: VenuePlacement): string | null {
  if (placement.venueId) return `venue:${placement.venueId}`;
  if (placement.laneKey) return placement.laneKey;
  if (placement.textKey) return `text:${placement.textKey}`;
  return null;
}

/** As above, one level finer: the specific surface where we know it. */
export function facilityGroupKey(placement: VenuePlacement): string | null {
  if (placement.facilityId) return `facility:${placement.facilityId}`;
  if (placement.laneKey) return placement.laneKey;
  return venueGroupKey(placement);
}
