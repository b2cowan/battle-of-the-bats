/**
 * THE SERVER'S HALF OF THE OVERLAP RULE (Tournament admin redesign Stage 3, A37) AND OF THE GAME-ORDER RULE (Public
 * tournament Stage 9, A1–A12). Every games writer calls this BEFORE its first write: the game window's save, Add game,
 * the timeline's drop and the phone's move sheet (`update`), Reinstate (`revert-to-scheduled`), both generators
 * (`bulk-save`, `replace-division-round-robin`, `replace-division-playoffs`), the bracket editor (`save-bracket`), the
 * rain delay and its Undo (`bulk-reschedule`, `bulk-restore`), the CSV import's commit, the typed-locations resolver
 * and its Undo, and the temporary lanes' resolve; a division's or the event's default game length calls
 * `tournamentLengthOrderRefusal` below. `tests/unit/game-writers-guard.test.ts` fails the build when a writer skips it.
 * The rules and their words are `lib/tournament-overlap.ts` and `lib/game-order.ts` — the screens refuse the same
 * thing first; this is what refuses a save that slips past them (a stale screen, a second admin, a direct request).
 *
 * It reads the tournament's games as they stand, so a refusal is always about the schedule the database holds. A
 * refusal is a 409 with the sentence the field would have said, and nothing is written (so no change notice goes out).
 * An overlap wins when one save makes both (A12). Club bookings never refuse (Club Tier 6a's line, reported after the
 * save).
 */
import { supabaseAdmin } from './supabase-admin';
import type { Division, Tournament } from './types';
import { fieldNounFor } from './sports';
import { findRefusedOverlap, overlapRefusalWords, type OverlapGame } from './tournament-overlap.ts';
import { gameLengthMinutes } from './booking-length.ts';
import { newOrderProblems, orderLengthsOf, type OrderGame, type OrderLengths } from './game-order.ts';
import { orderRefusalWords, type OrderDoor, type OrderField, type OrderWordsGame } from './game-order-words.ts';
import { GAME_WINDOW_WORDS as G, teamOrSlotWords } from './schedule-words.ts';

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
  bracket_id?: string | null;
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
/**
 * The columns that say what a game WAITS FOR (Stage 9): a write that re-wires a game without moving it can still put
 * it out of order. They trigger a judgement but are not placing columns: re-wiring a game never re-judges an overlap
 * that predates it (the overlap's own rule, `changesPlacement`); the order judgement is before/after, so it needs none.
 */
const ORDER_COLUMNS = ['home_placeholder', 'away_placeholder', 'bracket_code', 'bracket_id', 'is_playoff', 'division_id'] as const;
/** Whether a write can make an overlap or put a game out of order, so a writer must ask the guard first. */
export const placesAGame = (updates: Record<string, unknown>) =>
  PLACING_COLUMNS.some(c => c in updates) || ORDER_COLUMNS.some(c => c in updates);

const GAME_COLUMNS = 'id, division_id, game_date, game_time, duration_minutes, diamond_id, venue_facility_id, location, schedule_facility_lane_id, status, is_playoff, bracket_id, bracket_code, home_team_id, away_team_id, home_placeholder, away_placeholder';
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
const placingValue = (column: string, v: unknown) =>
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

const changed = (p: ProposedGameRow, s: ProposedGameRow | undefined, cols: readonly (keyof ProposedGameRow)[]) =>
  !!s && cols.some(c => p[c] !== undefined && placingValue(c, p[c]) !== placingValue(c, s[c]));

/** Which of the game window's fields an edit changed, for the order refusal's words (tab 3). */
function orderFieldOf(p: ProposedGameRow | undefined, s: ProposedGameRow | undefined): OrderField {
  if (!p || !s) return 'when';
  if (changed(p, s, ['game_date', 'game_time', 'status'])) return 'when';
  if (changed(p, s, ['duration_minutes'])) return 'length';
  if (changed(p, s, ['home_placeholder', 'away_placeholder', 'bracket_code', 'bracket_id'])) return 'sources';
  return 'when';
}

type StoredGame = ProposedGameRow & { id: string };

