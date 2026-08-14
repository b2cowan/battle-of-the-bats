// ⚠ Extension is load-bearing: the demo seeders run this module under plain node, which does not
// resolve extensionless ESM imports (the demo-coach.ts convention).
import { pathWithSearchParams, type SearchParamsRecord } from './coaches-portal-routes.ts';

// The ONE way to address a Money-hub tab from outside the hub.
//
// The hub (app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx) navigates by query string —
// `?section=<tab>` — and builds its own hrefs internally with `sectionHref`, which must preserve
// the page's live query state and so cannot be shared here. Every OTHER surface (a panel
// cross-link, the team Overview, the roster page, the demo chrome) builds its link with
// `moneySectionHref` instead of hand-assembling a query string: a hand-built string one line away
// from a correct one is exactly how the 2026-08-13 tab-less-page defect shipped.
//
// The seven legacy standalone routes (accounting/budget, /dues, …) are permanent redirects into
// these hrefs — the shared page shell they export lives in ./coach-money-legacy-redirect.tsx,
// NOT here: this module stays framework-free on purpose, because node scripts (the demo seeders)
// and node-test-run lib code (sandbox-chrome) import it.

/** The hub's tabs. The hub's own `SectionId` is derived from this (this ∪ 'overview') — keep ONE
 *  list, or a renamed tab compiles clean in one file and 404s from the other. */
export type CoachMoneySection =
  | 'budget'
  | 'dues'
  | 'fundraisers'
  | 'expenses'
  | 'allocations'
  | 'payment-requests'
  | 'budget-vs-actual';

/**
 * Href for a Money-hub tab. `base` is the team root (`/${orgSlug}/coaches/teams/${teamId}`),
 * `extra` carries a tab's own one-shot params (Budget's `line`/`periods`/`starter`/`generate`,
 * Expenses' `tab`) — the hub forwards them to the panel and drops them on the next tab switch.
 *
 * `carryQuery` is for callers standing in a season-read context: pass the page's season query
 * (`page.query`, `''` or `'?year=<id>'`) so a cross-link inside an ARCHIVED season stays in that
 * season instead of silently teleporting the reader to the live one. Omitting it from a
 * season-aware surface is the archive leak, not a shortcut.
 */
export function moneySectionHref(
  base: string,
  section: CoachMoneySection,
  extra?: Record<string, string>,
  carryQuery?: string,
): string {
  const qp = new URLSearchParams(carryQuery ? carryQuery.replace(/^\?/, '') : undefined);
  qp.set('section', section);
  if (extra) for (const [key, value] of Object.entries(extra)) qp.set(key, value);
  return `${base}/accounting?${qp.toString()}`;
}

/**
 * Where a legacy standalone Money route forwards to: the same tab in the hub, with every incoming
 * query param carried along — a bookmarked deep link (`?line=…`, `?tab=schedule`, a season-read
 * `?year=`) must survive the hop or the redirect quietly drops the coach somewhere less specific
 * than where their link pointed.
 */
export function moneyLegacyRedirectHref(
  orgSlug: string,
  teamId: string,
  section: CoachMoneySection,
  incoming: SearchParamsRecord,
): string {
  return pathWithSearchParams(
    `/${orgSlug}/coaches/teams/${teamId}/accounting`,
    { ...incoming, section },
  );
}
