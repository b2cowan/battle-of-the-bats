/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT "LIVE" MEANS FOR A TEAM'S SEASON — one rule, written once, for the club side and the
 * portal side alike (Club Tier Stage 2, Ask 1 (a), owner 2026-09-28).
 *
 * A season is LIVE when it is `draft` or `active`; closed when it is `completed` or `archived`.
 * That was always the portal's rule (`getActiveRepProgramYear`, `resolveLiveSeason`). The club side
 * used to read "Draft" as a preparation state — help told a club to keep next season in Draft
 * "while you prepare tryouts" — and a Draft is exactly what the portal treats as the team's live
 * season, so the coach's portal jumped to an empty year mid-season. "Draft" stops being a
 * preparation state anywhere a club reads.
 *
 * ⚠ PURE: no database, no React. The server's SQL twin of `liveSeasonOf` is
 * `getActiveRepProgramYear` (newest-CREATED draft|active row); keep the two tie-breaks equal.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export const LIVE_SEASON_STATUSES = ['draft', 'active'] as const;
export const CLOSED_SEASON_STATUSES = ['completed', 'archived'] as const;

export function isLiveSeasonStatus(status: string | null | undefined): boolean {
  return status === 'draft' || status === 'active';
}

type SeasonRow = { id: string; name: string; status: string; year: number; createdAt: string };

/** THE live season among a team's seasons: the newest-CREATED draft or active one, else null. */
export function liveSeasonOf<T extends Pick<SeasonRow, 'status' | 'createdAt'>>(seasons: readonly T[]): T | null {
  let best: T | null = null;
  for (const s of seasons) {
    if (!isLiveSeasonStatus(s.status)) continue;
    if (!best || s.createdAt > best.createdAt) best = s;
  }
  return best;
}

/** The team's newest closed season (highest year, then newest-created) — `getLatestClosedRepProgramYear`'s rule. */
export function latestClosedSeasonOf<T extends Pick<SeasonRow, 'status' | 'year' | 'createdAt'>>(
  seasons: readonly T[],
): T | null {
  let best: T | null = null;
  for (const s of seasons) {
    if (s.status !== 'completed' && s.status !== 'archived') continue;
    if (!best || s.year > best.year || (s.year === best.year && s.createdAt > best.createdAt)) best = s;
  }
  return best;
}

// ── The roll: what happens to a SECOND open season ──────────────────────────────────────────

export type StrayOpenSeasonDecision =
  | { action: 'none' }
  /** Standalone portal only: a leftover open row is the residue of an earlier roll that failed on
   *  its last step, so completing it restores the one-open-season invariant. */
  | { action: 'complete'; seasonIds: string[] }
  /** A club team: two open seasons are two seasons somebody made on purpose. Refuse, name both. */
  | { action: 'refuse'; open: Array<Pick<SeasonRow, 'id' | 'name' | 'status'>> };

/**
 * What the season roll does about an open season OTHER than the one it rolls from.
 *
 * ⚠⚠ **NO SELF-HEAL FOR A CLUB** (Ask 1 (a), binding). The standalone roll quietly completes a stray
 * open season because a standalone team has no other legitimate one — the only way to get two is a
 * roll that died on its last step. A CLUB team can hold two on purpose: the old club screens let an
 * admin make next season's Draft while this one ran (the exact state the Stage 2 drawings show).
 * Auto-completing one of those would close a season somebody is working in, silently. So the club
 * roll refuses and says which two, and the club closes the one it means to.
 */
export function decideStrayOpenSeasons(
  seasons: readonly Pick<SeasonRow, 'id' | 'name' | 'status'>[],
  rollingFromId: string,
  managedBy: 'coach' | 'club',
): StrayOpenSeasonDecision {
  const stray = seasons.filter(s => isLiveSeasonStatus(s.status) && s.id !== rollingFromId);
  if (stray.length === 0) return { action: 'none' };
  if (managedBy === 'club') {
    const rollingFrom = seasons.find(s => s.id === rollingFromId);
    const open = [...(rollingFrom && isLiveSeasonStatus(rollingFrom.status) ? [rollingFrom] : []), ...stray];
    return { action: 'refuse', open };
  }
  return { action: 'complete', seasonIds: stray.map(s => s.id) };
}

/** "9U A has two seasons open: the 2026 Season and the 2027 Season, left as a draft." */
export function openSeasonsSentence(
  teamName: string,
  open: readonly Pick<SeasonRow, 'name' | 'status'>[],
): string {
  const named = open.map(s => `the ${s.name}${s.status === 'draft' ? ', left as a draft' : ''}`);
  if (named.length === 1) return `${teamName} already has ${named[0]} open.`;
  const list = `${named.slice(0, -1).join('; ')} and ${named[named.length - 1]}`;
  const count = open.length === 2 ? 'two' : String(open.length);
  return `${teamName} has ${count} seasons open: ${list}.`;
}

/**
 * The roll's refusal. ⚠ Usually two seasons; ONE when the club rolled from a closed season and a
 * season was opened in the meantime (by another admin, in another tab) — then there is nothing to
 * close, only a page to refresh (review 2026-09-28: it read "1 seasons open … close one of them").
 */
export function twoOpenSeasonsMessage(
  teamName: string,
  open: readonly Pick<SeasonRow, 'name' | 'status'>[],
): string {
  return open.length === 1
    ? `${openSeasonsSentence(teamName, open)} Nothing was changed — refresh to see where the team is now.`
    : `${openSeasonsSentence(teamName, open)} Close one of them before starting another. Nothing was changed.`;
}

// ── The public tryout rule ─────────────────────────────────────────────────────────────────

/**
 * The season a family can sign up for: the team's LIVE season, when its tryouts are open and the
 * team is not archived. Otherwise none.
 *
 * ⚠ ONE RULE FOR EVERY PUBLIC READER (Club Tier B07). The team page advertised only an ACTIVE
 * season, the sign-up API accepted ANY season with the switch on (a draft's form was reachable by a
 * copied link; so was a finished season's), and the club homepage's list had a third rule. They now
 * all ask this.
 */
export function publicTryoutSeasonOf<T extends Pick<SeasonRow, 'status' | 'createdAt'> & { tryoutOpen: boolean }>(
  team: { isArchived: boolean },
  seasons: readonly T[],
): T | null {
  if (team.isArchived) return null;
  const live = liveSeasonOf(seasons);
  return live && live.tryoutOpen ? live : null;
}
