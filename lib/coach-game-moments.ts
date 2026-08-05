/**
 * lib/coach-game-moments.ts — Game-Day Mode P2 ("moments"), pure logic.
 *
 * A moment is ONE line a coach types at the bench because they want to remember it
 * ("Maya's first triple"), optionally tagged to a player. It is flavour, and the whole
 * feature is built so that it stays flavour.
 *
 * ── THE D4 TEST, RESTATED FOR P2 (plan §3.7, binding) ───────────────────────────────────────
 * Moments feed NOTHING. Not analytics, not playing time, not attendance, not coverage, not the
 * season record. A half-used log must poison nothing — which is why no function in this module
 * returns a number any other surface consumes, and why `computeSeasonWrapped`'s output is
 * key-locked by test against ever growing a moments field (the one way a moment could sneak
 * into an analytic payload, and from there onto the shareable card).
 *
 * ── The other three rules ───────────────────────────────────────────────────────────────────
 *  · APPEND-ONLY at the app layer: there is no UPDATE route. DELETE exists so a coach can
 *    remove a mistake (head-coach-any / author-own, the scouting book's curation rule).
 *  · NO NOTIFICATIONS, ever. Nothing here touches `notify()` or the family layer. Moments are
 *    coach-and-staff-side; the one-notification-at-End-game promise is untouched.
 *  · LIVE-SEASON INSTRUMENT for WRITES: the capture routes ride `resolveLiveCoachTeamContext`
 *    and cannot address a past season. Reading them back in a FINISHED season's Wrapped is an
 *    explicit owner ruling (2026-08-05): a moment is a record of a night that happened, it
 *    cannot be edited after the fact, and it reads as it read at the time. A closed season
 *    shows moments and offers no way to add or remove one.
 *
 * ── Vocabulary (owner's own split, plan §3.2 vs §3.7) ───────────────────────────────────────
 * The BUTTON says "Note" (the verb, at the bench). Every collection heading says "moments"
 * (the noun). Deliberately never "Notes" as a heading: player notes are a different,
 * privacy-gated thing in this portal and the two must not read as the same drawer.
 */

/** App-enforced ceiling (plan §4). Deliberately the same order as the scouting observation. */
export const GAME_MOMENT_MAX = 280;

export interface GameMomentInput {
  body: unknown;
  playerId?: unknown;
}

export type GameMomentVerdict =
  | { ok: true; body: string; playerId: string | null }
  | { ok: false; reason: string };

/**
 * Validate one capture. The player tag is OPTIONAL by design — an untagged moment is a moment
 * about the night, and requiring a tag would turn a 10-second capture into a roster decision.
 * A tag that is not on the roster is REJECTED rather than silently dropped: silently writing a
 * moment the coach believes is filed under a player is worse than telling them it didn't take.
 */
export function validateGameMoment(
  input: GameMomentInput,
  rosterPlayerIds: readonly string[],
): GameMomentVerdict {
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (body.length < 1) return { ok: false, reason: 'A moment needs a line of text.' };
  if (body.length > GAME_MOMENT_MAX) {
    return { ok: false, reason: `A moment is 1–${GAME_MOMENT_MAX} characters.` };
  }
  const raw = input.playerId;
  if (raw == null || raw === '') return { ok: true, body, playerId: null };
  if (typeof raw !== 'string') return { ok: false, reason: 'Unknown player.' };
  if (!rosterPlayerIds.includes(raw)) return { ok: false, reason: 'Unknown player.' };
  return { ok: true, body, playerId: raw };
}

/** The stored shape, as every read surface sees it. */
export interface GameMomentLike {
  id: string;
  eventId: string;
  playerId: string | null;
  body: string;
  happenedAt: string;
}

/** Newest first, and stable: equal timestamps fall back to id so two moments captured in the
 *  same second don't swap places between renders (the "add another" loop makes that likely). */
export function sortMomentsNewestFirst<T extends GameMomentLike>(moments: readonly T[]): T[] {
  return [...moments].sort((a, b) => {
    const delta = new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime();
    if (delta !== 0 && !Number.isNaN(delta)) return delta;
    return b.id.localeCompare(a.id);
  });
}

/**
 * How many of a player's moments their page shows before falling back to a count. The page
 * only glances; the selection and the honest total are done in the query
 * (`getRepTeamGameMomentsForPlayer`) rather than by fetching the team's whole season.
 */
export const PLAYER_MOMENTS_SHOWN = 8;

export interface WrappedMomentSlot {
  /** How many the season holds — the honest count, not a curated "best of". */
  total: number;
  body: string;
  happenedAt: string;
  /** The game it was captured at, for the dateline. Null if that game has since been deleted. */
  gameLabel: string | null;
}

/**
 * Season Wrapped's slot — the smallest true version (owner-approved mockup rev 4, frame 18):
 * ONE moment and a count, never a ranking. **The most RECENT**, deliberately: any other rule
 * (longest, most-tagged, "best") would be us judging a coach's writing, and there is no honest
 * signal for it. Null when the season holds none — the strip is then absent, not empty.
 *
 * ⚠ This value rides the Wrapped payload as a SIBLING of the analytic stats, never inside them
 * (`SeasonWrappedStats` is key-locked by test). It is also excluded from the shareable card by
 * construction — see `wrappedShareCardData`: coach free text about a child must not be baked
 * into a PNG that leaves the app.
 */
export function deriveWrappedMomentSlot<T extends GameMomentLike>(
  moments: readonly T[],
  gameLabelById: ReadonlyMap<string, string>,
): WrappedMomentSlot | null {
  const sorted = sortMomentsNewestFirst(moments);
  const latest = sorted[0];
  if (!latest) return null;
  return {
    total: sorted.length,
    body: latest.body,
    happenedAt: latest.happenedAt,
    gameLabel: gameLabelById.get(latest.eventId) ?? null,
  };
}
