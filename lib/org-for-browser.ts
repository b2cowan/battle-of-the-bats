/**
 * THE CLUB RECORD AS A BROWSER MAY SEE IT (Board Ready trust close-out 4, owner 2026-11-18).
 *
 * The server's `Organization` carries the club's billing facts: the subscription's amount, currency and cycle, the renewal
 * date and the payment processor's ids (customer, subscription, rep-team subscription item). The record reached EVERY member's browser two ways — `/api/org-context` and the
 * admin and Coaches Portal layouts, which seed the client `OrgProvider` with it — so a scorekeeper or a club's assistant
 * coach was handed them behind the scenes. No screen showed them below the owner (Plan & billing is the owner's; its plan
 * move is offered only to the owner), so the facts now go to the owner and admins only, and everyone else gets them blank.
 *
 * Every place the record crosses into the browser calls this; `tests/unit/org-for-browser.test.ts` fails the build when a
 * layout seeds `initialOrg` with the raw record, or the org-context route returns it.
 */
import type { Organization, OrgRole } from './types';

/** The roles that are sent the billing facts. */
const SEES_BILLING_FACTS: readonly string[] = ['owner', 'admin'];

export function orgSeesBillingFacts(role: OrgRole | string | null | undefined): boolean {
  return !!role && SEES_BILLING_FACTS.includes(role);
}

export function orgForBrowser(org: Organization, role: OrgRole | string | null | undefined): Organization {
  if (orgSeesBillingFacts(role)) return org;
  return {
    ...org,
    stripeCustomerId: undefined,
    stripeSubscriptionId: undefined,
    currentPeriodEnd: null,
    subscriptionPeriod: undefined,
    subscriptionAmountCents: null,
    subscriptionCurrency: null,
    // The third processor id (a rep-team subscription item, `si_…`; /review 2026-11-18): no screen reads it below the owner.
    repTeamSubscriptionItemId: null,
  };
}
