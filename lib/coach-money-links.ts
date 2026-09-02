// ⚠ If an import is ever added back here, its extension is load-bearing: the demo seeders run
// this module under plain node, which does not resolve extensionless ESM imports (the
// demo-coach.ts convention).

// The ONE way to address a Money-hub tab from outside the hub.
//
// The hub (app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx) navigates by query string —
// `?section=<tab>` — and builds its own hrefs internally with `sectionHref`, which must preserve
// the page's live query state and so cannot be shared here. Every OTHER surface (a panel
// cross-link, the team Overview, the roster page, the demo chrome) builds its link with
// `moneySectionHref` instead of hand-assembling a query string: a hand-built string one line away
// from a correct one is exactly how the 2026-08-13 tab-less-page defect shipped.
//
// ⚰ The legacy standalone ROUTES (accounting/budget, /dues, /fundraisers/[id], …) are DELETED
// (owner, 2026-08-31 — pre-customer, so the only bookmarks at risk were our own). They spent
// their redirect life 2026-08-13 → 2026-08-31; ./coach-money-legacy-redirect.tsx went with them.
// ⚠ `legacyMoneyAddress` below is NOT part of that layer and stays: it normalises retired
// `?section=` / `?tab=` QUERY names inside the live hub, which years of saved hub links carry.
// This module stays framework-free on purpose — node scripts (the demo seeders) and
// node-test-run lib code (sandbox-chrome) import it.

/** The hub's tabs. The hub's own `SectionId` is derived from this (this ∪ 'overview') — keep ONE
 *  list, or a renamed tab compiles clean in one file and 404s from the other. */
export type CoachMoneySection =
  | 'budget'
  | 'dues'
  | 'fundraisers'
  | 'ledger'
  | 'club'
  | 'budget-vs-actual';

/**
 * ⚠ `expenses` IS GONE FROM THE UNION ON PURPOSE (Money split P1, 2026-08-16). One screen holding
 * happened-lists AND owed-lists became two tabs — Transactions and Payables — so the old id names
 * no tab at all.
 *
 * ⚠ AND SO ARE `allocations` / `payment-requests` (money redesign P4, 2026-08-17) — the mirror
 * move. Two tabs became ONE (`club`), so both old ids name no tab either.
 *
 * ⚠⚠ AND NOW `transactions` / `payables` JOIN THEM (Payables→Ledger fold, owner-approved
 * 2026-08-28) — the mirror of the mirror: the two tabs the split made became ONE `ledger` with a
 * `?view=` arrangement (timeline / bills / due). Removing retired ids from the type rather than
 * aliasing them is what makes the compiler find every caller; the ones that should keep working do
 * so through `legacyMoneyAddress` below.
 *
 * ⚰ The `LegacyMoneySection` union that named those five retired ids stood here and was deleted on
 * 2026-09-01 (cleanup tranche 6): it had no importers, because the only code that needs the ids is
 * `legacyMoneyAddress` below, which compares the raw string a saved URL carries. A type over values
 * that only ever arrive as untyped query strings buys nothing and reads as a contract.
 */

/**
 * Where a saved address that names a retired tab lands now.
 *
 * ⚠⚠ THE SUB-VIEW DECIDES THE VIEW, NOT JUST THE SECTION. Three generations of address land here:
 * the pre-split `expenses` screen (whose four sub-tabs divided into happened and owed), the
 * split-era `transactions` / `payables` pair, and the payables `?tab=` arrangements the rebuild
 * kept as a live contract. Every one of them resolves to the ONE `ledger` tab plus the `?view=`
 * that says what the link always meant — a mapping that read the section alone would land half of
 * every bookmark on a reading that cannot show what it pointed at.
 *
 * ⚠ `?bill=` RIDES ALONG UNTOUCHED — the callers carry the rest of the query through, so a saved
 * link to one bill's page still opens that bill.
 *
 * ⚠ FOR THE TWO CLUB IDS THERE IS NOTHING TO DECIDE, and that is the point of the merge: both
 * halves of the relationship are on one screen, so both addresses resolve to it with no sub-view
 * and no loss.
 *
 * Pure and framework-free (node scripts import this module), and the ONE home for the rule —
 * the hub's own address normaliser calls it (its other caller, the legacy standalone routes,
 * were deleted 2026-08-31).
 */
export function legacyMoneyAddress(
  section: string | null | undefined,
  tab: string | null | undefined,
): { section: CoachMoneySection; view?: string } | null {
  if (section === 'allocations' || section === 'payment-requests') return { section: 'club' };
  if (section === 'transactions') return { section: 'ledger', view: 'timeline' };
  if (section === 'payables') {
    // The split-era tab's own arrangements: schedule → the dated view, commitments (and the
    // pre-rebuild default) → the grouped one. A bare ?section=payables always meant "what we owe".
    return { section: 'ledger', view: tab === 'schedule' ? 'due' : 'bills' };
  }
  if (section !== 'expenses') return null;
  if (tab === 'payables') return { section: 'ledger', view: 'bills' };
  if (tab === 'schedule') return { section: 'ledger', view: 'due' };
  /* ⚠ `tab=money-in` NO LONGER NAMES A VIEW (money redesign P3). The arrivals list is gone; the
     register holds income and money back as two separate FILTERS of one book. A bookmark that said
     "money in" meant both kinds, so the only non-lossy landing is the whole book — sending it to the
     Income filter would hide exactly the refunds that list was half made of. Same for `tab=expenses`
     and anything unrecognised: the happened side, unfiltered. */
  return { section: 'ledger', view: 'timeline' };
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

