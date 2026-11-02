import 'server-only';

/**
 * The real database, Stripe and email halves of lib/plan-ending.ts (a plan ends on its renewal date — Plans end at
 * renewal, Stage 1). The rules live there and are tested with an in-memory store; this file only reads and writes.
 */
import { getStripe } from './stripe';
import { supabaseAdmin, getOrgOwnerEmail } from './supabase-admin';
import { buildCancellationPreflight, retentionDateLabel, retentionDaysFor } from './billing-retention';
import { closePagesIfPaymentsEnded } from './online-payment-endings';
import { writePlatformEvent } from './platform-events';
import { sendTransactionalEmail } from './platform-email-templates';
import { cancellationConfirmationHtml, teamWorkspaceCancelledHtml, SITE_URL } from './email';
import { teamWorkspaceDisplayName, teamWorkspaceReactivatePath } from './coaches-portal-routes';
import { getBillingHref, billingUrlOrgFromRow } from './billing-urls';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import { PLAN_CONFIG } from './plan-config';
import { moveDirection } from './plan-move-options';
import type { Organization, OrgPlan } from './types';
import { pickAppliedEnding, type EndingAccount, type EndingDeps, type NewEndingIntent } from './plan-ending';
import { INTENT_COLUMNS, findPending, fromRow, toRow, updateIntent, type IntentRow } from './plan-ending-store';

export { readPendingEnding, withdrawPendingEnding } from './plan-ending-store';

type AccountRow = {
  id: string; name: string; slug: string; plan_id: string; account_kind: string | null; enabled_addons: string[] | null;
  subscription_status: string | null; stripe_subscription_id: string | null;
};

/** The account a cancel is about, read fresh. A Coaches Portal's subscription id may sit only on its workspace row. */
export async function readEndingAccount(orgId: string): Promise<EndingAccount | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, account_kind, enabled_addons, subscription_status, stripe_subscription_id')
    .eq('id', orgId)
    .maybeSingle<AccountRow>();
  if (error) throw new Error(`Couldn't read the account: ${error.message}`);
  if (!data) return null;
  const isCoachesPortal = isTeamWorkspaceOrg({ accountKind: data.account_kind, planId: data.plan_id });
  let teamWorkspaceId: string | null = null;
  let workspaceSubscriptionId: string | null = null;
  if (isCoachesPortal) {
    const { data: ws, error: wsError } = await supabaseAdmin
      .from('team_workspaces')
      .select('id, stripe_subscription_id')
      .eq('workspace_org_id', orgId)
      .maybeSingle<{ id: string; stripe_subscription_id: string | null }>();
    if (wsError) throw new Error(`Couldn't read the Coaches Portal: ${wsError.message}`);
    teamWorkspaceId = ws?.id ?? null;
    workspaceSubscriptionId = ws?.stripe_subscription_id ?? null;
  }
  return {
    orgId: data.id, name: data.name, slug: data.slug, ownPlan: data.plan_id as OrgPlan, accountKind: data.account_kind,
    enabledAddons: data.enabled_addons ?? [], isCoachesPortal, teamWorkspaceId, subscriptionStatus: data.subscription_status,
    subscriptionId: data.stripe_subscription_id ?? workspaceSubscriptionId,
  };
}

/**
 * The account a Stripe subscription bills, for the webhook — only when our record FOLLOWS that subscription (a second
 * subscription, or an old one after a new one took over, must not touch the record: billing-one-subscription-record).
 */
