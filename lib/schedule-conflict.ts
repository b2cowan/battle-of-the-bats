/**
 * schedule-conflict.ts
 *
 * Pure client-side utilities for venue conflict detection during game scheduling.
 *
 * Design:
 * - Conflict detection runs entirely in the browser against already-loaded game data.
 * - Two conflict severities:
 *     'overlap'  — the proposed game window physically overlaps an existing game.
 *                  Save is BLOCKED; admin must pick a different time.
 *     'buffer'   — the proposed game starts before the required buffer has elapsed
 *                  but after the prior game ends. Save is ALLOWED with a warning.
 * - Cancelled games are excluded from all checks.
 * - Where two games are played is resolved by `lib/venue-identity.ts`, which is the single
 *   answer to "same surface?" shared with the schedule-health engine. Do not re-derive venue
 *   matching here — the two engines disagreeing is exactly the bug that module was created to
 *   end (typed field names were checked by health and silently ignored at save time).
 * - Games with NO usable location (nothing set, or placeholder text like "TBD") are still
 *   skipped — there is genuinely nothing to compare. Those are counted and reported to the
 *   organizer by the schedule-health engine rather than passing as "clean".
 */

import type { Division, Tournament } from '@/lib/types';
// Relative + explicit extension: this is a VALUE import, so it must resolve under the plain-node
// test runner too (the type-only import above is erased and never resolved at runtime).
import {
  resolveVenuePlacement,
  placementsShareSurface,
  isPlaced,
  type VenuePlacement,
} from './venue-identity.ts';
import { DEFAULT_BOOKING_MINUTES } from './booking-length.ts';

// ---------------------------------------------------------------------------
// Timing resolution
// ---------------------------------------------------------------------------

export interface GameTiming {
  durationMinutes: number;
  bufferMinutes: number;
}

export const SYSTEM_TIMING_DEFAULTS: GameTiming = {
  durationMinutes: DEFAULT_BOOKING_MINUTES,
  bufferMinutes: 15,
};

/**
 * Resolves effective game timing by cascading the DURATION:
 *   per-game override → division.settings → tournament.settings → SYSTEM_TIMING_DEFAULTS
 *
 * `gameDurationOverride` is a single game's own length (`game.durationMinutes`),
 * so playoff games, finals, etc. can run their own length and are validated
 * against it. Buffer cascades division → tournament → default (no per-game buffer).
 */
export function resolveGameTiming(
  division: Division | undefined | null,
  tournament: Tournament | undefined | null,
  gameDurationOverride?: number | null,
): GameTiming {
  const divS = division?.settings;
  const tourS = tournament?.settings;
  const pos = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined);
  const nonNeg = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : undefined);

  const durationMinutes =
    pos(gameDurationOverride) ??
    pos(divS?.game_duration_minutes) ??
    pos(tourS?.game_duration_minutes) ??
    SYSTEM_TIMING_DEFAULTS.durationMinutes;

  const bufferMinutes =
    nonNeg(divS?.buffer_minutes) ??
    nonNeg(tourS?.buffer_minutes) ??
    SYSTEM_TIMING_DEFAULTS.bufferMinutes;

  return { durationMinutes, bufferMinutes };
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/**
 * Converts "HH:MM" (or "H:MM") to minutes since midnight.
 * Returns NaN for invalid input.
 */
