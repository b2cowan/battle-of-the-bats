/**
 * THE SERVER'S HALF OF THE OVERLAP RULE (Tournament admin redesign Stage 3, A37). Every games writer calls this BEFORE
 * its first write: the game window's save, Add game, the timeline's drop and the phone's move sheet (`update`),
 * Reinstate (`revert-to-scheduled`), both generators (`bulk-save`, `replace-division-round-robin`), the bracket editor
 * (`save-bracket`), the rain delay (`bulk-reschedule`), the typed-locations resolver and its Undo, and the temporary
 * lanes' resolve. The rule and its words are `lib/tournament-overlap.ts` — the screens refuse the same thing first;
 * this is what refuses a save that slips past them (a stale screen, a second admin, a direct request).
 *
 * It reads the tournament's games as they stand, so a refusal is always about the schedule the database holds. A
 * refusal is a 409 with the sentence the field would have said, and nothing is written. Club bookings never refuse
 * (Club Tier 6a's line, reported after the save).
 */
import { supabaseAdmin } from './supabase-admin';
import type { Division, Tournament } from './types';
import { fieldNounFor } from './sports';
import { findRefusedOverlap, overlapRefusalWords, type OverlapGame } from './tournament-overlap.ts';

/** A game as a writer is about to leave it, in the games table's own columns. Absent keys keep the stored value. */
export interface ProposedGameRow {
  /** An existing game's id; absent (or unknown) for a game being created. */
  id?: string | null;
  division_id?: string | null;
  game_date?: string | null;
  game_time?: string | null;
  duration_minutes?: number | null;
  diamond_id?: string | null;
  venue_facility_id?: string | null;
  location?: string | null;
  schedule_facility_lane_id?: string | null;
  status?: string | null;
  is_playoff?: boolean | null;
  bracket_code?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
  home_placeholder?: string | null;
  away_placeholder?: string | null;
}

/** The columns that place a game in time and space: a write that touches none of them can't make an overlap. */
const PLACING_COLUMNS = [
  'game_date', 'game_time', 'duration_minutes', 'diamond_id', 'venue_facility_id', 'location', 'schedule_facility_lane_id', 'status',
] as const;
export const placesAGame = (updates: Record<string, unknown>) => PLACING_COLUMNS.some(c => c in updates);

const GAME_COLUMNS = 'id, division_id, game_date, game_time, duration_minutes, diamond_id, venue_facility_id, location, schedule_facility_lane_id, status, is_playoff, bracket_code, home_team_id, away_team_id, home_placeholder, away_placeholder';
const PAGE = 1000;

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return out;
  }
}

/** The stored value a proposed column is compared with (a time is stored "14:00:00" and proposed "14:00"). */
const placingValue = (column: (typeof PLACING_COLUMNS)[number], v: unknown) =>
  v == null || v === '' ? null : column === 'game_time' ? String(v).slice(0, 5) : v;

/**
 * Whether a write moves this game in time or space: a new game always does; a stored one when a placing column it names
 * differs from the stored value. A row that leaves its placement as it was is never re-judged — so a notes-only save,
 * or a generator re-saving a game it kept, never trips on an overlap that predates the rule (the game window's own
 * rule: it holds only when the edit places the game).
 */
export function changesPlacement(proposed: ProposedGameRow, stored: ProposedGameRow | undefined): boolean {
  if (!stored) return true;
  // On a picked diamond the location is its display words, re-derived on every save (a renamed venue, a legacy dash):
  // the diamond's ids say whether it moved. Only a typed place is its words.
  const picked = !!(proposed.venue_facility_id ?? stored.venue_facility_id ?? proposed.diamond_id ?? stored.diamond_id);
  return PLACING_COLUMNS.some(c => proposed[c] !== undefined && !(c === 'location' && picked)
    && placingValue(c, proposed[c]) !== placingValue(c, stored[c]));
}

/**
 * The refusal for these placements, or null. `removedIds` are games the same write deletes (they free their diamonds).
 * New games may carry any id the caller likes (`new:0`, …) — it only names them inside the batch.
 */
