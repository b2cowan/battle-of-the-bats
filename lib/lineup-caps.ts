// Validation + resolution for the Lineup Intelligence P3 innings caps (mig 172).
//
//   • Season defaults live on rep_program_years.lineup_settings  (LineupSettings)
//   • A per-game override lives on rep_team_lineups.rules_override (LineupRulesOverride)
//   • The generator consumes the RESOLVED effective caps: override ?? season default.
//
// Shapes are app-enforced here (no DB CHECK), so the vocabulary can evolve freely. All values are
// small non-negative integers (innings); null means "no cap / off" for that rule.

import type { LineupSettings, LineupRulesOverride } from './types';

const MAX_INNINGS = 30; // generous ceiling — a game is ≤12 innings; guards against fat-finger input

/** Coerce to an integer cap in [1, MAX_INNINGS], or null (= "off"). A value below 1 is meaningless
 *  for every rule here — a cap of 0 would make everyone ineligible, and a floor of 0 is a no-op —
 *  so <1 (and blank/invalid) collapses to null so the UI and the generator never disagree. */
function clampInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(MAX_INNINGS, n);
}

/** Sanitize a raw season-defaults payload; returns null when every rule is off (store NULL, not {}). */
export function normalizeLineupSettings(input: unknown): LineupSettings | null {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const maxInningsPerPosition = clampInt(src.maxInningsPerPosition);
  const pitcherMaxInningsDefault = clampInt(src.pitcherMaxInningsDefault);
  const minInningsPerPlayer = clampInt(src.minInningsPerPlayer);
  if (maxInningsPerPosition == null && pitcherMaxInningsDefault == null && minInningsPerPlayer == null) return null;
  return { maxInningsPerPosition, pitcherMaxInningsDefault, minInningsPerPlayer };
}

/** Sanitize a raw per-game override; only KEEPS keys that carry an actual number, so a cleared field
 *  (blank/null) falls back to the season default rather than overriding to "off". Returns null when
 *  nothing is overridden. */
export function normalizeRulesOverride(input: unknown): LineupRulesOverride | null {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: LineupRulesOverride = {};
  const maxPos = clampInt(src.maxInningsPerPosition);
  const pitcher = clampInt(src.pitcherMaxInnings);
  const minPlay = clampInt(src.minInningsPerPlayer);
  if (maxPos != null) out.maxInningsPerPosition = maxPos;
  if (pitcher != null) out.pitcherMaxInnings = pitcher;
  if (minPlay != null) out.minInningsPerPlayer = minPlay;
  return Object.keys(out).length ? out : null;
}

/** The resolved caps the generator enforces for a specific game. */
export interface EffectiveLineupCaps {
  maxInningsPerPosition: number | null; // rotation cap on non-mound field positions
  pitcherInningsCap: number | null;     // team/game pitching ceiling (min'd with per-player in the generator)
  minInningsPerPlayer: number | null;   // min-play floor
}

/** Effective cap = per-game override ?? season default (per rule). */
export function resolveLineupCaps(
  season: LineupSettings | null | undefined,
  override: LineupRulesOverride | null | undefined,
): EffectiveLineupCaps {
  const pick = (o: number | null | undefined, s: number | null | undefined): number | null =>
    (o != null ? o : (s != null ? s : null));
  return {
    maxInningsPerPosition: pick(override?.maxInningsPerPosition, season?.maxInningsPerPosition),
    pitcherInningsCap: pick(override?.pitcherMaxInnings, season?.pitcherMaxInningsDefault),
    minInningsPerPlayer: pick(override?.minInningsPerPlayer, season?.minInningsPerPlayer),
  };
}
