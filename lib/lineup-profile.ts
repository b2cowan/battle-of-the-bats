// Validation + reconstruction helpers for the Lineup Intelligence player profile (mig 170).
//
// The model is deliberately split so existing readers/writers of primary_position/secondary_position
// keep working untouched:
//   • primary_position / secondary_position  → the top-two "Best" positions (ranks 1 & 2)
//   • lineup_profile.morePreferred            → "Best" ranks 3+
//   • lineup_profile.never                    → hard-excluded
//   • lineup_profile.pitcher / aSquad         → P2 / P4 (carried through, edited in later phases)
//
// Three states per position (owner, 2026-09-12): Best (ranked), Never, or blank = fine anywhere
// they're not Never. There is no "Okay" bucket any more — a coach who wants a fill-in spot ranks it
// as a low Best. ⚠ A stray `canPlay` key (the old fourth bucket, folded into the Best tail by
// migration 291) is never thrown on: `normalizeLineupProfile` drops it on the next write, and
// `dropLegacyLineupProfileKeys` (below) strips it inside the one shared roster-row reader
// (lib/db.ts) that every reader is built on — including season rollover's forward copy
// (lib/rep-season-rollover.ts), which inherits the strip for free rather than needing its own —
// so a row the migration missed, or one written by old code during a deploy window, both loads
// clean AND stops carrying the stray key forward into next season's row.
//
// Positions are validated against the team's Sport Pack (lib/sports.ts) — never hard-coded here.
// All comparisons are uppercased. A NULL profile means "no extra richness" → the generator/readers
// fall back to primary/secondary alone.

import type { LineupProfile, LineupPitcherProfile, RepRosterPlayer } from './types';

const up = (s: unknown): string => (typeof s === 'string' ? s.toUpperCase().trim() : '');