export async function tournamentOverlapRefusal(
  tournamentId: string,
  proposedRows: readonly ProposedGameRow[],
  opts: { removedIds?: Iterable<string> } = {},
): Promise<{ status: 409; body: { error: string; code: 'overlap'; gameId: string; otherGameId: string } } | null> {
  if (!proposedRows.length) return null;
  // What the check needs: the games as they stand, and the length rules (division, then tournament).
  const [games, divisionsRes, tournamentRes] = await Promise.all([
    readAll<ProposedGameRow & { id: string }>((a, b) => supabaseAdmin.from('games').select(GAME_COLUMNS)
      .eq('tournament_id', tournamentId).order('id').range(a, b)),
    supabaseAdmin.from('divisions').select('id, name, settings').eq('tournament_id', tournamentId),
    supabaseAdmin.from('tournaments').select('id, sport, settings').eq('id', tournamentId).maybeSingle(),
  ]);
  for (const r of [divisionsRes, tournamentRes]) if (r.error) throw r.error;

  const toOverlapGame = (g: ProposedGameRow, id: string): OverlapGame => ({
    id,
    gameDate: g.game_date ?? null,
    startTime: g.game_time ? String(g.game_time).slice(0, 5) : null,
    status: g.status ?? 'scheduled',
    venueId: g.diamond_id ?? null,
    venueFacilityId: g.venue_facility_id ?? null,
    scheduleFacilityLaneId: g.schedule_facility_lane_id ?? null,
    location: g.location ?? null,
    divisionId: g.division_id ?? null,
    durationMinutes: g.duration_minutes ?? null,
    isPlayoff: g.is_playoff ?? false,
    bracketCode: g.bracket_code ?? null,
    homeName: null,
    awayName: null,
    homePlaceholder: g.home_placeholder ?? null,
    awayPlaceholder: g.away_placeholder ?? null,
  });

  const stored = new Map(games.map(g => [g.id, g]));
  // A proposed row over a stored game keeps every column it does not name; one that leaves its placement as it was
  // stays in the pool as stored instead of being judged.
  const merged = proposedRows.flatMap((p, i) => {
    const before = p.id ? stored.get(p.id) : undefined;
    if (!changesPlacement(p, before)) return [];
    const defined = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as ProposedGameRow;
    return [{ row: { ...(before ?? {}), ...defined }, id: before ? before.id : (p.id || `new:${i}`) }];
  });
  if (!merged.length) return null;

  const divisions = (divisionsRes.data ?? []) as unknown as Division[];
  const tournament = (tournamentRes.data ?? null) as unknown as Tournament | null;
  const found = findRefusedOverlap({
    proposed: merged.map(m => toOverlapGame(m.row, m.id)),
    existing: games.map(g => toOverlapGame(g, g.id)),
    divisions,
    tournament,
    removedIds: opts.removedIds,
  });
  if (!found) return null;

  // A refusal names the other game ("the U11 final", "Storm vs Mustangs") and the surface in the game's own words —
  // its diamond, else its venue, else its temporary lane, else what was typed. Read only for the refusal.
  const g = found.game;
  const other = found.conflict.conflictingGame as OverlapGame;
  const otherRow = stored.get(other.id) ?? merged.find(m => m.id === other.id)?.row;
  const teamIds = [otherRow?.home_team_id, otherRow?.away_team_id].filter((x): x is string => !!x);
  const [teamsRes, facilityRes, venueRes, laneRes] = await Promise.all([
    teamIds.length ? supabaseAdmin.from('teams').select('id, name').eq('tournament_id', tournamentId).in('id', teamIds) : null,
    g.venueFacilityId ? supabaseAdmin.from('venue_facilities').select('name').eq('tournament_id', tournamentId).eq('id', g.venueFacilityId).maybeSingle() : null,
    g.venueId ? supabaseAdmin.from('diamonds').select('name').eq('tournament_id', tournamentId).eq('id', g.venueId).maybeSingle() : null,
    g.scheduleFacilityLaneId ? supabaseAdmin.from('schedule_facility_lanes').select('label').eq('tournament_id', tournamentId).eq('id', g.scheduleFacilityLaneId).maybeSingle() : null,
  ]);
  const teamName = new Map((teamsRes?.data ?? []).map(t => [t.id as string, t.name as string]));
  const named: OverlapGame = {
    ...other,
    homeName: otherRow?.home_team_id ? teamName.get(otherRow.home_team_id) ?? null : null,
    awayName: otherRow?.away_team_id ? teamName.get(otherRow.away_team_id) ?? null : null,
  };
  const noun = fieldNounFor((tournament as { sport?: string | null } | null)?.sport);
  const field = (facilityRes?.data?.name as string | undefined) || (venueRes?.data?.name as string | undefined)
    || (laneRes?.data?.label as string | undefined) || g.location?.trim() || noun;
  const words = overlapRefusalWords({ ...found.conflict, conflictingGame: named }, { field, noun, divisions, tournament });
  return {
    status: 409,
    body: { error: `${words.lead}${words.rest}`, code: 'overlap', gameId: g.id, otherGameId: other.id },
  };
}
