import type { LeagueGameStatus } from './types';

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
  whenChanged: boolean;
  placeChanged: boolean;
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

const sameMs = (a: string | null, b: string | null) => (a == null || b == null ? a === b : Date.parse(a) === Date.parse(b));
export const whenDiffers = (a: GameSnapshot, b: GameSnapshot) => !sameMs(a.scheduledAt, b.scheduledAt) || !sameMs(a.endsAt, b.endsAt);
export const placeDiffers = (a: GameSnapshot, b: GameSnapshot) =>
  (a.location ?? null) !== (b.location ?? null) || (a.venueId ?? null) !== (b.venueId ?? null) || (a.facilityId ?? null) !== (b.facilityId ?? null);

const byCreated = (a: HeldChange, b: HeldChange) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** One game's net effect, from its held rows (any order) and the game now; null when families have nothing to hear. */
export function netChangeOf(rows: readonly HeldChange[], now: GameSnapshot): NetChange | null {
  if (!rows.length) return null;
  const held = [...rows].sort(byCreated);
  const before = held[0].before;
  const base = {
    gameId: held[0].gameId, before, now, byClub: held.some(r => r.source === 'club'), changeIds: held.map(r => r.id),
  };
  if (!before) {
    // Added since the last send: news only if it is on with a date (a game added and then called off was never news).
    return publicState(now.status) === 'on' ? { ...base, kind: 'added', whenChanged: true, placeChanged: true } : null;
  }
  const whenChanged = whenDiffers(before, now), placeChanged = placeDiffers(before, now);
  const was = publicState(before.status), is = publicState(now.status);
  if (was !== is) {
    const kind: ChangeKind = is === 'cancelled' ? 'cancelled' : is === 'postponed' ? 'postponed' : was === 'postponed' && whenChanged ? 'given_date' : 'back_on';
    return { ...base, kind, whenChanged, placeChanged };
  }
  // Still off (cancelled or postponed): where it would have been is nobody's news.
  if (is !== 'on') return null;
  if (whenChanged) return { ...base, kind: 'moved', whenChanged, placeChanged };
  if (placeChanged) return { ...base, kind: 'place', whenChanged, placeChanged };
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
export interface FamilyChild { registrationId: string; email: string; childName: string; teamId: string }
export function familiesFor<C extends FamilyChild>(children: readonly C[], teamIds: ReadonlySet<string>) {
  const out = new Map<string, C[]>();
  for (const c of children) {
    const email = c.email.trim().toLowerCase();
    if (!email || !teamIds.has(c.teamId)) continue;
    (out.get(email) ?? out.set(email, []).get(email)!).push(c);
  }
  return out;
}

/** The two teams' families hear a game's change; their coaches are copied (9d2·2's rule for games). */
export function teamsHearing(games: readonly { homeTeamId: string; awayTeamId: string }[]): Set<string> {
  return new Set(games.flatMap(g => [g.homeTeamId, g.awayTeamId]));
}
