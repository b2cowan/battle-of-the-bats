import { normalizeGuardianEmail } from './guardian-email';
import type { LeagueGame, LeagueGameStatus } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CHANGES TO SEND, PURE (House League Stage 9d-2b Part 1; frames f1, f2, f5; rulings 9d2·9, ·10, ·16 and 9d2b·D, plan
 * HOUSE_LEAGUE_STAGE9_PLAN.md §0h; mig 409). The rows come from `league_game_changes`, which the `league_games` trigger
 * writes for every change to a published division's game.
 *
 * ⚖ WHAT A SEND SAYS IS THE NET EFFECT: the game as families last heard it (the earliest held row's `before`; null for a
 * game added since) against the game now. A game moved twice reads once; added then cancelled reads nothing; moved and
 * moved back reads nothing. A score or a note is never news (the trigger records neither), and a game played since is
 * never emailed ("This game has already been played").
 * ⚖ UNTIL THE SEND, FAMILIES SEE WHAT THEY LAST HEARD (9d2·16): the public page and the coach's page read
 * `lastSentView` — the earliest held `before`, nothing for a game added since, and the game as it is once it is played
 * (a result is a record, never held).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The fields a family reads (`league_game_snapshot()` in mig 409; the keys are the SQL's). */
export interface GameSnapshot {
  scheduledAt: string | null;
  endsAt: string | null;
  location: string | null;
  venueId: string | null;
  facilityId: string | null;
  status: LeagueGameStatus;
  movedFrom: string | null;
}

export type ChangeKind = 'added' | 'moved' | 'place' | 'cancelled' | 'postponed' | 'given_date' | 'back_on';

export interface HeldChange {
  id: string;
  gameId: string;
  kind: ChangeKind;
  before: GameSnapshot | null;
  after: GameSnapshot;
  source: 'league' | 'club';
  createdAt: string;
}

/** What a family hears about one game: the net of every held change on it. */
export interface NetChange {
  gameId: string;
  kind: ChangeKind;
  /** As families last heard it; null for a game added since. */
  before: GameSnapshot | null;
  now: GameSnapshot;
  /** The club moved the division's time (9d2·13): the tray's "The club moved …" line. */
  byClub: boolean;
  changeIds: string[];
}

export interface HeldGame {
  gameId: string;
  changeIds: string[];
  /** What families will hear, or null: nothing net (moved back, added then cancelled) or `played`. */
  news: NetChange | null;
  /** Played since its change: listed, never emailed. */
  played: boolean;
}

/** Whether a game is on, as a family hears it: played and scheduled are both on (a score is not news). */
export const publicState = (s: LeagueGameStatus) => (s === 'cancelled' ? 'cancelled' : s === 'postponed' ? 'postponed' : 'on');

export const sameMs = (a: string | null, b: string | null) => (a == null || b == null ? a === b : Date.parse(a) === Date.parse(b));
export const placeDiffers = (a: GameSnapshot, b: GameSnapshot) =>
  (a.location ?? null) !== (b.location ?? null) || (a.venueId ?? null) !== (b.venueId ?? null) || (a.facilityId ?? null) !== (b.facilityId ?? null);

/**
 * ⚖ "LINK BOTH" IS NOT NEWS (Club Website Stage 2, K7). The closure press links a typed-in game to the place named in its
 * typed text with the recorder told to keep quiet (mig 539, `league.quiet_link`), so that link has NO held row. It shows
 * as a GAP: from one row's `after` to the next row's `before` (or to the game now), the place id appears and nothing
 * else changed. Every other link is a recorded row and stays news. Read from the rows themselves, so no place name is
 * needed and a place renamed since changes nothing.
 */
export const isQuietLink = (a: GameSnapshot, b: GameSnapshot) =>
  a.venueId == null && a.facilityId == null && b.venueId != null && b.facilityId == null && (a.location ?? null) === (b.location ?? null);

/** The place a game gained by a quiet link between its held rows (sorted) or after the last of them, or null. */
export function quietLinkOf(sorted: readonly HeldChange[], now: GameSnapshot): string | null {
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1].before : now;
    if (next && isQuietLink(sorted[i].after, next)) return next.venueId;
  }
  return null;
}