/** Clean a raw value to unique, uppercased, valid position codes (input order preserved). */
function cleanPositions(input: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const code = up(raw);
    if (!code || !valid.has(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function normalizePitcher(raw: unknown): LineupPitcherProfile | null {
  // Require an explicit `rank` so a stray empty object ({}) never silently enrolls a pitcher
  // (which would also strip their position buckets). The canonical payload always carries rank.
  if (!raw || typeof raw !== 'object' || !('rank' in raw)) return null;
  const r = raw as Record<string, unknown>;
  const rankNum = Number(r.rank);
  const rank = Number.isFinite(rankNum) ? Math.min(99, Math.max(1, Math.round(rankNum))) : 1;
  let maxInnings: number | null = null;
  if (r.maxInnings !== null && r.maxInnings !== undefined && r.maxInnings !== '') {
    const mi = Number(r.maxInnings);
    // Floor at 1: a cap of 0 would silently bench the pitcher all game (generator uses played < cap).
    // "No cap" is expressed as null (empty input), never 0. Blank → the guard above keeps it null.
    maxInnings = Number.isFinite(mi) ? Math.min(99, Math.max(1, Math.round(mi))) : null;
  }
  return { rank, maxInnings };
}

/**
 * Validate/sanitize a raw lineup_profile object against the sport's position vocabulary.
 * Enforces that a position lands in at most ONE bucket (never wins over morePreferred, so a hard
 * "Never" is never contradicted). Returns null when the profile carries no signal (empty lists,
 * not a pitcher, not A-squad) so we persist NULL rather than {}. Any key outside the shape —
 * including a legacy `canPlay` — is not carried through.
 */
export function normalizeLineupProfile(input: unknown, validPositions: string[]): LineupProfile | null {
  const valid = new Set(validPositions.map(p => p.toUpperCase()));
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const never = cleanPositions(src.never, valid);
  const neverSet = new Set(never);
  const morePreferred = cleanPositions(src.morePreferred, valid).filter(p => !neverSet.has(p));

  const pitcher = normalizePitcher(src.pitcher);
  const aSquad = src.aSquad === true;

  if (!never.length && !morePreferred.length && !pitcher && !aSquad) return null;
  return { morePreferred, never, pitcher, aSquad };
}

/**
 * Strip a legacy `canPlay` key from a profile object read straight off the database, before it
 * reaches the rest of the app without passing through `normalizeLineupProfile` first. Called once,
 * inside the single shared roster-row mapper (lib/db.ts) — every reader built on that mapper
 * (including season rollover's forward copy) gets the strip for free, without needing its own
 * call. Needs no Sport Pack: the positions inside an already-stored row are valid by construction,
 * so this only removes a key outside the current three-state shape, never validates or reorders
 * anything. A profile with no stray key (every row after migration 291, and every row this app
 * writes from here on) is returned as-is.
 */
export function dropLegacyLineupProfileKeys(profile: LineupProfile | null): LineupProfile | null {
  if (!profile || !('canPlay' in profile)) return profile;
  return { morePreferred: profile.morePreferred, never: profile.never, pitcher: profile.pitcher, aSquad: profile.aSquad };
}

/**
 * From a picker payload with an ordered `preferred` (Best) list + never/pitcher/aSquad, produce
 * the DB write triplet: the primary/secondary columns (ranks 1 & 2) + the profile (the rest).
 * Doing the split server-side keeps the columns and the profile from ever drifting apart,
 * regardless of what the client sends. A `canPlay` key in the payload (old clients) is ignored.
 */
export function buildLineupProfileWrite(
  raw: { preferred?: unknown; never?: unknown; pitcher?: unknown; aSquad?: unknown } | null | undefined,
  validPositions: string[],
  pitcherPosition?: string | null,
): { primaryPosition: string | null; secondaryPosition: string | null; lineupProfile: LineupProfile | null } {
  const valid = new Set(validPositions.map(p => p.toUpperCase()));
  const pitcherCode = pitcherPosition ? pitcherPosition.toUpperCase() : null;
  // The mound is never a fielding preference — pitching lives in the pitcher depth chart. Strip it
  // from every bucket so it can never be stored as Best/Never (server-authoritative).
  const dropMound = (arr: string[]) => (pitcherCode ? arr.filter(c => c !== pitcherCode) : arr);

  const never = dropMound(cleanPositions(raw?.never, valid));
  const neverSet = new Set(never);
  const preferred = dropMound(cleanPositions(raw?.preferred, valid)).filter(p => !neverSet.has(p)); // never wins over preferred (matches normalizeLineupProfile's precedence)
  const primaryPosition = preferred[0] ?? null;
  const secondaryPosition = preferred[1] ?? null;
  const lineupProfile = normalizeLineupProfile({
    morePreferred: preferred.slice(2),
    never,
    pitcher: raw?.pitcher,
    aSquad: raw?.aSquad,
  }, validPositions);
  return { primaryPosition, secondaryPosition, lineupProfile };
}

/**
 * The player's position preferences for the generator / UI: the full ordered Best list plus
 * Never, merging the authoritative primary/secondary columns with the profile. Uppercased,
 * deduped, and with Never stripped from preferred so a hard exclusion always wins. Every other
 * position is blank — fine.
 */
export function playerPositionPrefs(
  player: Pick<RepRosterPlayer, 'primaryPosition' | 'secondaryPosition' | 'lineupProfile'>,
  pitcherPosition?: string | null,
): { preferred: string[]; never: string[] } {
  const prof = player.lineupProfile;
  // The mound is never a fielding preference — pitching is managed entirely by the pitcher depth
  // chart (the "This player pitches" toggle + rank + cap). Exclude it from every fielding bucket,
  // pitcher or not, so it never appears as a Best/Never chip (matches the server strip).
  const mound = pitcherPosition ? up(pitcherPosition) : null;
  const never = (prof?.never ?? []).map(up).filter(c => !!c && c !== mound);
  const neverSet = new Set(never);

  const preferred: string[] = [];
  const seen = new Set<string>();
  for (const raw of [player.primaryPosition, player.secondaryPosition, ...(prof?.morePreferred ?? [])]) {
    const code = up(raw);
    if (!code || code === mound || seen.has(code) || neverSet.has(code)) continue;
    seen.add(code);
    preferred.push(code);
  }

  return { preferred, never };
}

// ── Three-state cycle (Best → Never → blank), shared by every position picker ──
// Both editors — the depth-chart board (desktop grid + phone accordion) and the player-page
// picker — cycle one position through the same three states on tap. Extracted here (2026-09-12
// /simplify pass) so there is exactly one transition table, not two hand-rolled copies that have
// to be edited in lockstep whenever the state machine changes, as they were during the
// four-states-to-three collapse.
export type PositionState = 'best' | 'never' | 'neutral';

export function positionStateOf(value: { best: string[]; never: string[] }, code: string): PositionState {
  if (value.best.includes(code)) return 'best';
  if (value.never.includes(code)) return 'never';
  return 'neutral';
}

const NEXT_POSITION_STATE: Record<PositionState, PositionState> = {
  neutral: 'best',
  best: 'never',
  never: 'neutral',
};

/** Cycle one position to its next state and return the updated {best, never} pair. Removes the
 *  code from both lists first, then re-adds it to whichever list the next state calls for — the
 *  caller merges this into its own richer value (a depth-chart PlayerProfile, a
 *  PositionProfileValue, …), which is why this returns just the two lists rather than the whole
 *  input back. */
export function cyclePositionState(
  value: { best: string[]; never: string[] },
  code: string,
): { best: string[]; never: string[] } {
  const next = NEXT_POSITION_STATE[positionStateOf(value, code)];
  const best = value.best.filter(c => c !== code);
  const never = value.never.filter(c => c !== code);
  if (next === 'best') best.push(code);
  else if (next === 'never') never.push(code);
  return { best, never };
}