/** Everything both rules read: the games as they stand, and the length rules (division, then tournament). */
async function readSchedule(tournamentId: string) {
  const [games, divisionsRes, tournamentRes] = await Promise.all([
    readAll<StoredGame>((a, b) => supabaseAdmin.from('games').select(GAME_COLUMNS)
      .eq('tournament_id', tournamentId).order('id').range(a, b)),
    supabaseAdmin.from('divisions').select('id, name, settings').eq('tournament_id', tournamentId),
    supabaseAdmin.from('tournaments').select('id, sport, settings').eq('id', tournamentId).maybeSingle(),
  ]);
  for (const r of [divisionsRes, tournamentRes]) if (r.error) throw r.error;
  return {
    games,
    divisions: (divisionsRes.data ?? []) as unknown as Division[],
    tournament: (tournamentRes.data ?? null) as unknown as Tournament | null,
  };
}

type Schedule = Awaited<ReturnType<typeof readSchedule>>;

const lengthsOf = (s: Schedule): OrderLengths => orderLengthsOf(s.divisions, s.tournament);

const toOrderGame = (g: ProposedGameRow, id: string): OrderGame => ({
  id,
  divisionId: g.division_id ?? null,
  bracketId: g.bracket_id ?? null,
  bracketCode: g.bracket_code ?? null,
  isPlayoff: !!g.is_playoff,
  status: g.status ?? 'scheduled',
  date: g.game_date ?? null,
  time: g.game_time ? String(g.game_time).slice(0, 5) : null,
  durationMinutes: typeof g.duration_minutes === 'number' ? g.duration_minutes : null,
  homePlaceholder: g.home_placeholder ?? null,
  awayPlaceholder: g.away_placeholder ?? null,
});

export type OrderRefusalBody = { error: string; code: 'game-order'; gameId: string; otherGameId: string; field: OrderField };
export type OverlapRefusalBody = { error: string; code: 'overlap'; gameId: string; otherGameId: string };
export type GameWriteRefusal = { status: 409; body: OverlapRefusalBody | OrderRefusalBody };

export interface GameWriteGuardOptions {
  /** Games the same write deletes (they free their diamonds, and wait for nothing). */
  removedIds?: Iterable<string>;
  /** Which door is asking, for the order refusal's way out (tab 6). Defaults to the game window's when one stored
   *  game is written, else to naming the pair. */
  door?: OrderDoor;
}

/** The order refusal's words, naming each game the way the schedule does (team names read only for the refusal). */
async function orderRefusal(
  tournamentId: string,
  schedule: Schedule,
  after: Map<string, ProposedGameRow>,
  problems: ReturnType<typeof newOrderProblems>,
  opts: { door: OrderDoor; editedId?: string | null; field?: OrderField; lengths: OrderLengths; length?: { minutes: number; was: number } },
): Promise<GameWriteRefusal> {
  const involved = new Set(problems.flatMap(p => [p.sourceId, p.dependentId]));
  const teamIds = [...involved].flatMap(id => [after.get(id)?.home_team_id, after.get(id)?.away_team_id])
    .filter((x): x is string => !!x);
  const teamsRes = teamIds.length
    ? await supabaseAdmin.from('teams').select('id, name').eq('tournament_id', tournamentId).in('id', [...new Set(teamIds)])
    : null;
  const teamName = new Map((teamsRes?.data ?? []).map(t => [t.id as string, t.name as string]));
  const divisionName = new Map(schedule.divisions.map(d => [d.id, d.name]));
  const games = new Map<string, OrderWordsGame>([...involved].map(id => {
    const row = after.get(id)!;
    const name = (teamId: string | null | undefined) => (teamId ? teamName.get(teamId) ?? null : null);
    return [id, {
      ...toOrderGame(row, id),
      divisionName: row.division_id ? divisionName.get(row.division_id) ?? null : null,
      matchup: G.vs(teamOrSlotWords(name(row.away_team_id), row.away_placeholder), teamOrSlotWords(name(row.home_team_id), row.home_placeholder)),
    }];
  }));
  const w = orderRefusalWords({
    problems, games, door: opts.door, editedId: opts.editedId, field: opts.field, lengths: opts.lengths, length: opts.length,
  });
  return {
    status: 409,
    body: { error: `${w.lead}${w.rest}`, code: 'game-order', gameId: w.gameId, otherGameId: w.otherGameId, field: opts.field ?? 'when' },
  };
}

