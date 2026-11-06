import { supabaseAdmin } from './supabase-admin';
import { clubUpgradeStateOf, type ClubUpgradeState } from './workspace-upgrade';

/**
 * Would the flip refuse this portal for a reason no payment can fix? Asked BEFORE any charge (the move's validation, the in-place
 * checkout), because the flip says no by name AFTER the money is taken. The same two rules as the flip (mig 414): the workspace has
 * not already moved into someone else's club, and the organization holds no more than its one team. And a third, ours (GST/HST
 * Stage 2 Part 7, owner 2026-11-06): its Stripe customer pays for no OTHER portal. A coach has one customer for every portal they
 * buy (lib/team-checkout-customer.ts), and the club's address and name go onto that customer before the move (Ask 2) — they would
 * then tax and name the coach's other portal's renewals too. Contact us; the club gets set up by hand.
 *
 * Returns a sentence the screen can show, or null when the portal can become a club. An ordinary club has no workspace row and is
 * never asked. Throws when the database does (the caller answers 500; nothing has been charged).
 */
export async function workspaceCannotBecomeClub(orgId: string): Promise<string | null> {
  const [{ data: workspace, error: workspaceError }, { count, error: teamsError }] = await Promise.all([
    supabaseAdmin
      .from('team_workspaces')
      .select('workspace_state, stripe_customer_id')
      .eq('workspace_org_id', orgId)
      .maybeSingle<{ workspace_state: string | null; stripe_customer_id: string | null }>(),
    supabaseAdmin
      .from('rep_teams')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId),
  ]);
  if (workspaceError) throw workspaceError;
  if (teamsError) throw teamsError;
  if (!workspace) return null;
  if (workspace.workspace_state === 'archived' || workspace.workspace_state === 'org_owned') {
    return 'This workspace has moved into a club, so it can’t become a new one. Contact us and we’ll sort it out.';
  }
  if ((count ?? 0) > 1) {
    return 'This workspace holds more than one team, so it can’t become a club on its own yet. Contact us and we’ll help.';
  }
  const customer = workspace.stripe_customer_id;
  if (customer && !customer.startsWith('mock_')) {
    const { count: others, error: othersError } = await supabaseAdmin
      .from('team_workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('stripe_customer_id', customer)
      .neq('workspace_org_id', orgId)
      .not('stripe_subscription_id', 'is', null)
      // Only a portal that still renews on this customer: an ended one keeps its old subscription id (the webhook finds it by
      // it), a club-paid one (org_team_addon) carries the club's customer, and one that moved into a club is not billed.
      .not('subscription_status', 'in', '(canceled,incomplete_expired)')
      .neq('billing_mode', 'org_team_addon')
      .not('workspace_state', 'in', '(org_owned,archived)');
    if (othersError) throw othersError;
    if ((others ?? 0) > 0) {
      return 'This workspace’s billing also pays for another Coaches Portal, so it can’t become a club on its own yet. Contact us and we’ll set the club up.';
    }
  }
  return null;
}

/**
 * "HAS MY PORTAL BECOME THE CLUB YET?" — the one database read behind the "Setting up your club" screen (Plan & billing Stage 4b,
 * Part 2). The decision is `clubUpgradeStateOf` (pure, lib/workspace-upgrade.ts); this module only fetches the two rows it needs.
 *
 * Two fresh reads by organization id, so the answer is the same on both sides of the flip. Throws when the database does; the route
 * answers 500 and the screen's next poll asks again.
 */
export async function readClubUpgradeState(orgId: string): Promise<ClubUpgradeState> {
  const [{ data: org, error: orgError }, { data: workspace, error: workspaceError }] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('account_kind, plan_id, subscription_status, stripe_subscription_id')
      .eq('id', orgId)
      .maybeSingle<{ account_kind: string | null; plan_id: string | null; subscription_status: string | null; stripe_subscription_id: string | null }>(),
    supabaseAdmin
      .from('team_workspaces')
      .select('workspace_state, billing_mode')
      .eq('workspace_org_id', orgId)
      .maybeSingle<{ workspace_state: string | null; billing_mode: string | null }>(),
  ]);
  if (orgError) throw orgError;
  if (workspaceError) throw workspaceError;
  if (!org) return { becameClub: false, waitingOnPayment: false };
  return clubUpgradeStateOf(org, workspace ?? null);
}
