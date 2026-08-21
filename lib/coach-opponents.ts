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
import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { tallyResults, formatRecord } from './coach-season-record';
import type { SportPack } from './sports';
import type { RepTeamOpponent } from './types';

export const OPPONENT_SUMMARY_MAX = 500;
export const OPPONENT_OBSERVATION_MAX = 500;

/**
 * The grouping key — re-exported from `lib/opponent-name-key.ts`, which holds the rule itself.
 *
 * ⚠ It lives in a dependency-free leaf module so the demo seeders (Node type-stripping, which
 * cannot resolve this file's extensionless imports) can use the SAME function rather than
 * re-typing it. Every existing caller keeps importing it from here.
 */
import { normalizeOpponentName } from './opponent-name-key';
export { normalizeOpponentName };

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
  /**
   * Every merged-away spelling that resolves to this entry. Client lookups keyed on an
   * event's own normalized opponent name (the schedule's record chips) must consult these
   * too — an aliased spelling's events are folded in server-side, but the event string a
   * row renders from still normalizes to the ALIAS, not the owning key.
   */
  aliasKeys: string[];
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
  const aliasKeysByOwner = new Map<string, string[]>();
  for (const o of opponents) keyForNormalized.set(o.normalizedName, o.normalizedName);
  for (const a of aliases) {
    const target = byId.get(a.opponentId);
    if (!target) continue;
    keyForNormalized.set(a.normalizedAlias, target.normalizedName);
    const list = aliasKeysByOwner.get(target.normalizedName) ?? [];
    list.push(a.normalizedAlias);
    aliasKeysByOwner.set(target.normalizedName, list);
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
      aliasKeys: aliasKeysByOwner.get(key) ?? [],
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

// ── Practice-week bridge (P3, plan §4.9) ────────────────────────────────────────────────

export interface PracticeWeekGameCandidate {
  id: string;
  eventType: string;
  startsAt: string;
  opponent: string | null;
  status: string;
}

/**
 * The game a practice prepares for: the SOONEST game at-or-after the practice within 6
 * calendar days (the masthead nudge's own "game week" window), carrying a real opponent
 * name. A TBD bracket slot or a cancelled game never anchors the bridge, and a game already
 * played before the practice is not something Tuesday can prepare for.
 *
 * `daysBetween` is injected (callers pass lib/timezone's `calendarDaysBetween`) so the
 * window is counted in the ORG's zone — the date-correctness guardrail — while this file
 * stays pure and unit-testable without a timezone dependency.
 */
export function pickPracticeWeekOpponentGame(
  practiceStartsAt: string,
  events: PracticeWeekGameCandidate[],
  daysBetween: (from: Date, to: Date) => number,
): PracticeWeekGameCandidate | null {
  const practiceMs = Date.parse(practiceStartsAt);
  const candidates = events
    .filter(e =>
      e.status !== 'cancelled' &&
      COACH_GAME_EVENT_TYPES.includes(e.eventType) &&
      normalizeOpponentName(e.opponent) !== '' &&
      Date.parse(e.startsAt) >= practiceMs &&
      daysBetween(new Date(practiceStartsAt), new Date(e.startsAt)) <= 6,
    )
    // Epoch comparison, not string comparison — same reason as buildOpponentBook's nowMs:
    // timestamptz serializations diverge after the seconds field.
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return candidates[0] ?? null;
}

// ── Merge ("Same team as…", P2) ─────────────────────────────────────────────────────────

/**
 * The loser's book line survives a merge as a LABELLED appendix to the winner's — merging
 * identities must never silently discard a coach's words. Returns the winner's summary
 * untouched when the loser had none (undefined = "no write needed").
 */
export function mergeSummaries(
  winnerSummary: string | null, loserSummary: string | null, loserLabel: string,
): string | undefined {
  if (!loserSummary) return undefined;
  const appendix = `[${loserLabel}] ${loserSummary}`;
  // Idempotence under RETRY: a merge that failed between its summary write and its
  // loser-row delete leaves the winner already carrying this appendix; the coach's only
  // recovery is clicking Merge again, and a blind re-append would silently duplicate
  // their words in the book line.
  if (winnerSummary?.includes(appendix)) return undefined;
  const merged = winnerSummary ? `${winnerSummary}\n${appendix}` : appendix;
  return merged.slice(0, OPPONENT_SUMMARY_MAX);
}

export interface OpponentMergePlan {
  /** Loser row to fold in: re-point its observations + aliases, then delete it. Null = the
   *  loser was never minted, so only the alias row is needed. */
  absorbOpponentId: string | null;
  /** The spelling that becomes an alias of the winner (the loser's normalized name). */
  aliasToInsert: string;
  /** Winner's post-merge book line; undefined = leave it untouched. */
  mergedSummary: string | undefined;
}

/**
 * What a merge DOES, decided pure so the round-trip is unit-testable: the db helper only
 * executes this plan. Returns null when the pair is not mergeable (same entry, or the
 * loser already resolves to the winner).
 */
export function planOpponentMerge(opts: {
  winner: { id: string; normalizedName: string; summary: string | null };
  loser: { id: string; normalizedName: string; summary: string | null; displayName: string } | null;
  /** The picker key the coach chose — used when the loser was never minted. */
  loserKey: string;
}): OpponentMergePlan | null {
  const { winner, loser, loserKey } = opts;
  const aliasToInsert = loser?.normalizedName ?? loserKey;
  if (!aliasToInsert || aliasToInsert === winner.normalizedName) return null;
  if (loser && loser.id === winner.id) return null;
  return {
    absorbOpponentId: loser?.id ?? null,
    aliasToInsert,
    mergedSummary: loser ? mergeSummaries(winner.summary, loser.summary, loser.displayName) : undefined,
  };
}

// ── Staff-chat game-plan snapshot (P2) ──────────────────────────────────────────────────

/**
 * The message "Share to staff chat" posts — a SNAPSHOT, deliberately: later book edits
 * must never rewrite chat history. Sections render only when they have content (the
 * Ask-the-Front-Office honesty rule: nothing hedged, nothing padded). Pure and capped so
 * the format is unit-testable and can never exceed the chat layer's message limit.
 */
export function formatGamePlanSnapshot(opts: {
  displayName: string;
  record: { wins: number; losses: number; ties: number };
  lastMeeting: { result: 'win' | 'loss' | 'tie' | null; teamScore: number | null; opponentScore: number | null } | null;
  summary: string | null;
  /** Newest first, as the card serves them. */
  observations: { body: string; tag: string | null }[];
  insights: { text: string; fromGames: number }[];
  /** The chat layer's cap (lib/chat-service MAX_MESSAGE_LENGTH). */
  maxLength: number;
}): string {
  const { displayName, record, lastMeeting, summary, insights, maxLength } = opts;

  const headBits = [`All-time ${recordChip(record)}`];
  if (lastMeeting?.result && lastMeeting.teamScore != null && lastMeeting.opponentScore != null) {
    headBits.push(`Last meeting ${resultLetter(lastMeeting.result)} ${lastMeeting.teamScore}–${lastMeeting.opponentScore}`);
  }

  const build = (obsShown: number) => {
    const lines: string[] = [`Game plan — vs ${displayName}`, headBits.join(' · ')];
    if (summary) lines.push('', 'The book line', summary);
    if (insights.length > 0) {
      lines.push('', 'The numbers');
      for (const i of insights) lines.push(`• ${i.text} (from ${i.fromGames} games)`);
    }
    if (obsShown > 0) {
      lines.push('', 'Observations');
      for (const o of opts.observations.slice(0, obsShown)) {
        lines.push(`• ${o.tag ? `[${o.tag}] ` : ''}${o.body}`);
      }
      const hidden = opts.observations.length - obsShown;
      if (hidden > 0) lines.push(`(+${hidden} more in the book)`);
    }
    return lines.join('\n');
  };

  // Recent-first and bounded: 8 observations is a briefing, 40 is a wall. If even the
  // bounded snapshot overruns the chat cap (500-char observations can), shed observations
  // before truncating anyone's words mid-sentence.
  let shown = Math.min(opts.observations.length, 8);
  let message = build(shown);
  while (message.length > maxLength && shown > 0) message = build(--shown);
  return message.length > maxLength ? `${message.slice(0, maxLength - 1)}…` : message;
}
