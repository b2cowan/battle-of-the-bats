import type { RepTeamEvent } from './types';
import { toMinute, toDay } from './tournament-game-mirror';
import { formatInOrgZone } from './timezone';

export { toMinute };

/**
 * lib/coach-tournament-games.ts — client-side helpers for MIRRORED tournament games
 * (Coach Portal Batch 4, P0 #2). Pure functions + the two bits of device memory they read.
 *
 * TWO JOBS, both of which exist because the organizer can change a game underneath a coach who
 * has already prepared for it:
 *
 *  1. "MOVED" — telling the coach a game they'd already seen has been rescheduled. The lineup and
 *     attendance ride along automatically (they attach to the game, not to its time slot), so
 *     nothing is lost — but "nothing broke" is not the same as "the coach knows". This is kept in
 *     DEVICE memory rather than a column on purpose: the honest question is "has this moved since
 *     *I* last looked", which is per-person, and a coach who has never seen the old time should
 *     see no marker at all. Same localStorage pattern as the Batch 3 winding-down cue.
 *
 *  2. DUPLICATES — coaches worked around the missing tools by typing their tournament games in by
 *     hand. Once the real ones arrive those teams have two rows for one game, and BOTH count
 *     toward the record. We surface the collision and offer a one-tap fix; we never merge or
 *     delete on a guess, because the coach's copy may carry real attendance and a real lineup.
 */

/**
 * Event types that are a GAME (as opposed to a practice, a team event, or a multi-day tournament
 * container). Exported so the coach surfaces stop re-declaring the same literal — it was written
 * out independently in nine places before this. Distinct from `WRAPPED_RECORD_EVENT_TYPES`
 * (lib/season-wrapped.ts), which answers "does this count toward the record" and therefore
 * excludes scrimmages and includes the legacy `external_tournament`.
 */
export const COACH_GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];

/**
 * Whether this event is a MIRRORED tournament game — an organizer-owned row (Batch 4). ONE named
 * predicate rather than a bare null-check repeated at a dozen call sites, matching the
 * `resolveClosedAssignment` precedent: when "mirrored" needs a second condition, it changes here.
 * Deliberately dependency-free so the server-side route guards can import it too.
 */
export function isMirroredEvent(
  event: Pick<RepTeamEvent, 'sourceTournamentGameId'> | null | undefined,
): boolean {
  return Boolean(event?.sourceTournamentGameId);
}

const seenKey = (teamId: string) => `flhq-coach-tgame-seen:${teamId}`;
const dismissedKey = (teamId: string) => `flhq-coach-tgame-dupe:${teamId}`;

/** eventId → the wall-clock minute this device last showed the coach. */
export type SeenTimes = Record<string, string>;

export interface MovedGame {
  eventId: string;
  /** The wall-clock minute this device last showed — what "moved from" names. */
  previous: string;
  /** True when the calendar DAY changed, not just the clock — the case where attendance replies
   *  were given for a different day and are worth re-checking. */
  dayChanged: boolean;
}

/**
 * Compare the mirrored games on screen against what this device last showed.
 *
 * Returns the moves to flag AND the memory to persist. First sight is recorded but never flagged
 * (a coach who never saw the old time was not misled by it); a flagged move is only cleared when
 * the coach opens the game, via `acknowledgeSeen`.
 */
export function diffSeenTimes(
  events: Pick<RepTeamEvent, 'id' | 'startsAt' | 'sourceTournamentGameId'>[],
  seen: SeenTimes,
): { moved: MovedGame[]; nextSeen: SeenTimes } {
  const moved: MovedGame[] = [];
  const nextSeen: SeenTimes = {};
  for (const event of events) {
    if (!isMirroredEvent(event)) continue;
    const now = toMinute(event.startsAt);
    const previous = seen[event.id];
    if (previous === undefined) {
      nextSeen[event.id] = now;      // first sight — remember it, say nothing
      continue;
    }
    nextSeen[event.id] = previous;   // keep the old value until the coach acknowledges
    if (previous !== now) {
      moved.push({ eventId: event.id, previous, dayChanged: toDay(previous) !== toDay(now) });
    }
  }
  return { moved, nextSeen };        // events no longer present drop out — the map stays bounded
}

export function readSeenTimes(teamId: string): SeenTimes {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(seenKey(teamId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as SeenTimes) : {};
  } catch { return {}; }
}

