/**
 * lib/coach-opponents.ts
 * Opponent Scouting Book — pure logic, no I/O (unit tests: tests/unit/coach-opponents.test.ts).
 *
 * The book is an OVERLAY keyed on normalized opponent names: `rep_team_events.opponent` is
 * free text with no opponent entity anywhere (even organizer-side tournament team ids are
 * re-minted per registration), so identity is resolved at read time — normalizer first,
 * then the coach-managed alias map for the tail the normalizer can't catch ("Thunder 12U"
 * IS "Oakville Thunder"). Game rows are never written by this feature.
 *
 * Record tallies route through WRAPPED_RECORD_EVENT_TYPES — the canonical season-record
 * rule — so the book's "2–1 vs them" can never disagree with Wrapped or Insights one tap
 * away. Scrimmages are listed as meetings but never counted.
 */
import { WRAPPED_RECORD_EVENT_TYPES } from './season-wrapped';
import { tallyResults, formatRecord } from './coach-season-record';
import type { SportPack } from './sports';
import type { RepTeamOpponent } from './types';

export const OPPONENT_SUMMARY_MAX = 500;
export const OPPONENT_OBSERVATION_MAX = 500;

/**
 * The grouping key. Casefold, strip punctuation, collapse whitespace, drop a leading
 * "the ". Deliberately conservative — spelling drift beyond this is the alias table's job,
 * a coach decision, not a fuzzy matcher's guess.
 */
export function normalizeOpponentName(name: string | null | undefined): string {
  if (!name) return '';
  const collapsed = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return collapsed.startsWith('the ') ? collapsed.slice(4) : collapsed;
}

/** Decode + normalize a `[opponentKey]` URL param. '' = nothing addressable (route 404s). */
export function normalizeOpponentKeyParam(raw: string): string {
  try {
    return normalizeOpponentName(decodeURIComponent(raw));
  } catch {
    return ''; // malformed percent-encoding — same answer as an unknown opponent
  }
}

/**
 * Sport-pack-supplied observation tags (owner-ratified: fixed vocabulary, not
 * coach-editable). Keyed off pack traits rather than sport ids where possible so future
 * packs inherit something sensible.
 */
export function scoutingTagsForSport(pack: SportPack): string[] {
  if (pack.pitcherPosition) return ['Pitching', 'Hitting', 'Defense', 'Baserunning', 'Coaching'];
  if (pack.id === 'basketball') return ['Offense', 'Defense', 'Shooting', 'Rebounding', 'Coaching'];
  return ['Offense', 'Defense', 'Special situations', 'Coaching'];
}

/** The slice of an event the book needs (subset of RepTeamEvent, camelCase identical). */
export interface OpponentGameInput {
  id: string;
  name: string;
  eventType: string;
  startsAt: string;
  programYearId: string | null;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  teamScore: number | null;
  opponentScore: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  status: string;
}

export interface OpponentMeeting {
  eventId: string;
  name: string;
  eventType: string;
  startsAt: string;
  programYearId: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  teamScore: number | null;
  opponentScore: number | null;
  /** result as stored, or derived from the scores when both are present. */
  result: 'win' | 'loss' | 'tie' | null;
  /** true = counts toward the record (wrapped rule); scrimmages are always false. */
  counted: boolean;
}

export interface OpponentBookEntry {
  /** normalized name of the group's owning opponent — the URL key. */
  key: string;
  displayName: string;
  /** minted book row id, or null when the entry is aggregation-only (no writes yet). */
  opponentId: string | null;
  summary: string | null;
  lastNoteUpdatedAt: string | null;
  record: { wins: number; losses: number; ties: number };
  scrimmageCount: number;
  /** score.unit totals over counted meetings only. */
  unitFor: number;
  unitAgainst: number;
  /** e.g. "W2" — leading run of identical results over counted meetings, newest first. */
  streak: string | null;
  lastMeeting: OpponentMeeting | null;
  /** past meetings, newest first (played or scored; future scheduled games excluded). */
  meetings: OpponentMeeting[];
  observationCount: number;
}

function resolveResult(e: OpponentGameInput): 'win' | 'loss' | 'tie' | null {
  if (e.result) return e.result;
  if (e.teamScore != null && e.opponentScore != null) {
    return e.teamScore > e.opponentScore ? 'win' : e.teamScore < e.opponentScore ? 'loss' : 'tie';
  }
  return null;
}

/**
 * Group a team's game events (all seasons) into book entries, folding in minted opponent
 * rows + aliases + per-opponent observation counts. `nowIso` is passed in rather than read
 * from the clock (date-correctness guardrail — callers own "now").
 */
