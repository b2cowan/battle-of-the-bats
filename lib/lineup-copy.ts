// Copy from — put another game's lineup, or a template, onto this game (owner rulings 2026-10-02;
// docs/projects/active/COACH_LINEUP_COPY_FROM_GAME_PLAN.md §4). Pure on purpose: the builder page
// fetches the source and links any call-ups FIRST, then hands this the players the game can hold.
// One function for both sources, so a game and a template can never disagree about what "Batting
// order" or "Order and positions" means.
import { renumberBattingOrder, sortLineupRows, type LineupPlayerRow, type LineupSeedEntry } from './lineup-grid';
import type { RepLineupMode, RepRosterPlayer } from '@/lib/types';

/** "Batting order" or "Order and positions" — the two answers the coach picks between. */
export type LineupCopyWhat = 'order' | 'everything';

/** What is being copied FROM: a saved game lineup or a template — the shape both share. */
export interface LineupCopySource {
  lineupMode: RepLineupMode;
  inningCount: number;
  entries: LineupSeedEntry[];
}

export interface LineupCopyResult {
  rows: LineupPlayerRow[];
  lineupMode: RepLineupMode;
  inningCount: number;
  /** Source players this game cannot hold — they left the team, or a call-up could not be brought. */
  skippedPlayerIds: string[];
}

/** The source's batting order: numbered slots first, ascending; the rest (nine-player subs) after, as saved. */
export function sourceBattingOrder(entries: LineupSeedEntry[]): LineupSeedEntry[] {
  return entries
    .map((entry, index) => {
      const slot = Number(entry.battingOrder);
      return { entry, index, slot: entry.battingOrder != null && slot > 0 ? slot : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.slot - b.slot || a.index - b.index)
    .map(x => x.entry);
}

/** Only the innings this lineup has — a 7-inning game's 7th does not ride into a 6-inning one, unseen. */
function positionsWithin(positions: Record<string, string> | null | undefined, innings: number): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [inning, position] of Object.entries(positions ?? {})) {
    const n = Number(inning);
    if (Number.isInteger(n) && n >= 1 && n <= innings && position) kept[inning] = position;
  }
  return kept;
}

/**
 * The copied lineup, AS IS (D3): every source player this game can hold comes across in the
 * source's order — including a player the coach had taken out of this game, and one marked Out,
 * whom the strip's existing warning then names. This game's players who were not in the source stay,
 * at the bottom.
 *
 * - **everything** — the order, who starts, every inning's positions (the pitcher too, D2), and the
 *   source's format and innings. Players not in the source keep no positions: they had none there.
 * - **order** — only the order. This game's format and innings stay, and each player's positions on
 *   THIS game stay with them. Who starts follows the source only when both games are nine-player;
 *   otherwise this game's format decides.
 *
 * The game's notes and each player's note are about that day, so they are never copied.
 */
export function copyLineup({ current, currentMode, currentInnings, source, what, admissible }: {
  current: LineupPlayerRow[];
  currentMode: RepLineupMode;
  currentInnings: number;
  source: LineupCopySource;
  what: LineupCopyWhat;
  /** Every player this game can hold: its active roster and its call-ups, after any linking. */
  admissible: Map<string, RepRosterPlayer>;
}): LineupCopyResult {
  const everything = what === 'everything';
  const lineupMode = everything ? source.lineupMode : currentMode;
  const inningCount = everything ? source.inningCount : currentInnings;
  const bothNine = source.lineupMode === 'nine_player' && currentMode === 'nine_player';
  const currentById = new Map(current.map(row => [row.player.id, row]));

  const placed = new Set<string>();
  const skippedPlayerIds: string[] = [];
  const list: LineupPlayerRow[] = [];
  for (const entry of sourceBattingOrder(source.entries)) {
    if (placed.has(entry.playerId)) continue;
    const mine = currentById.get(entry.playerId);
    const player = admissible.get(entry.playerId) ?? mine?.player;
    if (!player) { skippedPlayerIds.push(entry.playerId); continue; }
    placed.add(entry.playerId);
    const starter = lineupMode === 'everyone_bats' ? true
      : everything || bothNine ? entry.starter
      : mine?.starter ?? false;
    list.push({
      player,
      battingOrder: '',
      starter,
      inningPositions: everything ? positionsWithin(entry.inningPositions, inningCount) : { ...(mine?.inningPositions ?? {}) },
      notes: mine?.notes ?? '',
    });
  }
  for (const mine of current) {
    if (placed.has(mine.player.id)) continue;
    placed.add(mine.player.id);
    list.push({
      ...mine,
      battingOrder: '',
      starter: lineupMode === 'everyone_bats' ? true : everything ? false : mine.starter,
      inningPositions: everything ? {} : { ...mine.inningPositions },
    });
  }

  // Nine-player ball starts nine at most — a copied nine plus a starter of this game's own would be
  // a lineup the server refuses.
  let starters = 0;
  const capped = lineupMode === 'nine_player'
    ? list.map(row => (row.starter && ++starters > 9 ? { ...row, starter: false } : row))
    : list;

  return { rows: sortLineupRows(renumberBattingOrder(capped, lineupMode)), lineupMode, inningCount, skippedPlayerIds };
}