/**
 * Persist the seen-times map. MERGES against whatever is in storage at write time rather than
 * overwriting: two tabs open on the same team both read-modify-write this one key, and a blind
 * overwrite would revert the other tab's acknowledgement — re-flagging "Moved" on a game the coach
 * has already opened. Merging keeps the LATER of the two remembered times per event, which is
 * always the more-acknowledged one.
 */
export function writeSeenTimes(teamId: string, value: SeenTimes): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readSeenTimes(teamId);
    const merged: SeenTimes = { ...value };
    for (const [eventId, at] of Object.entries(current)) {
      // Only for events this write knows about — an event absent from `value` is gone from the
      // calendar and should drop out, which is how the map stays bounded.
      if (eventId in merged && at > merged[eventId]) merged[eventId] = at;
    }
    window.localStorage.setItem(seenKey(teamId), JSON.stringify(merged));
  } catch { /* private mode */ }
}

/** The coach opened the game — they've seen the new time, so the marker retires. */
export function acknowledgeSeen(teamId: string, eventId: string, startsAt: string): void {
  const seen = readSeenTimes(teamId);
  seen[eventId] = toMinute(startsAt);
  writeSeenTimes(teamId, seen);
}

// ── Naming an event ───────────────────────────────────────────────────────────

/**
 * The matchup suffix for a game — "· vs Lady Jays" / "· @ Lady Jays" — appended ONLY when the
 * event's own name doesn't already carry the opponent (games auto-name from it, so most do).
 * One rule, because it was written twice with a trim on one side and not the other.
 */
export function opponentSuffix(event: Pick<RepTeamEvent, 'name' | 'opponent' | 'homeAway'>): string {
  const opponent = event.opponent?.trim();
  if (!opponent || event.name.toLowerCase().includes(opponent.toLowerCase())) return '';
  return ` · ${event.homeAway === 'away' ? '@' : 'vs'} ${opponent}`;
}

/** An event's full display label — its name plus the matchup suffix when one applies. */
export function eventDisplayTitle(event: Pick<RepTeamEvent, 'name' | 'opponent' | 'homeAway'>): string {
  return `${event.name}${opponentSuffix(event)}`;
}

/** "Sat May 16 · 9:00 a.m." — the portal's standard one-line when.
 *  Rendered in the ORG'S zone (C0): a stored event time is an instant, and the only clock that
 *  means anything for it is the one at the field. */
