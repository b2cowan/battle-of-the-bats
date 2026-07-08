// Shared server-side validation for lineup-template entries, used by BOTH the create (POST) and
// edit-save (PATCH) routes so the two paths enforce an identical contract: active-roster membership,
// no duplicate players, a valid batting order, mode-consistent starter flags, and a whitelisted
// per-inning position vocabulary. Throws on the first violation (the route maps it to a 400).
import type { RepLineupMode, RepTeamLineupTemplateEntry } from '@/lib/types';

const VALID_POSITIONS = new Set([
  'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'EH', 'Bench',
]);

function normalizeInningPositions(raw: unknown, inningCount: number): Record<string, string> {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const next: Record<string, string> = {};
  for (let inning = 1; inning <= inningCount; inning += 1) {
    const value = source[String(inning)];
    if (typeof value !== 'string') continue;
    const position = value.trim();
    if (!position) continue;
    if (!VALID_POSITIONS.has(position)) throw new Error(`Invalid position for inning ${inning}`);
    next[String(inning)] = position;
  }
  return next;
}

/** Validate + normalize raw template entries. Throws Error (→ 400) on any violation. */
export function cleanTemplateEntries(
  rawEntries: unknown,
  opts: { activePlayerIds: Set<string>; lineupMode: RepLineupMode; inningCount: number },
): RepTeamLineupTemplateEntry[] {
  if (!Array.isArray(rawEntries)) throw new Error('entries must be an array');
  const seen = new Set<string>();
  return rawEntries.map(entry => {
    const o = (entry ?? {}) as Record<string, unknown>;
    const playerId = typeof o.playerId === 'string' ? o.playerId : '';
    if (!opts.activePlayerIds.has(playerId)) throw new Error('Templates can only include active roster players');
    if (seen.has(playerId)) throw new Error('Each player can only appear once in a template');
    seen.add(playerId);

    const rawOrder = o.battingOrder;
    const battingOrder = rawOrder === null || rawOrder === undefined || rawOrder === '' ? null : Number(rawOrder);
    if (battingOrder !== null && (!Number.isInteger(battingOrder) || battingOrder < 1 || battingOrder > 99)) {
      throw new Error('Batting order must be a positive whole number');
    }
    return {
      playerId,
      battingOrder,
      starter: opts.lineupMode === 'nine_player' ? Boolean(o.starter) : true,
      inningPositions: normalizeInningPositions(o.inningPositions, opts.inningCount),
    };
  });
}
