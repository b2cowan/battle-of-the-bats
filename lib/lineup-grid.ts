// Shared, pure lineup-grid helpers used by BOTH the game lineup builder and the standalone template
// builder (via the shared LineupEditor). No I/O, no React, no CSS — just the row model + ordering.
import type { RepRosterPlayer, RepLineupMode } from '@/lib/types';
import { playerDisplayName } from '@/lib/coach-roster-name';

// Cell options for a per-inning position select. '' = unassigned (not persisted).
export const LINEUP_POSITIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'EH', 'Bench'];
// Canonical order for the playing-time summary columns.
export const POSITION_ORDER = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'EH'];

export interface LineupPlayerRow {
  player: RepRosterPlayer;
  battingOrder: string;
  starter: boolean;
  inningPositions: Record<string, string>;
  notes?: string;
}

/** A saved entry from either a game lineup or a template — the shape both share. */
export interface LineupSeedEntry {
  playerId: string;
  battingOrder: number | null;
  starter: boolean;
  inningPositions: Record<string, string>;
  notes?: string | null;
}

// Lime "heat" intensity for a usage count (more innings → stronger tint). Capped for legibility.
export function heatStyle(count: number) {
  if (!count) return undefined;
  return { background: `rgba(var(--logic-lime-rgb), ${Math.min(0.55, 0.1 + count * 0.09)})` };
}

export function sortLineupRows(rows: LineupPlayerRow[]) {
  return [...rows].sort((a, b) => {
    const aOrder = Number(a.battingOrder) || 999;
    const bOrder = Number(b.battingOrder) || 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.starter !== b.starter) return a.starter ? -1 : 1;
    return playerDisplayName(a.player).localeCompare(playerDisplayName(b.player));
  });
}

// Batting order = the row's position in the (drag-ordered) list — no manual numbers, so a coach
// can't type the same slot twice. everyone_bats: all bat 1..N; nine_player: starters bat 1..9.
export function renumberBattingOrder(rows: LineupPlayerRow[], mode: RepLineupMode): LineupPlayerRow[] {
  let n = 0;
  return rows.map(r => {
    if (mode === 'everyone_bats') return { ...r, starter: true, battingOrder: String(++n) };
    if (r.starter && n < 9) return { ...r, battingOrder: String(++n) };
    return { ...r, battingOrder: '' };
  });
}

export function buildLineupRows(
  players: RepRosterPlayer[],
  entries: LineupSeedEntry[],
  mode: RepLineupMode,
): LineupPlayerRow[] {
  const byPlayer = new Map(entries.map(entry => [entry.playerId, entry]));
  return players.map((player, index) => {
    const existing = byPlayer.get(player.id);
    return {
      player,
      battingOrder: existing?.battingOrder != null
        ? String(existing.battingOrder)
        : mode === 'everyone_bats' ? String(index + 1) : index < 9 ? String(index + 1) : '',
      starter: existing?.starter ?? (mode === 'everyone_bats' ? true : index < 9),
      inningPositions: existing?.inningPositions ?? {},
      notes: existing?.notes ?? '',
    };
  });
}