export function timeToMinutes(time: string): number {
  if (!time || typeof time !== 'string') return NaN;
  const parts = time.trim().split(':');
  if (parts.length < 2) return NaN;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

/**
 * Converts minutes since midnight to "HH:MM" (24-hour, zero-padded).
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export type ConflictKind = 'overlap' | 'buffer';

/** Minimal game shape needed for conflict checking. */
export interface ConflictGame {
  id: string;
  /** YYYY-MM-DD */
  gameDate?: string | null;
  /** HH:MM (24-hour) */
  startTime?: string | null;
  /** 'cancelled' games are excluded from all checks. */
  status?: string | null;
  venueId?: string | null;
  venueFacilityId?: string | null;
  scheduleFacilityLaneId?: string | null;
  /** Draft lanes carry a label before they have an id. */
  scheduleFacilityLaneLabel?: string | null;
  /**
   * Typed field name. Games located only by text are checked against each other — this is what
   * the editor used to ignore while the health panel counted it.
   */
  location?: string | null;
  /** Which division this game belongs to (for resolving timing). */
  divisionId?: string | null;
  /** This game's own length (minutes), if set — wins over the division/tournament default. */
  durationMinutes?: number | null;
}

/**
 * The one place a `Game` becomes a `ConflictGame`.
 *
 * Every screen that checks for clashes used to hand-write this object, and the field list drifted
 * the moment anything was added: the fix that taught this engine about typed field names had to be
 * pasted into seven separate literals, and one of them was missed. Route new call sites through
 * here so "the engine forgot to look at X" cannot be reintroduced one field at a time.
 */
export function toConflictGame(game: {
  id: string;
  date?: string | null;
  time?: string | null;
  status?: string | null;
  venueId?: string | null;
  venueFacilityId?: string | null;
  scheduleFacilityLaneId?: string | null;
  scheduleFacilityLaneLabel?: string | null;
  location?: string | null;
  divisionId?: string | null;
  durationMinutes?: number | null;
}): ConflictGame {
  return {
    id: game.id,
    gameDate: game.date ?? null,
    startTime: game.time ?? null,
    status: game.status ?? null,
    venueId: game.venueId ?? null,
    venueFacilityId: game.venueFacilityId ?? null,
    scheduleFacilityLaneId: game.scheduleFacilityLaneId ?? null,
    scheduleFacilityLaneLabel: game.scheduleFacilityLaneLabel ?? null,
    location: game.location ?? null,
    divisionId: game.divisionId ?? null,
    durationMinutes: game.durationMinutes ?? null,
  };
}

export interface ConflictResult {
  kind: ConflictKind;
  /** The existing game that conflicts with the proposed slot. */
  conflictingGame: ConflictGame;
  /** Human-readable name of the conflicting division (for the warning message). */
  conflictingDivisionName: string;
  /**
   * How the clashing surface was identified. The organizer gets no announcement that this check
   * exists (owner ruling R1), so the warning has to explain itself — 'text' means both games
   * carry the same typed field name rather than a picked field, which is worth saying plainly.
   */
  matchedOn: VenuePlacement['kind'];
  /** The earliest clean start time (after all existing games + their buffers) on the same date/venue. "HH:MM" */
  availableAt: string;
}

export interface CheckConflictParams {
  /** The game being scheduled or edited (null id = new game). */
  proposedGame: ConflictGame;
  /** All games in this tournament (including games from all divisions). */
  allGames: ConflictGame[];
  /** All divisions (used to resolve timing per division). */
  divisions: Division[];
  /** The tournament (used as the timing default source). */
  tournament: Tournament | null | undefined;
}

/**
 * Checks whether the proposed game slot conflicts with any existing game
 * at the same venue/facility on the same date.
 *
 * Returns null if:
 * - The proposed game has no usable location at all (nothing set, or placeholder text)
 * - The proposed game has no gameDate or startTime
 * - No conflict exists
 *
 * Returns a ConflictResult describing the most severe conflict found (overlap
 * takes priority over buffer).
 */
export function checkVenueConflict(params: CheckConflictParams): ConflictResult | null {
  return checkAgainstPlaced(
    params.proposedGame,
    resolveVenuePlacement(params.proposedGame),
    params.allGames.map(toPlacedGame),
    params.divisions,
    params.tournament,
  );
}

/** A game paired with its resolved placement, so a scan never re-resolves the same row. */
interface PlacedGame {
  game: ConflictGame;
  placement: VenuePlacement;
}

function toPlacedGame(game: ConflictGame): PlacedGame {
  return { game, placement: resolveVenuePlacement(game) };
}

/**
 * The real check. Takes placements already resolved so a full-schedule scan resolves each game
 * ONCE rather than once per comparison — `buildConflictMap` calls this n times over the same n
 * games, so re-resolving inside would make placement resolution quadratic.
 */
function checkAgainstPlaced(
  proposedGame: ConflictGame,
  proposedPlacement: VenuePlacement,
  allGames: PlacedGame[],
  divisions: Division[],
  tournament: Tournament | null | undefined,
): ConflictResult | null {
  // Nowhere to be → nothing to compare. Note this is now much narrower than it was: a typed
  // field name IS a placement, and does get checked.
  if (!isPlaced(proposedPlacement)) return null;
  if (!proposedGame.gameDate || !proposedGame.startTime) return null;

  const proposedStart = timeToMinutes(proposedGame.startTime);
  if (isNaN(proposedStart)) return null;

  // Resolve the proposed game's own timing (based on its division).
  const proposedDivision = divisions.find(d => d.id === proposedGame.divisionId);
  const proposedTiming = resolveGameTiming(proposedDivision, tournament, proposedGame.durationMinutes);
  const proposedEnd = proposedStart + proposedTiming.durationMinutes;

  // Find all games at the same venue/facility on the same date, excluding:
  // - the game being edited (same id)
  // - cancelled games
  const candidates = allGames.filter(({ game: g, placement }) => {
    if (g.id === proposedGame.id) return false;
    if (g.status === 'cancelled') return false;
    if (g.gameDate !== proposedGame.gameDate) return false;

    // One shared answer to "same surface?" — compared at the coarsest granularity both games
    // specify, so a surface-pinned game and a venue-only game on that same venue now compare
    // (they used to pass each other unseen).
    return placementsShareSurface(proposedPlacement, placement);
  }).map(placed => placed.game);

  if (candidates.length === 0) return null;

  let worstOverlap: ConflictGame | null = null;
  let worstBuffer: ConflictGame | null = null;

  for (const existing of candidates) {
    if (!existing.startTime) continue;
    const exStart = timeToMinutes(existing.startTime);
    if (isNaN(exStart)) continue;

    // Resolve the existing game's timing (from its own division).
    const exDivision = divisions.find(d => d.id === existing.divisionId);
    const exTiming = resolveGameTiming(exDivision, tournament, existing.durationMinutes);
    const exEnd = exStart + exTiming.durationMinutes;

    // Hard overlap: windows physically intersect.
    // Proposed starts before existing ends AND proposed ends after existing starts.
    const overlaps = proposedStart < exEnd && proposedEnd > exStart;
    if (overlaps) {
      worstOverlap = existing;
      break; // overlap is the worst severity; no need to keep looking
    }

    // Buffer zone: proposed starts before buffer has cleared.
    // Check both directions (existing ends + buffer, and proposed ends + buffer).
    const afterExisting = proposedStart < exEnd + exTiming.bufferMinutes && proposedStart >= exEnd;
    const beforeExisting = proposedEnd > exStart - proposedTiming.bufferMinutes && proposedEnd <= exStart;
    if (afterExisting || beforeExisting) {
      worstBuffer = existing;
    }
  }

  const conflictingGame = worstOverlap ?? worstBuffer;
  if (!conflictingGame) return null;

  const kind: ConflictKind = worstOverlap ? 'overlap' : 'buffer';

  // Resolve division name for display.
  const conflictingDivision = divisions.find(d => d.id === conflictingGame.divisionId);
  const conflictingDivisionName = conflictingDivision?.name ?? 'Unknown Division';

  // Calculate the earliest clean available slot:
  // Find the latest game end + buffer at this venue on this date.
  const latestClear = candidates.reduce((max, g) => {
    if (!g.startTime) return max;
    const gStart = timeToMinutes(g.startTime);
    if (isNaN(gStart)) return max;
    const gDiv = divisions.find(d => d.id === g.divisionId);
    const gTiming = resolveGameTiming(gDiv, tournament, g.durationMinutes);
    return Math.max(max, gStart + gTiming.durationMinutes + gTiming.bufferMinutes);
  }, 0);

  return {
    kind,
    conflictingGame,
    conflictingDivisionName,
    matchedOn: proposedPlacement.kind,
    availableAt: minutesToTime(latestClear),
  };
}

// ---------------------------------------------------------------------------
// A generator's free slots (Tournament admin redesign, Stage 3 defects pass — F69)
// ---------------------------------------------------------------------------

/** The slot shape both generators build (lib/schedule-generator.ts `ScheduleDraftSlot` fits it). */
export interface DraftSlotPlacement {
  date: string;
  time: string;
  venueId?: string | null;
  venueFacilityId?: string | null;
  scheduleFacilityLaneId?: string | null;
  scheduleFacilityLaneLabel?: string | null;
}

/**
 * A draft's candidate slots, minus every slot an existing game already holds — by the SAME rule the Add/Edit window
 * refuses (`checkAgainstPlaced`'s overlap), so a draft never offers a slot that window would refuse.
 *
 * The generators used to emit every date × time × surface with nothing subtracted: the round-robin generator only
 * ever looked at its own division, the playoff generator at its own division's playoffs, so a U13 draft could land on
 * a U11 game sharing the diamond. Worse, the division's OWN kept games were only blocked when a slot's key matched
 * theirs exactly — and a stored game time carries seconds ("10:00:00") while a draft slot doesn't ("10:00"), so they
 * never did. `takenGames` is therefore every game the save will KEEP, in any division; the caller leaves out only the
 * games its save replaces. Cancelled games never block (as in the window).
 *
 * Taken games only remove slots. They never become a draft's assignments, so another division's games cannot count
 * toward this division's teams, rest or field figures. A slot inside a game's buffer is still offered (a buffer
 * warns, it does not refuse — as in the window).
 *
 * The draft's length is the LONGER of the generator's own length and the length its saved game will carry (the
 * division → tournament → shared default chain, since the generators save no per-game length): the window will check
 * the saved game by the second, and the organizer laid the draft out by the first.
 */
export function slotsClearOfTakenGames<T extends DraftSlotPlacement>(
  slots: T[],
  params: {
    takenGames: ConflictGame[];
    divisionId: string | null;
    draftLengthMinutes: number;
    divisions: Division[];
    tournament: Tournament | null | undefined;
  },
): T[] {
  const placed = params.takenGames
    .filter(game => game.status !== 'cancelled' && game.gameDate && game.startTime)
    .map(toPlacedGame)
    .filter(({ placement }) => isPlaced(placement));
  if (placed.length === 0) return slots;

  const division = params.divisions.find(d => d.id === params.divisionId);
  const savedLength = resolveGameTiming(division, params.tournament).durationMinutes;
  const durationMinutes = Math.max(params.draftLengthMinutes > 0 ? params.draftLengthMinutes : 0, savedLength);

  return slots.filter(slot => {
    // No typed text: a draft slot is a picked surface or a temporary lane, never words (typed text never matches a
    // structured reference — lib/venue-identity.ts).
    const proposed: ConflictGame = {
      id: '__draft-slot__',
      gameDate: slot.date,
      startTime: slot.time,
      status: 'scheduled',
      venueId: slot.venueId ?? null,
      venueFacilityId: slot.venueFacilityId ?? null,
      scheduleFacilityLaneId: slot.scheduleFacilityLaneId ?? null,
      scheduleFacilityLaneLabel: slot.scheduleFacilityLaneLabel ?? null,
      location: null,
      divisionId: params.divisionId,
      durationMinutes,
    };
    const conflict = checkAgainstPlaced(proposed, resolveVenuePlacement(proposed), placed, params.divisions, params.tournament);
    return conflict?.kind !== 'overlap';
  });
}

// ---------------------------------------------------------------------------
// Bulk conflict scan (for conflict badges on the schedule list)
// ---------------------------------------------------------------------------

/* ⚰ `GameConflictStatus` ({ gameId, kind }) stood here and was deleted 2026-09-01 (cleanup tranche
   6) with zero references. `ConflictInfo` below is the live shape the badges actually read — it
   carries the clashing PARTNER, which is what a badge has to name. A status that said only "this
   game conflicts" could never render the sentence the screen needs. */
export interface ConflictInfo {
  kind: ConflictKind;
  partnerId: string;
  partnerTime: string | null;
  /** See ConflictResult.matchedOn — lets the badge say the field was matched by typed name. */
  matchedOn: VenuePlacement['kind'];
}

/**
 * Scans all games in a tournament and returns conflict status for every game
 * that has at least one conflict. Used to render conflict badges in GameList.
 *
 * Games with no time, or with no usable location at all, are skipped. Games located only by a
 * typed field name ARE scanned — they used to be dropped here, which is why the list showed no
 * badge on a schedule the health panel was already calling double-booked.
 * Cancelled games are excluded.
 */
export function buildConflictMap(
  allGames: ConflictGame[],
  divisions: Division[],
  tournament: Tournament | null | undefined,
): Map<string, ConflictInfo> {
  const result = new Map<string, ConflictInfo>();

  // Resolve every game's placement ONCE up front. This scan compares each game against all the
  // others, so resolving inside the comparison would rebuild the same placements n times over.
  const placed = allGames.map(toPlacedGame);

  for (const { game, placement } of placed) {
    if (game.status === 'cancelled') continue;
    if (!isPlaced(placement)) continue;
    if (!game.gameDate || !game.startTime) continue;

    const conflict = checkAgainstPlaced(game, placement, placed, divisions, tournament);

    if (conflict) {
      // Escalate: if already marked 'buffer', upgrade to 'overlap' if needed.
      const existing = result.get(game.id);
      if (!existing || (existing.kind === 'buffer' && conflict.kind === 'overlap')) {
        result.set(game.id, {
          kind: conflict.kind,
          partnerId: conflict.conflictingGame.id,
          partnerTime: conflict.conflictingGame.startTime ?? null,
          matchedOn: conflict.matchedOn,
        });
      }
    }
  }

  return result;
}
