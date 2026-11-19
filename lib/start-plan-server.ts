import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getPlanGatingMap, isPaidDoorOpen } from './plan-gating-server';
import { getPlanConfigOverrides } from './plan-config-db';
import { hadSubscriptionBefore } from './plan-move';
import { billingUrlOrgFromRow, getBillingHref } from './billing-urls';
import { isPlatformAdminEmail } from './platform-auth';
import { userBelongsToOtherRealOrg } from './org-membership-policy';
import { hasLiveInvitation } from './invite-reconciliation';
import { getActiveOwnedTeamWorkspace } from './team-workspace-owned';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { getAuthDestination } from './auth-destination';
import {
  isCompletedCheckoutOf, openPaidDoorPlans, paidDoorOf, parseStartPaidPlan, startPlanSetupDecision, trialDaysAfterHistory,
  type PaidDoor, type StartPaidPlan, type StartPlanOffer, type StartPlanSetupState,
} from './start-door';

/**
 * THE PAID DOORS' SERVER HALF (On-sale pages S2, 2026-11-19; plan CLUB_ON_SALE_PAGES_PLAN.md S2). Start a club and Start a
 * league season make the organization on the free Tournament plan and remember the plan it came to buy
 * (`organizations.start_plan`, mig 508). Everything that has to know it reads it here:
 *   · the plan step's offer — which cards, and each one's TRUE trial (trap B: the server's answer, never the code value);
 *   · the wait after Stripe — whether the plan has landed (trap A: Stripe returns before the webhook writes the plan);
 *   · the checkout's door returns and the shared trial rule.
 * The remembered plan steers screens only. The gate, checkout and the webhook decide what is sold and charged.
 */

/** Is a paid door on sale, read from the live gate for this request — the one question, kept in plan-gating-server. */
export { isPaidDoorOpen };

/**
 * The plan an organization's door made it to buy, or none. A missing column (production before mig 508) and a failed read
 * both read as none: the screens fall back to what a free door shows, and nothing is sold that the gate does not allow.
 */
export async function readStartPlan(orgId: string): Promise<StartPaidPlan | null> {
  const { data, error } = await supabaseAdmin.from('organizations').select('start_plan').eq('id', orgId).maybeSingle();
  if (error) {
    if (error.code !== '42703' && error.code !== 'PGRST204') console.error('[start-plan] read failed:', error);
    return null;
  }
  return parseStartPaidPlan((data as { start_plan?: unknown } | null)?.start_plan);
}

/**
 * The plan step for an organization a paid door made (null for every other organization, and once it holds a paid plan:
 * the remembered plan is read only while the organization is still on the free Tournament plan).
 */
export async function startPlanOffer(org: { id: string; ownPlanId: string; stripeCustomerId?: string | null }): Promise<StartPlanOffer | null> {
  if (org.ownPlanId !== 'tournament') return null;
  const startPlan = await readStartPlan(org.id);
  if (!startPlan) return null;
  const door = paidDoorOf(startPlan);
  // Three independent reads, together: the gate, the trial lengths checkout reads (the platform admin's overrides, one
  // read for every card), and the subscription history. A brand-new organization has no Stripe customer, so the trial
  // always applies; an abandoned checkout made one with no subscription, which still has its trial. Stripe is asked only
  // when there is a customer to ask about.
  const [gating, overrides, returning] = await Promise.all([
    getPlanGatingMap(),
    getPlanConfigOverrides(),
    org.stripeCustomerId
      ? hadSubscriptionBefore(org.stripeCustomerId).catch((err): null => {
          console.error('[start-plan] subscription history read failed:', err);
          return null;
        })
      : false,
  ]);
  const cards = openPaidDoorPlans(gating, door).map(plan => ({
    plan,
    trialDays: returning === null ? null : trialDaysAfterHistory(overrides[plan].trialDays, returning),
    returning,
  }));
  return { door, startPlan, cards };
}

/**
 * TRAP D, the signed-in owner: where a paid door sends someone who already owns a real organization (the one-organization
 * rule holds — no second one). The organization a paid door made and its owner has not paid for yet resumes on its own plan
 * step; any other goes to its Plan & billing. Null when they own none (an admin or a member of someone else's): the
 * caller sends them to their usual landing.
 */