export function formatEventWhen(startsAt: string): string {
  const day = formatInOrgZone(startsAt, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = formatInOrgZone(startsAt, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/**
 * The event a coach should act on next: the soonest upcoming one, or — when the season's events
 * are all behind them — the most recent. Returns null when there is nothing of the wanted types.
 * `now` is passed in so callers stay render-safe (no `Date.now()` in a render body).
 */
export function pickNextOrMostRecent(
  events: RepTeamEvent[],
  opts: { types: string[]; now: number },
): RepTeamEvent | null {
  const eligible = events.filter(e => e.status !== 'cancelled' && opts.types.includes(e.eventType));
  // ⚠ Compared as instants, not as strings — the same rule as `splitUpcomingAndRecent` below, which
  // this function sat beside comparing `startsAt.localeCompare` until 2026-08-16. A lexicographic
  // compare only agrees with a chronological one while every row carries the same timestamp shape,
  // which is a property of the serializer rather than of this list: one row arriving with an offset
  // (`+00:00`) or without milliseconds is enough to pick the wrong game for the coach to act on.
  const at = (e: RepTeamEvent) => new Date(e.startsAt).getTime();
  const upcoming = eligible.filter(e => at(e) >= opts.now).sort((a, b) => at(a) - at(b));
  if (upcoming.length > 0) return upcoming[0];
  const past = eligible.slice().sort((a, b) => at(b) - at(a));
  return past[0] ?? null;
}

/**
 * The two lists an "which of my events still need X?" hub shows: what's still to come (soonest
 * first) and what's just been (most recent first, capped).
 *
 * ⚠ ONE definition, shared by the Lineups hub and the Practice plans hub. It was written twice,
 * character for character, before the second hub existed — which put the cap, the cancelled-status
 * handling and the "upcoming means scheduled AND not yet started" rule in two places with nothing
 * keeping them in step. Filtering by event TYPE is deliberately the caller's job: the two hubs
 * disagree about which events they are for, and only about that.
 *
 * `now` is passed in so callers stay render-safe (no `Date.now()` in a render body).
 */
export function splitUpcomingAndRecent<T extends Pick<RepTeamEvent, 'startsAt' | 'status'>>(
  events: T[],
  opts: { now: number; recentCap?: number },
): { upcoming: T[]; recent: T[] } {
  const live = events.filter(e => e.status !== 'cancelled');
  // A past-dated event still marked `scheduled` is behind the coach, and a cancelled-then-restored
  // one is not "upcoming" until it says `scheduled` again — both halves matter.
  const isUpcoming = (e: T) => new Date(e.startsAt).getTime() >= opts.now && e.status === 'scheduled';
  // ⚠ Compared as instants, not as strings. Both hubs did it this way before the extraction, and a
  // lexicographic compare only agrees with a chronological one while every row carries the same
  // timestamp shape — which is a property of the serializer, not of this list.
  const at = (e: T) => new Date(e.startsAt).getTime();
  return {
    upcoming: live.filter(isUpcoming).sort((a, b) => at(a) - at(b)),
    recent: live.filter(e => !isUpcoming(e))
      .sort((a, b) => at(b) - at(a))
      .slice(0, opts.recentCap ?? 6),
  };
}

// ── Duplicate detection ───────────────────────────────────────────────────────

/**
 * Words worth matching a team name on, in order. Short tokens ("vs", "the", "u14") and the
 * event-type filler that auto-naming adds ("Tournament Game vs …") make false pairs.
 */
function opponentTokens(...parts: (string | null | undefined)[]): string[] {
  const tokens: string[] = [];
  for (const part of parts) {
    for (const raw of (part ?? '').toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length >= 4 && raw !== 'game' && raw !== 'tournament' && !tokens.includes(raw)) {
        tokens.push(raw);
      }
    }
  }
  return tokens;
}

/**
 * Do these two team names refer to the same club? Matches on the LEADING significant word, not any
 * shared word — youth clubs share generic tails constantly ("Kanata United" vs "Barrhaven United"
 * are different teams), and flagging those as duplicates would nag a coach to delete a game that
 * isn't one. A false negative just means no notice; a false positive points at real work.
 */
function sameClub(a: string[], b: string[]): boolean {
  return a.length > 0 && b.length > 0 && a[0] === b[0];
}

export interface DuplicateGamePair {
  /** The mirrored (organizer-owned) game. */
  mirrorId: string;
  /** The coach's own hand-entered game — the one they can remove. */
  ownId: string;
  key: string;
}

/**
 * Find a coach's self-entered game that looks like the same fixture as a mirrored one: the same
 * calendar day, both game-type, both live, and a shared opponent word. Conservative on purpose —
 * a false pair nags a coach about two genuinely different games, so a bare "Game" with no opponent
 * never matches anything.
 */
export function findDuplicateSelfEntries(events: RepTeamEvent[]): DuplicateGamePair[] {
  const live = events.filter(e => e.status !== 'cancelled' && COACH_GAME_EVENT_TYPES.includes(e.eventType));
  const mirrored = live.filter(isMirroredEvent);
  const own = live.filter(e => !isMirroredEvent(e));
  if (mirrored.length === 0 || own.length === 0) return [];

  // Tokenise each of the coach's games ONCE, not once per (mirror, own) pair. The opponent leads
  // the token list so a self-entered game named "Tournament Game vs Kanata" with the opponent
  // field blank still leads with the club name.
  const ownTokens = own.map(e => ({ event: e, tokens: opponentTokens(e.opponent, e.name) }));
  const pairs: DuplicateGamePair[] = [];
  const usedOwn = new Set<string>();
  for (const mirror of mirrored) {
    const day = toDay(mirror.startsAt);
    const mirrorTokens = opponentTokens(mirror.opponent);
    if (mirrorTokens.length === 0) continue;
    const match = ownTokens.find(candidate =>
      !usedOwn.has(candidate.event.id) &&
      toDay(candidate.event.startsAt) === day &&
      sameClub(candidate.tokens, mirrorTokens),
    );
    if (!match) continue;
    usedOwn.add(match.event.id);
    pairs.push({ mirrorId: mirror.id, ownId: match.event.id, key: `${mirror.id}|${match.event.id}` });
  }
  return pairs;
}

export function readDismissedDuplicates(teamId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(dismissedKey(teamId));
    const parsed = raw ? JSON.parse(raw) : null;
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch { return new Set(); }
}

/** "Keep both" is a real answer, and it is remembered per pair. */
export function dismissDuplicate(teamId: string, key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const next = readDismissedDuplicates(teamId);
    next.add(key);
    window.localStorage.setItem(dismissedKey(teamId), JSON.stringify([...next]));
  } catch { /* private mode */ }
}