const byCreated = (a: HeldChange, b: HeldChange) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** One game's net effect, from its held rows (any order) and the game now; null when families have nothing to hear. */
export function netChangeOf(rows: readonly HeldChange[], now: GameSnapshot): NetChange | null {
  if (!rows.length) return null;
  const held = [...rows].sort(byCreated);
  const heard = held[0].before;
  // A quiet link since (K7) is no part of the news: compare against the place families heard WITH the link, so neither
  // the kind nor the email's "Was" line says the place changed. Only when the typed text is still what they heard.
  const linked = heard && heard.venueId == null && (heard.location ?? null) === (now.location ?? null) ? quietLinkOf(held, now) : null;
  const before = heard && linked ? { ...heard, venueId: linked } : heard;
  const base = {
    gameId: held[0].gameId, before, now, byClub: held.some(r => r.source === 'club'), changeIds: held.map(r => r.id),
  };
  if (!before) {
    // Added since the last send: news only if it is on (a game added and then called off was never news).
    return publicState(now.status) === 'on' ? { ...base, kind: 'added' } : null;
  }
  // What a family reads of when is the day and the start clock, so an end-time-only edit is not news (nothing to tell them).
  const whenChanged = !sameMs(before.scheduledAt, now.scheduledAt), placeChanged = placeDiffers(before, now);
  const was = publicState(before.status), is = publicState(now.status);
  if (was !== is) {
    const kind: ChangeKind = is === 'cancelled' ? 'cancelled' : is === 'postponed' ? 'postponed' : was === 'postponed' && whenChanged ? 'given_date' : 'back_on';
    return { ...base, kind };
  }
  // Still off (cancelled or postponed): where it would have been is nobody's news.
  if (is !== 'on') return null;
  if (whenChanged) return { ...base, kind: 'moved' };
  if (placeChanged) return { ...base, kind: 'place' };
  return null;
}

/**
 * Every held game in a division: its change rows, what families will hear, and whether it was played since. `current`
 * is each game as it is now; a game missing from it was removed and says nothing.
 */
export function heldGames(rows: readonly HeldChange[], current: ReadonlyMap<string, GameSnapshot>): HeldGame[] {
  const byGame = new Map<string, HeldChange[]>();
  for (const r of rows) (byGame.get(r.gameId) ?? byGame.set(r.gameId, []).get(r.gameId)!).push(r);
  const out: HeldGame[] = [];
  for (const [gameId, list] of byGame) {
    const now = current.get(gameId);
    const changeIds = [...list].sort(byCreated).map(r => r.id);
    if (!now) { out.push({ gameId, changeIds, news: null, played: false }); continue; }
    const played = now.status === 'completed';
    out.push({ gameId, changeIds, news: played ? null : netChangeOf(list, now), played });
  }
  return out;
}

/** The games a send emails about (the SQL's `p_news`), and every held row it claims (`p_changes`). */
export function sendClaim(games: readonly HeldGame[]): { changeIds: string[]; newsGameIds: string[] } {
  return {
    changeIds: games.flatMap(g => g.changeIds),
    newsGameIds: games.filter(g => g.news).map(g => g.gameId),
  };
}

/**
 * What families see of a game until the send (9d2·16): the game as they last heard it, or null when they have not heard
 * of it yet. A played game reads as it is (a result is a record).
 */
export function lastSentView(now: GameSnapshot, rows: readonly HeldChange[]): GameSnapshot | null {
  if (!rows.length || now.status === 'completed') return now;
  return [...rows].sort(byCreated)[0].before;
}

