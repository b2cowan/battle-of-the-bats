/**
 * Which season is on screen, and is it a record? — the pure half of Chunk F.
 *
 * Deliberately NOT in `coaches-context.tsx`: this is the logic the whole chunk's correctness
 * reduces to (every page's write flags, every nav door set, every fetch's `?year=`), so it lives
 * where it can be unit-tested without React. The context re-exports it for consumers.
 *
 * ⚠ THE RULE THIS FILE EXISTS TO HOLD: read-only is a fact about the SEASON, never about the
 * TEAM. A team rolled forward into a new year is never itself "closed" — but its 2025 is still a
 * record. The plan of record had this backwards, and keying off the team's state would leave a
 * rolled-forward team's archive quietly writable.
 */
import type { CoachSeasonOption } from './types';
import type { CoachCapabilities } from './coach-capabilities';
import type { CoachingAssignment, ClosedCoachingAssignment } from './db';
import { archiveHasSection } from './coach-nav-visibility';
import { pathWithSearchParams } from './coaches-portal-routes';

/**
 * `?year=…` for a season, or '' for the live one — the ONE place the parameter is named and
 * encoded. It was written out by hand in five places before; a rename would have had to find
 * all five.
 */
export function seasonQueryFor(season: Pick<CoachSeasonOption, 'programYearId' | 'status'> | null | undefined): string {
  if (!season || season.status !== 'complete') return '';
  return pathWithSearchParams('', { year: season.programYearId });
}

/**
 * Where "switch to this season" lands, keeping the coach on the section they are reading.
 *
 * ONE implementation, because there were three and they disagreed: the sidebar and the chip
 * preserved your section, while the phone's More sheet always dumped you on the archive's front
 * door. Same control, same words, different behaviour depending on where you tapped it.
 *
 * Sections that don't exist in an archive (Chat, Email families, Settings) would 404 going
 * backwards, so those fall back to Season's End — that fallback is the reason this needs to know
 * which sections a finished season actually has.
 *
 * ⚠ It asks `archiveHasSection`, NOT the archive menu. Those were the same question until
 * 2026-08-16 and are not any more, in BOTH directions: Attendance exists in an archive with no menu
 * entry, and `/history/playing-time` sits under a menu entry's prefix while not existing in an
 * archive at all. Reading the menu directly would strand a coach on one and dead-end them on the
 * other — see the lists in `coach-nav-visibility.ts` for why each case is separate.
 */
export function resolveSeasonSwitchHref(
  teamBase: string,
  pathname: string,
  target: CoachSeasonOption,
): string {
  const section = pathname.startsWith(teamBase) ? pathname.slice(teamBase.length) : '';
  const keepSection = target.status === 'live' || archiveHasSection(section);
  return `${teamBase}${keepSection ? section : '/season-end'}${seasonQueryFor(target)}`;
}

/** "Live" / "Complete" — the season's status in the words the switcher shows. */
export function seasonStatusLabel(season: Pick<CoachSeasonOption, 'status'>): string {
  return season.status === 'live' ? 'Live' : 'Complete';
}

/**
 * Build the switcher's season list from the two assignment lookups. Shared because the coaches
 * layout (SSR seed) and the assignments API must produce byte-identical shapes — they were two
 * hand-copies of the same map, which is how a new field gets added to one and not the other.
 */
export function buildCoachSeasons(
  assignments: CoachingAssignment[],
  closedAll: ClosedCoachingAssignment[],
): CoachSeasonOption[] {
  return [
    ...assignments.map(a => ({
      teamId: a.teamId,
      programYearId: a.programYearId,
      programYearName: a.programYearName,
      programYearYear: a.programYearYear,
      status: 'live' as const,
      capabilities: a.capabilities,
      coachRole: a.coachRole,
    })),
    ...closedAll.map(a => ({
      teamId: a.teamId,
      programYearId: a.programYearId,
      programYearName: a.programYearName,
      programYearYear: a.programYearYear,
      status: 'complete' as const,
      capabilities: a.capabilities,
      coachRole: a.coachRole,
    })),
  ];
}

/** What every section page needs to know about the season it is rendering. */
export interface SeasonView {
  /** The season being viewed, or null while assignments load / the team has none. */
  current: CoachSeasonOption | null;
  /** Every season of THIS team the coach may open, live first then newest-closed first. */
  options: CoachSeasonOption[];
  isReadOnly: boolean;
  /** `?year=<id>` when a past season is being viewed, else '' — append to section links so
   *  switching sections keeps the season, and to fetches so the API resolves the same one. */
  query: string;
  /** The switcher only earns its place with more than one season (mirrors the team switcher). */
  hasChoice: boolean;
}

/**
 * Resolve the season a page is rendering, from the URL's `?year=` plus the assignments already on
 * the context. No fetch: the switcher is free.
 */
