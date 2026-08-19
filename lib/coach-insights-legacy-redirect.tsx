import { permanentRedirect } from 'next/navigation';
import { insightsLegacyRedirectHref, legacyInsightsSection } from './coach-insights-links.ts';
import type { SearchParamsRecord } from './coaches-portal-routes.ts';

/**
 * The page component each legacy standalone report route exports. Insights became one tabbed
 * reports portal (2026-08-18; the Money hub's precedent — redirect rather than 404), so the six old
 * route files survive only so bookmarks, emailed links and any door a future change misses land on
 * the right tab, and each is one line:
 * `export default insightsLegacyRedirectPage('<section>')`.
 *
 * ⚠ The panel itself lives in `./panel` beside each of these, imported by the hub — NOT in the page
 * file. A page module may only export Next's page contract, and the build's route-type stubs fail
 * `tsc` on any extra export (bitten on the Money hub, 2026-08-12).
 *
 * ⚠⚠ **IT TAKES THE FOLDER'S OWN NAME, NOT THE TAB'S** — and that is the whole reason
 * `legacyInsightsSection` exists. The first version took a section id, so every stub hard-coded its
 * own answer and the mapping function had NO caller: a review found it was dead code while this
 * file's comment and a unit test both claimed it was "the one home" for the rule. For five of the
 * six routes the two names are identical and nothing would ever have shown the gap; for
 * `opponents` → `scouting` they differ, so renaming the tab in the one place that documents itself
 * as authoritative would have left a years-old bookmark silently landing on the Dashboard, with the
 * test still green. Passing the segment makes the function load-bearing instead of decorative.
 *
 * Separate from coach-insights-links.ts so that module stays free of next/navigation — node scripts
 * and node-test-run lib code import the pure href builders.
 */
export function insightsLegacyRedirectPage(legacySegment: string) {
  const section = legacyInsightsSection(legacySegment);
  if (!section) {
    // A build-time mistake, not a runtime state: this factory is only ever called with one of the
    // six retired folder names, and an unrecognised one means a route was added without teaching
    // the mapping about it.
    throw new Error(`insightsLegacyRedirectPage: "${legacySegment}" is not a retired Insights route`);
  }
  return async function InsightsLegacyRedirect({
    params,
    searchParams,
  }: {
    params: Promise<{ orgSlug: string; teamId: string }>;
    searchParams: Promise<SearchParamsRecord>;
  }) {
    const { orgSlug, teamId } = await params;
    permanentRedirect(insightsLegacyRedirectHref(orgSlug, teamId, section, await searchParams));
  };
}
