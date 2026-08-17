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
  | 'transactions'
  | 'payables'
  | 'club'
  | 'budget-vs-actual';

/**
 * ⚠ `expenses` IS GONE FROM THE UNION ON PURPOSE (Money split P1, 2026-08-16). One screen holding
 * happened-lists AND owed-lists became two tabs — Transactions and Payables — so the old id names
 * no tab at all.
 *
 * ⚠ AND SO ARE `allocations` / `payment-requests` (money redesign P4, 2026-08-17) — the mirror
 * move. Two tabs became ONE (`club`), so both old ids name no tab either. Removing them from the
 * type rather than aliasing them is what makes the compiler find every caller; the ones that should
 * keep working do so through `legacyMoneyAddress` below.
 */
export type LegacyMoneySection = 'expenses' | 'allocations' | 'payment-requests';

/**
 * Where a saved address that names a retired tab lands now.
 *
 * ⚠⚠ FOR `expenses`, THE SUB-VIEW DECIDES THE TAB, NOT JUST THE SECTION. The old screen's four
 * sub-tabs divided cleanly into happened (Expenses, Money in) and owed (Payables, Payment schedule),
 * and that division is exactly where the split was made — so `&tab=payables` and `&tab=schedule`
 * have to cross to the OTHER tab, while the two happened-side values stay put. A mapping that read
 * the section alone would land half of every bookmarked link on a screen that cannot show what it
 * pointed at.
 *
 * ⚠ FOR THE TWO CLUB IDS THERE IS NOTHING TO DECIDE, and that is the point of the merge: both halves
 * of the relationship are on one screen, so both addresses resolve to it with no sub-view and no
 * loss. A deep link to the old Payments tab does not need to scroll anywhere — the requests are
 * visible on the same page as the bills.
 *
 * Pure and framework-free (node scripts import this module), and the ONE home for the rule — the
 * legacy standalone routes and the hub's own address normaliser all call it.
 */
export function legacyMoneyAddress(
  section: string | null | undefined,
  tab: string | null | undefined,
): { section: CoachMoneySection; tab?: string } | null {
  if (section === 'allocations' || section === 'payment-requests') return { section: 'club' };
  if (section !== 'expenses') return null;
  if (tab === 'payables') return { section: 'payables', tab: 'commitments' };
  if (tab === 'schedule') return { section: 'payables', tab: 'schedule' };
  /* ⚠ `tab=money-in` NO LONGER NAMES A VIEW (money redesign P3). The arrivals list is gone; the
     register holds income and money back as two separate FILTERS of one book. A bookmark that said
     "money in" meant both kinds, so the only non-lossy landing is the whole book — sending it to the
     Income filter would hide exactly the refunds that list was half made of. Same for `tab=expenses`
     and anything unrecognised: the happened side, unfiltered. */
  return { section: 'transactions' };
}

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
