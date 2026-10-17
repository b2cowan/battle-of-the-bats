/**
 * A GAME NAMES ONLY ITS OWN TOURNAMENT'S DIVISION, TEAMS, SPOTS AND FACILITIES (security fix, 2026-10-16; found by the
 * team-update sweep).
 *
 * The games route org-checks a game's tournament, then wrote whatever division, team, spot and facility-lane ids it was
 * sent. A game could point into another organization's event: its teams' schedules (the coach portal and the public
 * team stats find games by team id alone), that organization's division deletes and reads, and its facility tool
 * (which re-places games by lane id alone). The two generator saves were already safe — their database functions
 * refuse a foreign reference (migrations 320, 327) — so this is for the route's other writers: bulk save, create, the
 * bracket editor's new games, and the one-game update.
 *
 * `bracket_id` is not here on purpose: it is a grouping key the client makes, not a reference (DATA_DICTIONARY games,
 * gotcha 2), and nothing reads games by it alone.
 */
import { supabaseAdmin } from './supabase-admin';

/** A game row as a writer is about to store it (snake_case; only the columns that name another row matter here). */
export type GameReferenceRow = {
  tournament_id: unknown;
  division_id?: unknown;
  home_team_id?: unknown;
  away_team_id?: unknown;
  home_slot_id?: unknown;
  away_slot_id?: unknown;
  schedule_facility_lane_id?: unknown;
};

/** Each referencing column → the table it names. Every one of those tables carries `tournament_id`. */
export const GAME_REFERENCE_TABLES = {
  division_id: 'divisions',
  home_team_id: 'teams',
  away_team_id: 'teams',
  home_slot_id: 'pool_slots',
  away_slot_id: 'pool_slots',
  schedule_facility_lane_id: 'schedule_facility_lanes',
} as const;

type Column = keyof typeof GAME_REFERENCE_TABLES;
export type ReferenceTable = (typeof GAME_REFERENCE_TABLES)[Column];
const TABLES = [...new Set(Object.values(GAME_REFERENCE_TABLES))] as ReferenceTable[];
const COLUMNS = Object.keys(GAME_REFERENCE_TABLES) as Column[];

export const GAME_REFERENCE_REFUSAL = 'A game names a division, team, spot or facility from another tournament.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** No reference: the column is left empty (null, undefined, or the '' a form sends). */
const absent = (v: unknown) => v === null || v === undefined || v === '';

/** The ids to read from each table, or null when one is not an id at all (the request is refused). */
export function referencedIds(rows: readonly GameReferenceRow[]): Record<ReferenceTable, string[]> | null {
  const out = Object.fromEntries(TABLES.map(t => [t, new Set<string>()])) as Record<ReferenceTable, Set<string>>;
  for (const row of rows) {
    for (const col of COLUMNS) {
      const v = row[col];
      if (absent(v)) continue;
      if (typeof v !== 'string' || !UUID_RE.test(v)) return null;
      out[GAME_REFERENCE_TABLES[col]].add(v);
    }
  }
  return Object.fromEntries(TABLES.map(t => [t, [...out[t]]])) as Record<ReferenceTable, string[]>;
}

/**
 * Does any row name a row of another tournament (or one that does not exist)? `found` maps, per table, each id read to
 * its `tournament_id`.
 */
export function foreignGameReference(
  rows: readonly GameReferenceRow[],
  found: Record<ReferenceTable, ReadonlyMap<string, string | null>>,
): boolean {
  for (const row of rows) {
    // A game names its tournament; without one there is nothing to hold its references to (and it belongs to no one).
    if (typeof row.tournament_id !== 'string' || !row.tournament_id) return true;
    for (const col of COLUMNS) {
      const v = row[col];
      if (absent(v)) continue;
      const owner = found[GAME_REFERENCE_TABLES[col]].get(v as string);
      if (owner === undefined || owner === null || owner !== row.tournament_id) return true;
    }
  }
  return false;
}

/** The refusal for rows that name another tournament's rows, or null. One read per table named. */
export async function gameReferencesRefusal(rows: readonly GameReferenceRow[]): Promise<string | null> {
  const ids = referencedIds(rows);
  if (!ids) return GAME_REFERENCE_REFUSAL;
  const found = Object.fromEntries(TABLES.map(t => [t, new Map<string, string | null>()])) as Record<ReferenceTable, Map<string, string | null>>;
  await Promise.all(TABLES.filter(t => ids[t].length).map(async t => {
    const { data, error } = await supabaseAdmin.from(t).select('id, tournament_id').in('id', ids[t]);
    if (error) throw error;
    for (const r of (data ?? []) as Array<{ id: string; tournament_id: string | null }>) found[t].set(r.id, r.tournament_id);
  }));
  return foreignGameReference(rows, found) ? GAME_REFERENCE_REFUSAL : null;
}
