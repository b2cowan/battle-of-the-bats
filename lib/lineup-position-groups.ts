/**
 * THE POSITION SHEET'S GROUPS — one player's choices for one inning, by the depth chart (phone
 * re-evaluation stage 3 · D5, owner ruling 2026-09-21). The grid's native `<select>` offers every
 * code flat; the phone's sheet (`LineupPositionSheet`) offers them BY THE CHART'S THREE STATES —
 * the same reason the inning inspector's picker became a list carrying the chart's facts (D9):
 *
 *   · **Best** — `playerPositionPrefs().preferred`, in rank order (Primary and Secondary ARE ranks
 *     1 and 2; `morePreferred` the tail), the rank as the chip's second line. A charted pitcher's
 *     mound sits here too, carrying the cap's use ("2 of 4 used" · "at cap" · "1 pitched · no
 *     cap") — the mound is never a fielding preference, the pitcher depth chart governs it.
 *   · **Fine — anywhere not Never** — the sport's roster vocabulary (the field spots plus the
 *     bat-only / catch-all codes the desktop select offers) in neither list; for a player who does
 *     not pitch, the mound with "doesn't pitch". A current value outside the vocabulary (a code the
 *     desktop offered that the pack does not name) still gets a chip, so the sheet never hides
 *     what is there.
 *   · **Never** — the chart's Never list. Allowed and named, never confirmed (D9's rule; the grid
 *     has no confirm either) — the sheet paints it red.
 *
 * A chip carries a second line ONLY where the chart has a fact (B6's rule). Bench and "Leave
 * open" are rows of the sheet's own, never chips. Pure and framework-free so the guard can pin
 * the grouping without a DOM.
 */
import { playerPositionPrefs } from './lineup-profile';
import { BENCH_POSITION } from './lineup-analysis';
import type { LineupPlayerRow } from './lineup-grid';

export interface PositionChip {
  code: string;
  /** The chart's fact about this code, if it has one — the rank, the mound's cap use. */
  note?: string;
  /** `cap`: the mound at its cap — still offered, drawn in the warning ink. */
  tone?: 'cap';
}

export interface PositionSheetPack {
  positions: string[];
  fieldPositions: string[];
  pitcherPosition: string | null;
}

/** "1st", "2nd", "3rd", "4th"… — the rank as the chip reads it, the inning as the sub-line reads it. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * The three groups for one row. `pitcherCap` is the effective per-game cap the editor reconciles
 * (player and team caps); `current` is what the cell holds now (`''` = open).
 */
export function positionGroups(
  row: LineupPlayerRow,
  pack: PositionSheetPack,
  pitcherCap: number | null,
  current: string,
): { best: PositionChip[]; fine: PositionChip[]; never: PositionChip[] } {
  const { pitcherPosition } = pack;
  const prefs = playerPositionPrefs(row.player, pitcherPosition);
  const pitcher = row.player.lineupProfile?.pitcher ?? null;
  const best: PositionChip[] = prefs.preferred.map((code, i) => ({ code, note: ordinal(i + 1) }));
  if (pitcherPosition && pitcher) {
    const pitched = Object.values(row.inningPositions).filter(v => v === pitcherPosition).length;
    const atCap = pitcherCap != null && pitched >= pitcherCap;
    best.push({
      code: pitcherPosition,
      note: pitcherCap == null ? `${pitched} pitched · no cap` : atCap ? 'at cap' : `${pitched} of ${pitcherCap} used`,
      tone: atCap ? 'cap' : undefined,
    });
  }
  const neverSet = new Set(prefs.never);
  const bestSet = new Set(best.map(c => c.code));
  const vocabulary = pack.positions.length ? pack.positions : pack.fieldPositions;
  const fine: PositionChip[] = [];
  for (const code of vocabulary) {
    if (bestSet.has(code) || neverSet.has(code) || code === pitcherPosition) continue;
    fine.push({ code });
  }
  if (pitcherPosition && !pitcher) fine.push({ code: pitcherPosition, note: 'doesn’t pitch' });
  if (current && current !== BENCH_POSITION && !bestSet.has(current) && !neverSet.has(current) && !fine.some(c => c.code === current)) {
    fine.push({ code: current });
  }
  const never: PositionChip[] = prefs.never.map(code => ({ code }));
  return { best, fine, never };
}