export function resolveSeasonView(
  seasons: CoachSeasonOption[],
  teamId: string | null | undefined,
  yearParam: string | null,
): SeasonView {
  const options = teamId ? seasons.filter(s => s.teamId === teamId) : [];
  // Unknown/foreign year id ⇒ fall back to the live season rather than rendering an empty
  // archive: the API is the authority on access, and a bad id in a shared link is a typo.
  // ⚠ NEWEST live season, not the first one the lookup happened to return. A team can hold a
  // draft AND an active year at once (mid-rollover), and the server resolves the most recent —
  // picking differently here would label the page with one season and load another.
  const liveSeasons = options.filter(s => s.status === 'live')
    .sort((a, b) => (b.programYearYear ?? 0) - (a.programYearYear ?? 0));
  const current = (yearParam ? options.find(s => s.programYearId === yearParam) : null)
    ?? liveSeasons[0]
    ?? options[0]
    ?? null;
  const isReadOnly = current?.status === 'complete';
  return {
    current,
    options,
    isReadOnly,
    query: seasonQueryFor(current),
    hasChoice: options.length > 1,
  };
}

/**
 * Everything a section PAGE needs to render one season, live or archived.
 *
 * The point of bundling it: a page must never answer "can I edit this?" from the coach's current
 * capabilities when it is showing 2025. `capabilities` here is already the right season's, and
 * `canWrite()` folds in read-only, so a page's existing write flags become
 * `canWrite(caps.rosterWrite)` and nothing else has to change.
 */
export interface CoachSeasonPage {
  season: SeasonView;
  /** THAT season's grants (rule 1) — never the coach's current ones when viewing an archive. */
  capabilities: CoachCapabilities | undefined;
  teamName: string;
  /** The team's sport, live-or-archived. Here rather than looked up again by each page: two
   *  pages were re-running `resolveClosedAssignment` purely to reach this one field, beside a
   *  resolver that had already resolved both assignments to answer `teamName` the same way. */
  teamSport: string | undefined;
  programYearName: string;
  isReadOnly: boolean;
  /** `?year=…` — append to every fetch and section link so the season survives navigation. */
  query: string;
  /** `/{org}/coaches/teams/{teamId}` — the chip's switch target. */
  teamBase: string;
  /** The coach has SOME access to this team (live or archived). False ⇒ render "not assigned". */
  hasAccess: boolean;
  /**
   * ⚠ MAY THIS COACH SEE THE TEAM'S SEASON-BY-SEASON HISTORY? Head coaches only (owner ruling
   * 2026-08-16).
   *
   * The multi-season scrapbook — per-season record, roster size, tryout acceptance and money
   * summaries — was served to ANY coach who ever staffed the team, for EVERY season, including
   * years before they arrived and after they left. The owner's ruling is deliberately the simple
   * one: head coach, no tenure windows. Widening it later is a decision; this is the floor.
   *
   * ⚠ "EVER head coach of this team", not "head coach of the season on screen" — the scrapbook
   * belongs to the TEAM and spans seasons, so a per-season test would show it on one year and hide
   * it on the next for the same person. It mirrors this route's existing cross-season `canViewMoney`
   * shape, and the server computes the identical thing so the client can never show more.
   */
  everHeadCoach: boolean;
  /** Fold a capability into the read-only rule: `canWrite(caps.rosterWrite)`. */
  canWrite: (capability: boolean | undefined) => boolean;
}

export function resolveCoachSeasonPage(
  ctx: {
    assignments: CoachingAssignment[];
    closedAssignments: ClosedCoachingAssignment[];
    seasons: CoachSeasonOption[];
  },
  orgSlug: string,
  teamId: string,
  yearParam: string | null,
): CoachSeasonPage {
  const { assignments, closedAssignments, seasons } = ctx;
  const season = resolveSeasonView(seasons, teamId, yearParam);
  const live = assignments.find(a => a.teamId === teamId) ?? null;
  const closed = closedAssignments.find(a => a.teamId === teamId) ?? null;
  const isReadOnly = season.isReadOnly;
  const capabilities = isReadOnly
    ? (season.current?.capabilities ?? closed?.capabilities)
    : live?.capabilities;
  return {
    season,
    capabilities,
    teamName: live?.teamName ?? closed?.teamName ?? '',
    teamSport: live?.teamSport ?? closed?.teamSport,
    programYearName: season.current?.programYearName ?? live?.programYearName ?? closed?.programYearName ?? '',
    isReadOnly,
    query: season.query,
    teamBase: `/${orgSlug}/coaches/teams/${teamId}`,
    hasAccess: !!(live || closed || season.current),
    /**
     * ⚠ CURRENT role, not history (M1, 2026-08-16). This used to scan every season's own
     * capability row ("ever head coach"), but the server's gate now answers from the coach's
     * CURRENT capabilities — so a demoted former head coach was shown the season-history doors
     * and then served an empty list ("None yet" — the exact lie the server's own comments
     * forbid). The live assignment mirrors the membership; between seasons the newest row does.
     * The field name survives only until P2 retires the restriction it feeds (slated revert).
     */
    everHeadCoach: (live?.capabilities ?? season.current?.capabilities ?? closed?.capabilities)?.isHeadCoach === true,
    // ⚠ Courtesy only. Hiding a control is not read-only — the server refuses the write, and a
    // source-level test proves no write handler can even address a past season.
    canWrite: (capability: boolean | undefined) => !isReadOnly && !!capability,
  };
}