/** The households a send reaches: each family once, one part per child whose team is in the changed games (f2, f3). */
interface FamilyChild { registrationId: string; email: string; childName: string; teamId: string }
export function familiesFor<C extends FamilyChild>(children: readonly C[], teamIds: ReadonlySet<string>) {
  const out = new Map<string, C[]>();
  for (const c of children) {
    const email = normalizeGuardianEmail(c.email);
    if (!email || !teamIds.has(c.teamId)) continue;
    (out.get(email) ?? out.set(email, []).get(email)!).push(c);
  }
  return out;
}

/** The two teams' families hear a game's change; their coaches are copied (9d2·2's rule for games). */
export function teamsHearing(games: readonly { homeTeamId: string; awayTeamId: string }[]): Set<string> {
  return new Set(games.flatMap(g => [g.homeTeamId, g.awayTeamId]));
}

// ── As families last heard it (moved here from league-game-changes-server.ts for Club Website Stage 1, so the window
//    rule is unit-tested; pure, no read) ───────────────────────────────────────────────────────────────────────────

/** The fields of a game families read (mig 409's `league_game_snapshot`), plus its id. */
export type GameFaceFields = Pick<LeagueGame, 'id' | 'scheduledAt' | 'endsAt' | 'location' | 'orgVenueId' | 'orgVenueFacilityId' | 'status' | 'movedFrom'>;

export function snapshotOf(g: Omit<GameFaceFields, 'id'>): GameSnapshot {
  return {
    scheduledAt: g.scheduledAt, endsAt: g.endsAt, location: g.location, venueId: g.orgVenueId,
    facilityId: g.orgVenueFacilityId, status: g.status, movedFrom: g.movedFrom,
  };
}

function withSnapshot<G extends GameFaceFields>(g: G, s: GameSnapshot): G {
  return {
    ...g, scheduledAt: s.scheduledAt, endsAt: s.endsAt, location: s.location, orgVenueId: s.venueId,
    orgVenueFacilityId: s.facilityId, status: s.status, movedFrom: s.movedFrom,
  };
}

/** These games as families last heard them: a held change reads its `before`; a game added since is dropped. */
export function asLastSent<G extends GameFaceFields>(games: readonly G[], held: readonly HeldChange[]): G[] {
  const byGame = new Map<string, HeldChange[]>();
  for (const c of held) (byGame.get(c.gameId) ?? byGame.set(c.gameId, []).get(c.gameId)!).push(c);
  const out: G[] = [];
  for (const g of games) {
    const seen = lastSentView(snapshotOf(g), byGame.get(g.id) ?? []);
    if (seen) out.push(withSnapshot(g, seen));
  }
  return out;
}

/** An instant inside [from, to) (epoch ms). */
const within = (iso: string | null | undefined, from: number, to: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return t >= from && t < to;
};

/**
 * THE WINDOW, APPLIED AFTER THE AS-LAST-SENT VIEW (pure; Club Website Stage 1 Pass 1). A game shows in [fromIso, toIso)
 * when the day families last heard for it falls there — its start as last sent, or the day it was moved off
 * (`movedFrom`, so a sent move can say "Moved to Sat, Dec 5" on the day it left). A game moved from today to next week by a
 * change NOT yet sent still reads today (that is what families were told); a game moved INTO today by an unsent change
 * reads as its old day and drops out. Sorted by its start as last sent.
 */
export function lastSentInWindow<G extends GameFaceFields>(
  games: readonly G[], held: readonly HeldChange[], fromIso: string, toIso: string,
): G[] {
  const from = Date.parse(fromIso), to = Date.parse(toIso);
  return asLastSent(games, held)
    .filter(g => within(g.scheduledAt, from, to) || within(g.movedFrom, from, to))
    .sort((a, b) => (Date.parse(a.scheduledAt ?? '') || 0) - (Date.parse(b.scheduledAt ?? '') || 0) || a.id.localeCompare(b.id));
}
