/**
 * WHAT A PARENT LINK REACHES (Club Tier Stage 14 S6, Ask 13 — owner "go with your recommendations" 2026-11-05).
 *
 * A parent link points at the CHILD (mig 445: `family_links.child_id`). What a connected parent can read follows the child's
 * LIVE seasons on that team — so last season's team stops reaching the parent when it closes, and a roll changes nothing for
 * them (there is nothing to re-invite). The one exception is the end-of-season RECAP: it is the one thing meant to be read after
 * a season closes, so it follows the child's newest CLOSED season on the team (`recap` mode).
 *
 * The link's own `player_id` is only "the entry it was made on". Readers get the entry the link reaches NOW from here, and
 * `playerId` on the link they hold is replaced by it (`reachedLink`), so a payload that reads "the linked player" reads the
 * right season's entry without each caller learning the rule.
 *
 * ⚠ PURE: no database. The reads that feed it are in lib/family-access.ts (`reachingLinks`). Jurisdiction note: what a parent
 * may see of a PAST season waits for the privacy review the owner parked (Ask 9) — until then the recap is the only closed-
 * season door, and nothing here turns the guardian tier on.
 */
import { isLiveSeasonStatus, liveSeasonOf, latestClosedSeasonOf } from './season-live';

/** One of a child's non-call-up roster entries on a team, with its season. */
export interface ChildTeamEntry {
  id: string;
  seasonStatus: string;
  seasonYear: number;
  /** The season's created time — the tie-break `liveSeasonOf` / `latestClosedSeasonOf` use. */
  seasonCreatedAt: string;
}

export type ReachMode = 'live' | 'recap';

/**
 * The entry a link reaches, or null (the link reaches nothing).
 *   live  — the child's entry on the team's live season (draft/active; the newest-created when a club has two open).
 *   recap — the child's entry on the team's newest CLOSED season; with no closed season, the live entry (so the recap page
 *           can say "not yet", as it always has), else null.
 */
export function reachedEntry(entries: readonly ChildTeamEntry[], mode: ReachMode): ChildTeamEntry | null {
  const asSeason = (e: ChildTeamEntry) => ({ status: e.seasonStatus, year: e.seasonYear, createdAt: e.seasonCreatedAt, entry: e });
  const seasons = entries.map(asSeason);
  const live = liveSeasonOf(seasons)?.entry ?? null;
  if (mode === 'live') return live;
  return latestClosedSeasonOf(seasons)?.entry ?? live;
}

/** Does the child hold a live entry on the team? (The reach, as a yes/no.) */
export const reachesLive = (entries: readonly ChildTeamEntry[]) => entries.some(e => isLiveSeasonStatus(e.seasonStatus));

/** `${childId}|${teamId}` — how entries are filed per child and team. */
export const reachKey = (childId: string, teamId: string) => `${childId}|${teamId}`;
