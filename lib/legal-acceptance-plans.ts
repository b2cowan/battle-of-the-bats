/**
 * THE CANCEL DOOR'S PLANS (GST/HST Stage 6 step 6.3, Chunk B; Terms draft §20 (5e), drawing Ask 8A). Server-only.
 *
 * On "We've updated our Terms" a person who OWNS a paid plan is offered a way out: "Don't agree? You can cancel your plan
 * instead." (§18: "If you do not agree, you can cancel"). This lists those plans, each with the billing page where it is
 * cancelled — the page the sign-in screen then lets them through to without agreeing (`screenPassesThrough`), because
 * cancelling is never gated.
 *
 * "Paid" is what the organization HOLDS on Stripe — a live subscription (`hasLiveSubscription`'s rule: a paying status and a
 * real, not mock, subscription) — never the free-time door's plan: free time is not a plan anyone pays for, and has nothing
 * to cancel. A comped or Founding organization has no subscription and gets no door.
 */
import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { PAYING_STATUSES } from './stripe-billing-state';
import { billingUrlOrgFromRow, getBillingHref } from './billing-urls';

export interface CancelDoorPlan {
  /** The organization's name, for the list a person with several plans sees. */
  name: string;
  /** Its billing page — where the plan is cancelled. */
  billingHref: string;
}

type OwnedOrgRow = {
  organizations: {
    slug: string;
    name: string | null;
    plan_id: string | null;
    account_kind: string | null;
    subscription_status: string | null;
    stripe_subscription_id: string | null;
  } | null;
};

/** The paid plans this person owns, by name. A read failure is an empty list: the screen then shows no door, and Sign out. */
export async function paidPlansOwnedBy(userId: string): Promise<CancelDoorPlan[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('organizations!inner(slug, name, plan_id, account_kind, subscription_status, stripe_subscription_id)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active');
  if (error) {
    console.error('[legal-acceptance] could not read the plans a person owns:', error);
    return [];
  }
  const plans: CancelDoorPlan[] = [];
  for (const row of (data ?? []) as unknown as OwnedOrgRow[]) {
    const org = row.organizations;
    if (!org) continue;
    const sub = org.stripe_subscription_id;
    if (!sub || sub.startsWith('mock_') || !PAYING_STATUSES.has(org.subscription_status ?? '')) continue;
    plans.push({ name: org.name ?? org.slug, billingHref: getBillingHref(billingUrlOrgFromRow(org), { purpose: 'return' }) });
  }
  return plans;
}
