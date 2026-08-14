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
