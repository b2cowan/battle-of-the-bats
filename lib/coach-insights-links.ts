// ⚠ Extension is load-bearing: the demo seeders run this module under plain node, which does not
// resolve extensionless ESM imports (the demo-coach.ts convention).
import { pathWithSearchParams, type SearchParamsRecord } from './coaches-portal-routes.ts';

// The ONE way to address an Insights-portal tab from outside the portal.
//
// Insights became a tabbed reports portal on 2026-08-18 (owner-approved mockups;
// COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md). The hub — app/[orgSlug]/coaches/teams/[teamId]/history —
// navigates by query string (`?section=<tab>`) and builds its own hrefs internally with
// `sectionHref`, which must preserve that page's live query state and so cannot be shared here.
// Every OTHER surface (the team Overview, the game console, the season-end page, the demo chrome)
// builds its link with `insightsSectionHref`.
//
// ⚠ **A DELIBERATE SECOND MODULE, NOT AN EXTENSION OF `coach-money-links.ts`.** The two hubs share
// a mechanism and nothing else: their tab sets, their legacy addresses and their gates are
// unrelated, and a single "hub links" module would make a Money tab rename compile-check an
// Insights caller. Same reason the two hubs keep separate `SectionId` unions.
//
// The six legacy standalone routes (history/results, history/playing-time, …, and the top-level
// /attendance) are permanent redirects into these hrefs — the shared page shell they export lives
// in ./coach-insights-legacy-redirect.tsx, NOT here: this module stays framework-free on purpose,
// because node scripts (the demo seeders, sandbox-chrome) import it.

/**
 * The portal's tabs. Dashboard is the absence of a section, exactly as Money's Overview is — so it
 * is not a member here, and the hub's own `SectionId` is this ∪ 'dashboard'.
 *
 * ⚠ `scouting` is the SECTION ID for a folder still called `opponents`. The owner renamed the
 * report to "Scouting Book" (over "Opponents") in the mockup session; the drill-in book keeps its
 * `history/opponents/[opponentKey]` route, so renaming the folder would have moved a page nobody
 * asked to move. The id names what a coach reads; the folder names where the code sleeps.
 */
export type CoachInsightsSection =
  | 'results'
  | 'attendance'
  | 'playing-time'
  | 'development'
  | 'awards'
  | 'scouting';

/**
 * Where a saved address that named a standalone report page lands now — keyed by the last path
 * segment of the retired route.
 *
 * ⚠ `opponents` → `scouting` is the only entry where the two names differ, and it is exactly why
 * this map exists rather than the redirect pages each hard-coding their own answer: the folder and
 * the tab disagree by design, and one hand-copied mapping is how a bookmark to the scouting list
 * starts landing on the Dashboard.
 *
 * Pure and framework-free (node scripts import this module), and the ONE home for the rule.
 */
export function legacyInsightsSection(segment: string | null | undefined): CoachInsightsSection | null {
  switch (segment) {
    case 'results':      return 'results';
    case 'attendance':   return 'attendance';
    case 'playing-time': return 'playing-time';
    case 'development':  return 'development';
    case 'awards':       return 'awards';
    case 'opponents':    return 'scouting';
    default:             return null;
  }
}

/**
 * Href for an Insights-portal tab. `base` is the team root (`/${orgSlug}/coaches/teams/${teamId}`),
 * `extra` carries a tab's own one-shot params.
 *
 * ⚠ **NO `carryQuery` PARAMETER, and its absence is the decision.** The Money equivalent takes one
 * so a cross-link inside an archived season stays in that season. This portal is LIVE-SEASON-ONLY
 * by construction — a team with no live season never reaches it at all (`CoachTeamSeasonGate`
 * redirects to the closed-season page before any live screen mounts) — so there is no other season
 * a link here could mean. Adding a season parameter is the decision
 * `tests/unit/coach-history-endpoint-guard.test.ts` exists to force someone to make on purpose.
 */
export function insightsSectionHref(
  base: string,
  section: CoachInsightsSection,
  extra?: Record<string, string>,
): string {
  const qp = new URLSearchParams();
  qp.set('section', section);
  if (extra) for (const [key, value] of Object.entries(extra)) qp.set(key, value);
  return `${base}/history?${qp.toString()}`;
}

/** The Dashboard tab — the portal with no section named. Its own function so no caller has to know
 *  that "the first tab" is spelled as an absence. */
export function insightsDashboardHref(base: string): string {
  return `${base}/history`;
}

/**
 * Where a legacy standalone report route forwards to: the same tab in the hub, with every incoming
 * query param carried along — a bookmarked deep link must survive the hop or the redirect quietly
 * drops the coach somewhere less specific than where their link pointed.
 */
export function insightsLegacyRedirectHref(
  orgSlug: string,
  teamId: string,
  section: CoachInsightsSection,
  incoming: SearchParamsRecord,
): string {
  return pathWithSearchParams(
    `/${orgSlug}/coaches/teams/${teamId}/history`,
    { ...incoming, section },
  );
}