export async function endingAccountForSubscription(subscriptionId: string, customerId: string): Promise<EndingAccount | null> {
  const { data: ws, error: wsError } = await supabaseAdmin
    .from('team_workspaces')
    .select('workspace_org_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle<{ workspace_org_id: string | null }>();
  if (wsError) throw new Error(`Couldn't find the subscription's Coaches Portal: ${wsError.message}`);
  if (ws?.workspace_org_id) return readEndingAccount(ws.workspace_org_id);
  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .select('id, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle<{ id: string; stripe_subscription_id: string | null }>();
  if (error) throw new Error(`Couldn't find the subscription's club: ${error.message}`);
  if (!org || org.stripe_subscription_id !== subscriptionId) return null;
  return readEndingAccount(org.id);
}

function asOrganization(account: EndingAccount): Organization {
  return {
    id: account.orgId, name: account.name, slug: account.slug, planId: account.ownPlan,
    subscriptionStatus: (account.subscriptionStatus ?? 'active') as Organization['subscriptionStatus'],
    enabledAddons: account.enabledAddons, accountKind: (account.accountKind ?? 'org') as Organization['accountKind'],
    tournamentLimit: PLAN_CONFIG[account.ownPlan]?.tournamentLimit ?? 1, teamLimit: PLAN_CONFIG[account.ownPlan]?.teamLimit ?? 0,
    isPublic: false, createdAt: new Date().toISOString(), isDiscoverable: false,
    // Billing-only projection of the org — no coach-facing setting is read from it.
    clubBookSharingEnabled: false,
  };
}

export const endingDeps: EndingDeps = {
  now: () => new Date(),
  retentionDays: account => retentionDaysFor({ accountKind: account.accountKind as Organization['accountKind'], planId: account.ownPlan }),

  findPending,

  async findAppliedFor(orgId, subscriptionId, subscriptionCreatedAt) {
    const { data, error } = await supabaseAdmin
      .from('billing_retention_intents')
      .select(`${INTENT_COLUMNS}, intent_type, target_plan`)
      .eq('org_id', orgId)
      .eq('status', 'applied')
      .in('intent_type', ['cancellation', 'downgrade'])
      .order('applied_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(`Couldn't read the account's endings: ${error.message}`);
    const rows = ((data ?? []) as unknown as Array<IntentRow & { intent_type: 'cancellation' | 'downgrade'; target_plan: string | null }>)
      .map(r => ({ ...fromRow(r), intentType: r.intent_type, targetPlan: r.target_plan }));
    return pickAppliedEnding(rows, subscriptionId, subscriptionCreatedAt);
  },

  async insertIntent(row: NewEndingIntent) {
    const { data, error } = await supabaseAdmin
      .from('billing_retention_intents')
      .insert({ org_id: row.orgId, intent_type: 'cancellation', target_plan: null, keep_tournament_ids: [], ...toRow(row) })
      .select(INTENT_COLUMNS)
      .single<IntentRow>();
    if (error) {
      if (error.code === '23505') return 'conflict';
      throw new Error(`Couldn't record the cancel: ${error.message}`);
    }
    return fromRow(data);
  },

  updateIntent,

  async preflight(account) {
    const { tournaments, shutsDown } = await buildCancellationPreflight(asOrganization(account));
    return { tournaments, shutsDown };
  },

  async recordedFor(intentId) {
    const { data, error } = await supabaseAdmin
      .from('billing_retained_records')
      .select('record_type, record_id')
      .eq('intent_id', intentId);
    if (error) throw new Error(`Couldn't read the kept records: ${error.message}`);
    return ((data ?? []) as Array<{ record_type: string; record_id: string | null }>).map(r => ({ recordType: r.record_type, recordId: r.record_id }));
  },

  async supersedeOthers(orgId, tournamentIds, intentId) {
    // Supersede any OTHER live retained record for these tournaments before inserting fresh ones — prevents unique
    // constraint violations if a prior retention event left stale rows (e.g. after a test reset or a resubscription).
    const { error } = await supabaseAdmin
      .from('billing_retained_records')
      .update({ retained_state: 'purged' })
      .eq('org_id', orgId)
      .in('record_id', tournamentIds)
      .in('retained_state', ['retained_inactive', 'pending_purge'])
      .neq('intent_id', intentId);
    if (error) throw new Error(`Couldn't supersede the old records: ${error.message}`);
  },

  async insertRecords(rows) {
    const { error } = await supabaseAdmin.from('billing_retained_records').insert(rows.map(r => ({
      intent_id: r.intentId, org_id: r.orgId, record_type: r.recordType, record_id: r.recordId, display_name: r.displayName,
      retained_state: 'retained_inactive', retention_until: r.retentionUntil, metadata: r.metadata,
    })));
    if (error) throw new Error(`Couldn't write the kept records: ${error.message}`);
  },

  async archive(orgId, tournamentIds) {
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'archived', is_active: false })
      .eq('org_id', orgId)
      .in('id', tournamentIds);
    if (error) throw new Error(`Couldn't archive the tournaments: ${error.message}`);
  },

  async suspend(account, { endedAt, reason }) {
    const now = new Date().toISOString();
    if (account.isCoachesPortal) {
      // A Coaches Portal: the workspace and its Premium tools end too (the owner door's version, decision 2). Its own
      // public team pages are not taken down — basic tournament records stay available.
      if (account.teamWorkspaceId) {
        const [{ error: wsError }, { error: entError }] = await Promise.all([
          supabaseAdmin.from('team_workspaces').update({ subscription_status: 'canceled', updated_at: now }).eq('id', account.teamWorkspaceId),
          supabaseAdmin.from('team_entitlements').update({ status: 'canceled', updated_at: now }).eq('team_workspace_id', account.teamWorkspaceId),
        ]);
        if (wsError) throw new Error(`Couldn't end the Coaches Portal: ${wsError.message}`);
        if (entError) throw new Error(`Couldn't end the Premium tools: ${entError.message}`);
      }
      const { error } = await supabaseAdmin.from('organizations')
        .update({ subscription_status: 'canceled', billing_suspended_at: endedAt, billing_suspension_reason: reason })
        .eq('id', account.orgId);
      if (error) throw new Error(`Couldn't suspend the account: ${error.message}`);
      return;
    }
    const { error } = await supabaseAdmin.from('organizations')
      .update({ subscription_status: 'canceled', is_public: false, billing_suspended_at: endedAt, billing_suspension_reason: reason })
      .eq('id', account.orgId);
    if (error) throw new Error(`Couldn't suspend the account: ${error.message}`);
  },

  async closePayPages(orgId, where) {
    // 12d-2 (ask 11): an ending stops online payments — the open pay pages close (the account stays connected, ask 4).
    await closePagesIfPaymentsEnded(orgId, where, { ended: true });
  },

  async writeEndedEvent(e) {
    await writePlatformEvent({
      eventType: 'subscription_canceled',
      source: e.source,
      sourceEventId: e.sourceEventId,
      orgId: e.account.orgId,
      actorUserId: e.actorUserId,
      actorEmail: e.actorEmail,
      previousPlanId: e.account.ownPlan,
      planId: e.account.ownPlan,
      previousSubscriptionStatus: e.account.subscriptionStatus,
      subscriptionStatus: 'canceled',
      metadata: {
        requestedBy: e.requestedBy,
        reason: e.reason,
        endedAt: e.endedAt,
        retentionUntil: e.retentionUntil,
        retainedTournamentIds: e.retainedTournamentIds,
        intentId: e.intentId,
        ...(e.account.isCoachesPortal ? { scope: 'coaches_portal', teamWorkspaceId: e.account.teamWorkspaceId } : {}),
      },
    });
  },

  async sendEndedEmail({ account, intentId, retentionUntil, retainedTournaments, askedBy }) {
    const ownerEmail = await getOrgOwnerEmail(account.orgId);
    if (!ownerEmail) return;
    const kept = retentionDateLabel(retentionUntil);
    const idempotencyKey = `intent:${intentId}:ended_email`;
    if (account.isCoachesPortal) {
      // The org is named "{team} Coaches Portal" and the copy says "Coaches Portal" itself — pass the team name alone.
      // Resubscribe is the reactivation door, never the new-portal signup.
      const workspaceName = teamWorkspaceDisplayName(account.name);
      const resubscribeUrl = `${SITE_URL}${teamWorkspaceReactivatePath({ slug: account.slug, name: account.name })}`;
      await sendTransactionalEmail({
        key: 'team_workspace_cancelled',
        to: ownerEmail,
        vars: { workspaceName, resubscribeUrl, retentionUntil: kept },
        defaultSubject: `Your ${workspaceName} Coaches Portal has been cancelled`,
        defaultHtml: teamWorkspaceCancelledHtml({ workspaceName, resubscribeUrl, retentionUntil: kept }),
        orgId: account.orgId,
        askedBy,
        idempotencyKey,
      });
      return;
    }
    const planLabel = PLAN_CONFIG[account.ownPlan]?.label ?? account.ownPlan;
    const resubscribeUrl = `${SITE_URL}${getBillingHref(billingUrlOrgFromRow({ slug: account.slug, plan_id: account.ownPlan, account_kind: account.accountKind, name: account.name }, 'canceled'))}`;
    await sendTransactionalEmail({
      key: 'cancellation_confirmation',
      to: ownerEmail,
      vars: { orgName: account.name, planLabel, retentionUntil: kept, resubscribeUrl },
      defaultSubject: `Your ${account.name} subscription has been cancelled`,
      defaultHtml: cancellationConfirmationHtml({ orgName: account.name, planLabel, retentionUntil: kept, retainedTournaments, resubscribeUrl }),
      orgId: account.orgId,
      askedBy,
      idempotencyKey,
    });
  },

  retrieveSubscription: id => getStripe().subscriptions.retrieve(id, { expand: ['schedule'] }),
  scheduleCancel: id => getStripe().subscriptions.update(id, { cancel_at_period_end: true }),
  // Clear the signal Stripe holds: the flag, or a dated cancel_at (G8) — never both at once.
  clearCancel: (id, clear) => getStripe().subscriptions.update(id, clear === 'period_end' ? { cancel_at_period_end: false } : { cancel_at: '' }),
  async releaseSchedule(scheduleId) {
    await getStripe().subscriptionSchedules.release(scheduleId);
  },
  async rescheduleMove(account, plan, actor) {
    // Only ever a move DOWN (a schedule at renewal, no charge): an up move would take money, which a keep never does.
    if (moveDirection(account.ownPlan, plan) !== 'down') return { ok: false, error: 'That plan is no longer a move down from this one.' };
    // Lazy: plan-move reaches the reactivation path, which withdraws waiting cancels through this file.
    const { applyMove } = await import('./plan-move');
    const result = await applyMove({
      id: account.orgId, planId: account.ownPlan, stripeSubscriptionId: account.subscriptionId, subscriptionStatus: account.subscriptionStatus,
    }, plan, { actor });
    return 'code' in result ? { ok: false, error: result.error } : { ok: true };
  },
};

