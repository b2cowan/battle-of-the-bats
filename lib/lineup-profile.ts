// Validation + reconstruction helpers for the Lineup Intelligence player profile (mig 170).
//
// The model is deliberately split so existing readers/writers of primary_position/secondary_position
// keep working untouched:
//   • primary_position / secondary_position  → the top-two "Best" positions (ranks 1 & 2)
//   • lineup_profile.morePreferred            → "Best" ranks 3+
//   • lineup_profile.canPlay / never          → "Okay" / hard-excluded
//   • lineup_profile.pitcher / aSquad         → P2 / P4 (carried through, edited in later phases)
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
    maxInnings = Number.isFinite(mi) ? Math.min(99, Math.max(0, Math.round(mi))) : null;
  }
  return { rank, maxInnings };
}

/**
 * Validate/sanitize a raw lineup_profile object against the sport's position vocabulary.
 * Enforces that a position lands in at most ONE bucket (never wins over canPlay wins over
 * morePreferred, so a hard "Never" is never contradicted). Returns null when the profile carries
 * no signal (empty lists, not a pitcher, not A-squad) so we persist NULL rather than {}.
 */
export function normalizeLineupProfile(input: unknown, validPositions: string[]): LineupProfile | null {
  const valid = new Set(validPositions.map(p => p.toUpperCase()));
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const never = cleanPositions(src.never, valid);
  const neverSet = new Set(never);
  const canPlay = cleanPositions(src.canPlay, valid).filter(p => !neverSet.has(p));
  const canSet = new Set(canPlay);
  const morePreferred = cleanPositions(src.morePreferred, valid).filter(p => !neverSet.has(p) && !canSet.has(p));

  const pitcher = normalizePitcher(src.pitcher);
  const aSquad = src.aSquad === true;

  if (!never.length && !canPlay.length && !morePreferred.length && !pitcher && !aSquad) return null;
  return { morePreferred, canPlay, never, pitcher, aSquad };
}

/**
 * From a picker payload with an ordered `preferred` (Best) list + okay/never/pitcher/aSquad,
 * produce the DB write triplet: the primary/secondary columns (ranks 1 & 2) + the profile (the
 * rest). Doing the split server-side keeps the columns and the profile from ever drifting apart,
 * regardless of what the client sends.
 */
export function buildLineupProfileWrite(
  raw: { preferred?: unknown; canPlay?: unknown; never?: unknown; pitcher?: unknown; aSquad?: unknown } | null | undefined,
  validPositions: string[],
  pitcherPosition?: string | null,
): { primaryPosition: string | null; secondaryPosition: string | null; lineupProfile: LineupProfile | null } {
  const valid = new Set(validPositions.map(p => p.toUpperCase()));
  const pitcherCode = pitcherPosition ? pitcherPosition.toUpperCase() : null;
  // The mound is never a fielding preference — pitching lives in the pitcher depth chart. Strip it
  // from every bucket so it can never be stored as Best/Okay/Never (server-authoritative).
  const dropMound = (arr: string[]) => (pitcherCode ? arr.filter(c => c !== pitcherCode) : arr);

  const never = dropMound(cleanPositions(raw?.never, valid));
  const neverSet = new Set(never);
  const preferred = dropMound(cleanPositions(raw?.preferred, valid)).filter(p => !neverSet.has(p)); // preferred wins over never
  const preferredSet = new Set(preferred);
  // preferred also wins over "Okay": strip any preferred position from canPlay so morePreferred
  // (= preferred ranks 3+) can never be evicted by an overlapping Okay entry.
  const canPlay = dropMound(cleanPositions(raw?.canPlay, valid)).filter(p => !preferredSet.has(p));
  const primaryPosition = preferred[0] ?? null;
  const secondaryPosition = preferred[1] ?? null;
  const lineupProfile = normalizeLineupProfile({
    morePreferred: preferred.slice(2),
    canPlay,
    never,
    pitcher: raw?.pitcher,
    aSquad: raw?.aSquad,
  }, validPositions);
  return { primaryPosition, secondaryPosition, lineupProfile };
}

/**
 * The player's position preferences for the generator / UI: the full ordered Best list plus Okay
 * and Never, merging the authoritative primary/secondary columns with the profile. Uppercased,
 * deduped, and with Never stripped from preferred/canPlay so a hard exclusion always wins.
 */
export function playerPositionPrefs(
  player: Pick<RepRosterPlayer, 'primaryPosition' | 'secondaryPosition' | 'lineupProfile'>,
  pitcherPosition?: string | null,
): { preferred: string[]; canPlay: string[]; never: string[] } {
  const prof = player.lineupProfile;
  // The mound is never a fielding preference — pitching is managed entirely by the pitcher depth
  // chart (the "This player pitches" toggle + rank + cap). Exclude it from every fielding bucket,
  // pitcher or not, so it never appears as a Best/Okay/Never chip (matches the server strip).
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

  const canPlay: string[] = [];
  for (const raw of prof?.canPlay ?? []) {
    const code = up(raw);
    if (!code || code === mound || seen.has(code) || neverSet.has(code) || canPlay.includes(code)) continue;
    canPlay.push(code);
  }

  return { preferred, canPlay, never };
}