/**
 * The refusal for these writes, or null: an overlap first (A12), then a game out of order that this write CREATES
 * (A2). `removedIds` are games the same write deletes. New games may carry any id the caller likes (`new:0`, …) — it
 * only names them inside the batch.
 */
export async function tournamentOverlapRefusal(
  tournamentId: string,
  proposedRows: readonly ProposedGameRow[],
  opts: GameWriteGuardOptions = {},
): Promise<GameWriteRefusal | null> {
  if (!proposedRows.length) return null;
  const schedule = await readSchedule(tournamentId);
  const { games, divisions, tournament } = schedule;

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
  // Every proposed row over its stored game, keeping every column it does not name.
  const all = proposedRows.map((p, i) => {
    const before = p.id ? stored.get(p.id) : undefined;
    const defined = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as ProposedGameRow;
    return { proposed: p, before, row: { ...(before ?? {}), ...defined }, id: before ? before.id : (p.id || `new:${i}`) };
  });

  // THE OVERLAP: a row that leaves its placement as it was stays in the pool as stored instead of being judged.
  const merged = all.filter(m => changesPlacement(m.proposed, m.before));
  const found = merged.length ? findRefusedOverlap({
    proposed: merged.map(m => toOverlapGame(m.row, m.id)),
    existing: games.map(g => toOverlapGame(g, g.id)),
    divisions,
    tournament,
    removedIds: opts.removedIds,
  }) : null;

  if (found) {
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

  // THE ORDER (Stage 9): the whole schedule before this write and after it; refused only for a pair it creates.
  const removed = new Set(opts.removedIds ?? []);
  const after = new Map<string, ProposedGameRow>(games.filter(g => !removed.has(g.id)).map(g => [g.id, g]));
  for (const m of all) after.set(m.id, m.row);
  const lengths = lengthsOf(schedule);
  const problems = newOrderProblems(
    games.map(g => toOrderGame(g, g.id)),
    [...after].map(([id, row]) => toOrderGame(row, id)),
    lengths,
  );
  if (!problems.length) return null;
  // One game written (the game window, a drop, Add game, Reinstate) speaks from that game's side.
  const single = all.length === 1 ? all[0] : null;
  return orderRefusal(tournamentId, schedule, after, problems, {
    door: opts.door ?? (single ? 'game' : 'pair'),
    editedId: single?.id ?? null,
    field: orderFieldOf(single?.proposed, single?.before),
    lengths,
  });
}

/**
 * A8: a division's or the event's default game length, refused like any other door when the new length makes a pair
 * out of order (every game without a length of its own ends at its start + the new default). `divisionId` null = the
 * event's default.
 */
export async function tournamentLengthOrderRefusal(
  tournamentId: string,
  change: { divisionId: string | null; minutes: number | null },
): Promise<{ status: 409; body: OrderRefusalBody } | null> {
  const schedule = await readSchedule(tournamentId);
  const before = lengthsOf(schedule);
  const divisionMinutes = new Map(before.divisionMinutes as Map<string, unknown>);
  const afterLengths: OrderLengths = change.divisionId
    ? { divisionMinutes: new Map(divisionMinutes).set(change.divisionId, change.minutes), eventMinutes: before.eventMinutes }
    : { divisionMinutes, eventMinutes: change.minutes };
  const games = schedule.games.map(g => toOrderGame(g, g.id));
  const problems = newOrderProblems(games, games, afterLengths, before);
  if (!problems.length) return null;
  // The default each side reads, by the one chain under a game's own length ("At 120 min … or keep 90 min").
  const length = change.divisionId
    ? { minutes: gameLengthMinutes(change.minutes, before.eventMinutes), was: gameLengthMinutes(divisionMinutes.get(change.divisionId), before.eventMinutes) }
    : { minutes: gameLengthMinutes(change.minutes), was: gameLengthMinutes(before.eventMinutes) };
  const refusal = await orderRefusal(tournamentId, schedule, new Map(schedule.games.map(g => [g.id, g])), problems, {
    door: 'length-default',
    lengths: afterLengths,
    length,
  });
  return refusal as { status: 409; body: OrderRefusalBody };
}