export async function ownedOrganizationDoorDestination(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('organizations!inner(id, slug, name, plan_id, account_kind, subscription_status)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active');
  if (error) {
    console.error('[start-plan] owned organization read failed:', error);
    return null;
  }
  type OwnedOrg = { id: string; slug: string; name: string; plan_id: string; account_kind: string | null; subscription_status: string | null };
  const owned = (data ?? [])
    .map(row => (row as { organizations: OwnedOrg | OwnedOrg[] }).organizations)
    .map(org => (Array.isArray(org) ? org[0] : org))
    .find(org => org && !isTeamWorkspaceOrg({ accountKind: org.account_kind, planId: org.plan_id }));
  if (!owned) return null;
  if (owned.plan_id === 'tournament' && (await readStartPlan(owned.id))) return startPlanCancelPath(owned.slug);
  return getBillingHref(billingUrlOrgFromRow(owned));
}

/**
 * The paid door pages' signed-in gates, in order (they mirror /start/tournament's, plus trap D): staff never; an owner
 * of a real organization to that organization (above); any other member of a real organization to their landing; a live
 * invitation to Home's card; and on Start a club, a Premium coach to their own portal's Plan & billing, where "Start your
 * club" makes the portal the club with the team in it. Null: the door's step 2 may show. `/api/org/create` enforces the
 * organization and portal halves itself.
 */
export async function paidDoorRedirect(user: { id: string; email: string }, door: PaidDoor): Promise<string | null> {
  const [isStaff, inRealOrg, liveInvitation, portal] = await Promise.all([
    isPlatformAdminEmail(user.email),
    userBelongsToOtherRealOrg(user.id),
    hasLiveInvitation(user.id),
    door === 'club' ? getActiveOwnedTeamWorkspace(user.id).catch(() => null) : Promise.resolve(null),
  ]);
  if (isStaff) return '/platform-admin';
  if (inRealOrg) {
    return (await ownedOrganizationDoorDestination(user.id)) ?? getAuthDestination();
  }
  if (liveInvitation) return '/discover';
  if (portal) return `/${portal.orgSlug}/coaches/billing`;
  return null;
}

/** Where Stripe sends a paid door's buyer back: the wait (with the session, so a page with no payment says so at once). */
export function startPlanSuccessPath(orgSlug: string, door: PaidDoor): string {
  // The door rides along so the wait says "club" or "league" even if the plan lands before the page reads its offer.
  return `/${orgSlug}/admin/onboarding?setup=1&door=${door}&session_id={CHECKOUT_SESSION_ID}`;
}
/** Where backing out of Stripe's page lands: the same plan step, so the Club or League Plus cards are what they see again. */
export function startPlanCancelPath(orgSlug: string): string {
  return `/${orgSlug}/admin/onboarding?choosePlan=1`;
}

/**
 * Has the paid plan landed? (trap A). `no_payment` at once for a page with no completed checkout of THIS organization
 * (no session, one Stripe refuses, another organization's); `ready` once the webhook has written this checkout's
 * subscription onto the organization; otherwise `setting_up`. A read that fails for any other reason keeps waiting
 * rather than telling a paying owner their payment is missing (the Coaches Portal return's rule).
 */
export async function startPlanSetupState(orgId: string, sessionId: string | null): Promise<StartPlanSetupState> {
  if (!sessionId?.startsWith('cs_')) return 'no_payment';
  const { stripe } = await import('./stripe');
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if ((error as { type?: string })?.type === 'StripeInvalidRequestError') return 'no_payment';
    console.error('[start-plan] session read failed:', error);
    return 'setting_up';
  }
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
  const paid = { orgId: session.metadata?.orgId, status: session.status, subscriptionId };
  if (!isCompletedCheckoutOf(paid, orgId)) return 'no_payment';

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('plan_id, stripe_subscription_id')
    .eq('id', orgId)
    .maybeSingle<{ plan_id: string | null; stripe_subscription_id: string | null }>();
  if (error || !data) {
    if (error) console.error('[start-plan] organization read failed:', error);
    return 'setting_up';
  }
  return startPlanSetupDecision(paid, { id: orgId, planId: data.plan_id, stripeSubscriptionId: data.stripe_subscription_id });
}
