import { permanentRedirect } from 'next/navigation';
import { moneyLegacyRedirectHref, type CoachMoneySection } from './coach-money-links.ts';
import type { SearchParamsRecord } from './coaches-portal-routes.ts';

/**
 * The page component each legacy standalone Money route exports. Money became one tabbed hub
 * (2026-08-13; owner ruling: redirect rather than 404) — the seven old route files survive only
 * so bookmarks and emailed links land on the right tab, and each is one line:
 * `export default moneyLegacyRedirectPage('<section>')`.
 *
 * Separate from coach-money-links.ts so that module stays free of next/navigation — node scripts
 * and node-test-run lib code import the pure href builders.
 */
export function moneyLegacyRedirectPage(section: CoachMoneySection) {
  return async function MoneyLegacyRedirect({
    params,
    searchParams,
  }: {
    params: Promise<{ orgSlug: string; teamId: string }>;
    searchParams: Promise<SearchParamsRecord>;
  }) {
    const { orgSlug, teamId } = await params;
    permanentRedirect(moneyLegacyRedirectHref(orgSlug, teamId, section, await searchParams));
  };
}

/**
 * The same hop for a legacy route that named ONE RECORD rather than a tab — today only
 * `accounting/fundraisers/[fundraiserId]`, whose drive became a sub-view of the Fundraisers tab
 * (2026-08-14). The id moves from the path into the tab's sub-view query key, so a bookmark or an
 * emailed link to a specific fundraiser opens THAT fundraiser rather than the list; incoming query
 * (a season `?year=`) is carried exactly as the tab hop carries it.
 *
 * ⚠ The route params are typed CONCRETELY (`fundraiserId`), not as a string map. An earlier
 * version took the two key names as arguments to look general — with one caller that bought
 * nothing and cost the type check: a mistyped id key still compiled and silently redirected to
 * `?fundraiser=undefined`. Generalize the day a second standalone record route retires, and let
 * that route's own segment name appear here when it does.
 */
export function moneyLegacyFundraiserRedirectPage() {
  return async function MoneyLegacyFundraiserRedirect({
    params,
    searchParams,
  }: {
    params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }>;
    searchParams: Promise<SearchParamsRecord>;
  }) {
    const { orgSlug, teamId, fundraiserId } = await params;
    permanentRedirect(moneyLegacyRedirectHref(orgSlug, teamId, 'fundraisers', {
      ...(await searchParams),
      fundraiser: fundraiserId,
    }));
  };
}
