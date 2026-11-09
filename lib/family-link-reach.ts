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

// ── Every team the child is on (Signed-in family accounts Stage 4a, ruling 3, 2026-11-08) ─────────────────────────────────────
//
// A connection is to the CHILD on every team in the club, house league and rep (mig 453 made a link team-less). So a link reaches
// each team the child is LIVE on:
//   rep     — the child's non-call-up roster entry on the team's live season (draft/active), exactly `reachedEntry(…, 'live')`.
//   league  — the child's ACCEPTED (`active`) house-league sign-up placed on the team, where
//             · the division's teams are PUBLISHED (the draft board sets the team before Publish; a parent must not see a draft
//               team before the families are told — found by the Stage 4a build, recorded in the plan), and
//             · the season is not closed (`completed` / `archived`). A house-league season's registration statuses are live: teams are
//               published exactly then (house-league seasons read in place, owner 2026-11-04; a parent sees only live ones in 4a).
// The recap stays rep-only (`reachedEntry(…, 'recap')`).

export type TeamKind = 'rep' | 'league';

/** One of a child's entries on a team of either kind. `published` is the division's teams-published mark (always true for rep). */
export interface TeamEntry extends ChildTeamEntry {
  kind: TeamKind;
  teamId: string;
  published: boolean;
}

/** A team a link reaches now, and the entry (roster row or sign-up) it reaches it through. */
export interface ReachedTeam {
  kind: TeamKind;
  teamId: string;
  entryId: string;
}

/** A house-league season is live until it is completed or archived. */
export function isLiveLeagueSeasonStatus(status: string | null | undefined): boolean {
  return !!status && status !== 'completed' && status !== 'archived';
}

/** `${kind}:${teamId}` — the two kinds keep separate team id spaces. */
export const teamKey = (kind: TeamKind, teamId: string) => `${kind}:${teamId}`;

/** Every team one child's entries reach now, in a stable order (rep first, then by team id). */
export function teamsReached(entries: readonly TeamEntry[]): ReachedTeam[] {
  const byTeam = new Map<string, TeamEntry[]>();
  for (const e of entries) {
    const k = teamKey(e.kind, e.teamId);
    const list = byTeam.get(k);
    if (list) list.push(e); else byTeam.set(k, [e]);
  }
  const out: ReachedTeam[] = [];
  for (const list of byTeam.values()) {
    const { kind, teamId } = list[0];
    let entry: ChildTeamEntry | null;
    if (kind === 'rep') {
      entry = reachedEntry(list, 'live');
    } else {
      entry = null;
      for (const e of list) {
        if (!e.published || !isLiveLeagueSeasonStatus(e.seasonStatus)) continue;
        if (!entry || e.seasonCreatedAt > entry.seasonCreatedAt) entry = e;
      }
    }
    if (entry) out.push({ kind, teamId, entryId: entry.id });
  }
  return out.sort((a, b) => (a.kind === b.kind ? a.teamId.localeCompare(b.teamId) : a.kind === 'rep' ? -1 : 1));
}