export function buildOpponentBook(opts: {
  events: OpponentGameInput[];
  opponents: RepTeamOpponent[];
  aliases: { opponentId: string; normalizedAlias: string }[];
  observationCounts?: Record<string, number>;
  nowIso: string;
}): OpponentBookEntry[] {
  const { events, opponents, aliases, observationCounts = {}, nowIso } = opts;
  // Epoch comparison, not string comparison: Supabase timestamptz strings ('+00:00', no ms)
  // and toISOString() ('Z', with ms) diverge after the seconds field, so lexicographic
  // ordering lies exactly at the boundary this check exists for.
  const nowMs = Date.parse(nowIso);

  const byId = new Map(opponents.map(o => [o.id, o]));
  const keyForNormalized = new Map<string, string>();
  for (const o of opponents) keyForNormalized.set(o.normalizedName, o.normalizedName);
  for (const a of aliases) {
    const target = byId.get(a.opponentId);
    if (target) keyForNormalized.set(a.normalizedAlias, target.normalizedName);
  }

  const groups = new Map<string, { meetings: OpponentMeeting[]; spellings: string[] }>();
  const ensureGroup = (key: string) => {
    let g = groups.get(key);
    if (!g) { g = { meetings: [], spellings: [] }; groups.set(key, g); }
    return g;
  };

  for (const e of events) {
    const normalized = normalizeOpponentName(e.opponent);
    if (!normalized || e.status === 'cancelled') continue;
    const key = keyForNormalized.get(normalized) ?? normalized;
    const result = resolveResult(e);
    // A meeting is a game that happened: started in the past, or already has a result.
    if (Date.parse(e.startsAt) >= nowMs && result === null) continue;
    const g = ensureGroup(key);
    g.spellings.push(e.opponent as string);
    g.meetings.push({
      eventId: e.id,
      name: e.name,
      eventType: e.eventType,
      startsAt: e.startsAt,
      programYearId: e.programYearId,
      homeAway: e.homeAway,
      teamScore: e.teamScore,
      opponentScore: e.opponentScore,
      result,
      counted: WRAPPED_RECORD_EVENT_TYPES.includes(e.eventType) && result !== null,
    });
  }
  // Minted rows with no games yet (e.g. a pre-scouted opponent) still get an entry.
  for (const o of opponents) ensureGroup(o.normalizedName);

  const entries: OpponentBookEntry[] = [];
  for (const [key, g] of groups) {
    g.meetings.sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
    const minted = opponents.find(o => o.normalizedName === key) ?? null;
    const counted = g.meetings.filter(m => m.counted);
    // One definition of how a record is tallied (lib/coach-season-record) — the book only
    // decides WHICH meetings count (the wrapped rule, via `counted`), never the arithmetic.
    const wlt = tallyResults(counted);
    const record = { wins: wlt.w, losses: wlt.l, ties: wlt.t };
    let streak: string | null = null;
    if (counted.length > 0) {
      const lead = counted[0].result;
      let run = 0;
      for (const m of counted) { if (m.result === lead) run += 1; else break; }
      streak = `${lead === 'win' ? 'W' : lead === 'loss' ? 'L' : 'T'}${run}`;
    }
    entries.push({
      key,
      // Events arrive newest-first, so spellings[0] is the MOST RECENT spelling — the one
      // an un-minted opponent should wear (a minted row's display_name always wins).
      displayName: minted?.displayName ?? g.spellings[0] ?? key,
      opponentId: minted?.id ?? null,
      summary: minted?.summary ?? null,
      lastNoteUpdatedAt: minted?.lastNoteUpdatedAt ?? null,
      record,
      scrimmageCount: g.meetings.filter(m => m.eventType === 'scrimmage').length,
      unitFor: counted.reduce((s, m) => s + (m.teamScore ?? 0), 0),
      unitAgainst: counted.reduce((s, m) => s + (m.opponentScore ?? 0), 0),
      streak,
      // The literal latest meeting — even when its score isn't entered yet. Preferring an
      // older DECIDED game here showed a stale "last met" date whenever the newest game
      // was still unscored; the consumers all render a result-less meeting gracefully.
      lastMeeting: g.meetings[0] ?? null,
      meetings: g.meetings,
      observationCount: minted ? (observationCounts[minted.id] ?? 0) : 0,
    });
  }

  entries.sort((a, b) => {
    const at = a.lastMeeting?.startsAt ?? '';
    const bt = b.lastMeeting?.startsAt ?? '';
    return at < bt ? 1 : at > bt ? -1 : a.displayName.localeCompare(b.displayName);
  });
  return entries;
}

/** "2–1" (or "2–1–1" once a tie exists) — delegates to THE record formatter
 *  (lib/coach-season-record.formatRecord) so the book can never spell a record
 *  differently than Wrapped/Insights do. */
export function recordChip(r: { wins: number; losses: number; ties: number }): string {
  return formatRecord({ w: r.wins, l: r.losses, t: r.ties });
}

/** Chip tone for a record — one definition beside recordChip, not three inline ternaries. */
export function recordTone(r: { wins: number; losses: number; ties: number }): 'up' | 'down' | 'even' {
  return r.wins > r.losses ? 'up' : r.wins < r.losses ? 'down' : 'even';
}

/** W / L / T single-letter form; `fallback` renders an unresolved result. */
export function resultLetter(r: 'win' | 'loss' | 'tie' | null, fallback = '·'): string {
  return r === 'win' ? 'W' : r === 'loss' ? 'L' : r === 'tie' ? 'T' : fallback;
}

/** "Is there anything written about them?" — the amber-dot / "in the book" rule. */
export function hasBookContent(e: { summary: string | null; observationCount: number }): boolean {
  return e.summary != null || e.observationCount > 0;
}

/** "Have we actually played them?" — list/tile visibility rule for aggregation-only entries. */
export function hasMeetings(e: { meetings: readonly unknown[] }): boolean {
  return e.meetings.length > 0;
}
