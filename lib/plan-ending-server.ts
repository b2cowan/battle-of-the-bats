import 'server-only';

/**
 * The real database, Stripe and email halves of lib/plan-ending.ts (a plan ends on its renewal date — Plans end at
 * renewal, Stage 1). The rules live there and are tested with an in-memory store; this file only reads and writes.
 */
import { getStripe } from './stripe';
import { supabaseAdmin, getOrgOwnerEmail } from './supabase-admin';
import { buildCancellationPreflight, getNonArchivedTournaments, getSlotHoldingTournaments, retentionDateLabel, retentionDaysFor } from './billing-retention';
import { closePagesIfPaymentsEnded } from './online-payment-endings';
import { writePlatformEvent } from './platform-events';
import { sendTransactionalEmail } from './platform-email-templates';
import { cancellationConfirmationHtml, teamWorkspaceCancelledHtml, SITE_URL } from './email';
import { teamWorkspaceDisplayName, teamWorkspaceReactivatePath } from './coaches-portal-routes';
import { getBillingHref, billingUrlOrgFromRow } from './billing-urls';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import { PLAN_CONFIG, type BillingCycle } from './plan-config';
import { moveDirection } from './plan-move-options';
import type { Organization, OrgPlan } from './types';
import { syncTeamWorkspaceSubscription } from './team-checkout';
import { PLAN_BILLING_WORDS as W } from './plan-billing-words';
import { endingEmail, type EndingEmailFacts, type MoveEmailFacts } from './plan-ending-emails';
import {
  askingDoor, clickedAt, daysOverdue, endingEmailTiming, isOverdueEnding, moveTargetOf, pickAppliedEnding, sendDueEndingEmails, waitingMoveView,
  type EndingAccount, type EndingDeps, type EndingEmail, type EndingEmailStamp, type EndingIntent, type NewEndingIntent, type OverdueEnding,
} from './plan-ending';
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

const STAMP_COLUMN: Record<EndingEmailStamp, string> = {
  ends_on: 'ends_on_email_sent_at', reminder: 'reminder_email_sent_at', kept: 'kept_email_sent_at',
  // A move's "now on {plan}" email: a move never sends a cancel's "cancelled" email, so its row's column is free.
  moved: 'ended_email_sent_at',
};

/**
 * A move's words (Stage 2 Part C). Waiting: what the date would keep and archive if it came now — through the band's own
 * `waitingMoveView`, so the email can never name a different tournament than the page and the date. Done: what it did.
 */
async function moveEmailFacts(email: EndingEmail): Promise<MoveEmailFacts | null> {
  const { intent } = email;
  if (intent.intentType !== 'downgrade') return null;
  const target = PLAN_CONFIG[moveTargetOf(intent)].label;
  const picked = intent.keepTournamentIds.length > 0;
  if (email.kind === 'moved') {
    return { target, kept: email.kept, archived: email.archived, fellBack: email.keptByDefault, picked, choose: false };
  }
  if (email.kind === 'kept') return { target, kept: [], archived: [], fellBack: false, picked, choose: false };
  const view = waitingMoveView(intent, await getSlotHoldingTournaments(intent.orgId));
  return { target, kept: view.kept.map(t => t.name), archived: view.archived.map(t => t.name), fellBack: view.fellBack, picked, choose: view.choose };
}

/** What a Part C email says, read fresh: the plan, the charge, the live tournaments the date archives, the links. */
async function endingEmailFacts(email: EndingEmail): Promise<EndingEmailFacts> {
  const { account, intent } = email;
  const move = await moveEmailFacts(email);
  // The charge is said only by a cancel's emails and by any kept email; a move's own three never name a price.
  const { data: org, error } = move && email.kind !== 'kept' ? { data: null, error: null } : await supabaseAdmin
    .from('organizations')
    .select('subscription_period, subscription_amount_cents, subscription_currency')
    .eq('id', account.orgId)
    .maybeSingle<{ subscription_period: string | null; subscription_amount_cents: number | null; subscription_currency: string | null }>();
  if (error) throw new Error(`Couldn't read the plan's charge: ${error.message}`);
  const period: BillingCycle = org?.subscription_period === 'annual' ? 'annual' : 'monthly';
  const renewsAs = email.kind === 'kept' ? email.renewsAs : null;
  // The billing page's Keep window's rule: a cheaper move's list price, else what the subscription charges.
  const price = renewsAs ? W.plan.charge(renewsAs, period)
    : PLAN_CONFIG[account.ownPlan] ? W.plan.charge(account.ownPlan, period, org?.subscription_amount_cents, org?.subscription_currency) : null;
  const timing = endingEmailTiming(intent, new Date());
  // What the end date archives: every tournament not archived yet (the same read the ending makes on the day).
  const tournaments = email.kind === 'kept' || move ? 0 : (await getNonArchivedTournaments(account.orgId)).length;
  const billingUrl = `${SITE_URL}${getBillingHref(billingUrlOrgFromRow({ slug: account.slug, plan_id: account.ownPlan, account_kind: account.accountKind, name: account.name }), { purpose: 'return' })}`;
  const date = email.kind === 'kept' ? email.renewsOn : email.kind === 'moved' ? email.movedAt : intent.effectiveAt;
  // A move names the plan it moves FROM: on the date (or a replay after it) the account's own plan is already the free one.
  const fromPlan = (move ? intent.fromPlan ?? account.ownPlan : account.ownPlan) as OrgPlan;
  return {
    kind: email.kind,
    move,
    portal: account.isCoachesPortal,
    orgName: account.isCoachesPortal ? teamWorkspaceDisplayName(account.name) : account.name,
    plan: account.isCoachesPortal ? 'team' : fromPlan,
    planLabel: account.isCoachesPortal ? 'Premium' : PLAN_CONFIG[fromPlan]?.label ?? fromPlan,
    door: email.kind === 'kept' ? email.door : askingDoor(intent),
    clickedAt: clickedAt(intent),
    date,
    retentionUntil: email.kind === 'moved' ? email.retentionUntil : intent.retentionUntil,
    tournaments,
    trialing: account.subscriptionStatus === 'trialing',
    remindLater: email.kind === 'ends_on' && timing.remindLater,
    daysLeft: timing.daysLeft,
    renewsAs: renewsAs ? PLAN_CONFIG[renewsAs]?.label ?? renewsAs : null,
    price,
    keepUrl: `${billingUrl}?keep_plan=1`,
    billingUrl,
  };
}

/** Every change waiting for its date (a cancel or a move to the free plan) — the daily job's rows. A handful at most; read whole. */
async function readPendingEndings(): Promise<EndingIntent[]> {
  const { data, error } = await supabaseAdmin
    .from('billing_retention_intents')
    .select(INTENT_COLUMNS)
    .eq('status', 'pending')
    .order('effective_at');
  if (error) throw new Error(`Couldn't read the waiting changes: ${error.message}`);
  return ((data ?? []) as unknown as IntentRow[]).map(fromRow);
}

/** The daily job's email step (G6): the click's "ends on" email that never went, then the seven-day reminder. */
export async function sendEndingEmails(now: Date): Promise<{ endsOn: number; reminders: number; failed: number }> {
  return sendDueEndingEmails(await readPendingEndings(), readEndingAccount, { ...endingDeps, now: () => now });
}

/**
 * G3 · the endings Stripe hasn't finished: a cancel (or a move to the free plan) still waiting more than three days past its date. The daily job counts
 * them; the retention page and the club's record list them. A read only — it never acts.
 */
export async function readOverdueEndings(now: Date): Promise<OverdueEnding[]> {
  const overdue = await readOverdueIntents(now);
  if (overdue.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, plan_id')
    .in('id', overdue.map(i => i.orgId));
  if (error) throw new Error(`Couldn't read the overdue accounts: ${error.message}`);
  const orgs = new Map(((data ?? []) as Array<{ id: string; name: string; plan_id: string }>).map(o => [o.id, o]));
  return overdue.map(i => {
    const org = orgs.get(i.orgId);
    const asked = i.changeLog.find(e => e.action === 'scheduled') ?? i.changeLog[0] ?? null;
    return {
      orgId: i.orgId,
      orgName: org?.name ?? 'Unknown club',
      planLabel: PLAN_CONFIG[(org?.plan_id ?? i.fromPlan) as OrgPlan]?.label ?? org?.plan_id ?? '',
      shouldHaveEnded: i.effectiveAt,
      daysOver: daysOverdue(i, now),
      door: asked?.door ?? null,
      by: asked?.by ?? i.createdByEmail,
      movesTo: i.intentType === 'downgrade' ? PLAN_CONFIG[moveTargetOf(i)].label : null,
    };
  });
}

async function readOverdueIntents(now: Date): Promise<EndingIntent[]> {
  return (await readPendingEndings()).filter(i => isOverdueEnding(i, now));
}

/** The daily job's overdue step (G3): counted on the job's own record. Never acts. */
export async function countOverdueEndings(now: Date): Promise<{ overdue: number; orgIds: string[] }> {
  const rows = await readOverdueIntents(now);
  return { overdue: rows.length, orgIds: rows.map(r => r.orgId) };
}

export const endingDeps: EndingDeps = {
  now: () => new Date(),
  retentionDays: account => retentionDaysFor({ accountKind: account.accountKind as Organization['accountKind'], planId: account.ownPlan }),

  findPending,

  async findAppliedFor(orgId, subscriptionId, subscriptionCreatedAt) {
    const { data, error } = await supabaseAdmin
      .from('billing_retention_intents')
      .select(INTENT_COLUMNS)
      .eq('org_id', orgId)
      .eq('status', 'applied')
      .in('intent_type', ['cancellation', 'downgrade'])
      .order('applied_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(`Couldn't read the account's endings: ${error.message}`);
    return pickAppliedEnding(((data ?? []) as unknown as IntentRow[]).map(fromRow), subscriptionId, subscriptionCreatedAt);
  },

  async insertIntent(row: NewEndingIntent) {
    const { data, error } = await supabaseAdmin
      .from('billing_retention_intents')
      .insert({ org_id: row.orgId, ...toRow(row) })
      .select(INTENT_COLUMNS)
      .single<IntentRow>();
    if (error) {
      if (error.code === '23505') return 'conflict';
      throw new Error(`Couldn't record the waiting change: ${error.message}`);
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
      .select('record_type, record_id, display_name')
      .eq('intent_id', intentId);
    if (error) throw new Error(`Couldn't read the kept records: ${error.message}`);
    return ((data ?? []) as Array<{ record_type: string; record_id: string | null; display_name: string | null }>)
      .map(r => ({ recordType: r.record_type, recordId: r.record_id, displayName: r.display_name }));
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

  // Read ON THE DATE (G2): a tournament made during the wait is here — the same slot-holder read the downgrade window offers.
  slotHolders: getSlotHoldingTournaments,

  async setPlan(orgId, plan) {
    // The move to the free plan, on its date: the plan and its limit; the account stays active (never suspended).
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ plan_id: plan, tournament_limit: PLAN_CONFIG[plan].tournamentLimit, subscription_status: 'active' })
      .eq('id', orgId);
    if (error) throw new Error(`Couldn't move the plan: ${error.message}`);
  },

  async writeDowngradedEvent(e) {
    await writePlatformEvent({
      eventType: 'plan_downgraded',
      source: 'app',
      sourceEventId: e.sourceEventId,
      orgId: e.account.orgId,
      actorUserId: e.actorUserId,
      actorEmail: e.actorEmail,
      previousPlanId: e.fromPlan,
      planId: e.targetPlan,
      previousSubscriptionStatus: e.account.subscriptionStatus,
      subscriptionStatus: 'active',
      metadata: {
        reason: e.reason,
        movedAt: e.movedAt,
        retentionUntil: e.retentionUntil,
        retainedTournamentIds: e.retainedTournamentIds,
        keepTournamentIds: e.keptTournamentIds,
        keptByDefault: e.keptByDefault,
        intentId: e.intentId,
      },
    });
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

  async closePayPagesIfPlanHasNone(orgId) {
    // A move to the free plan: closed only when that plan has no online payments (read after the plan was written).
    await closePagesIfPaymentsEnded(orgId, 'owner downgrade');
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

  async claimEmail(intentId, stamp, onlyIf) {
    const column = STAMP_COLUMN[stamp];
    const at = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('billing_retention_intents')
      .update({ [column]: at, updated_at: at })
      .eq('id', intentId)
      .is(column, null)
      .in('status', onlyIf)
      .select('id');
    if (error) throw new Error(`Couldn't claim the email: ${error.message}`);
    return data && data.length > 0 ? at : null;
  },

  async releaseEmail(intentId, stamp, claimedAt) {
    const column = STAMP_COLUMN[stamp];
    const { error } = await supabaseAdmin
      .from('billing_retention_intents')
      .update({ [column]: null })
      .eq('id', intentId)
      .eq(column, claimedAt);
    if (error) throw new Error(`Couldn't hand the email back: ${error.message}`);
  },

  async sendEndingEmail(email) {
    // Before the send: a failure here means nothing went, so the claim goes back for the next run.
    let to: string;
    let out: ReturnType<typeof endingEmail>;
    try {
      const ownerEmail = await getOrgOwnerEmail(email.account.orgId);
      if (!ownerEmail) return 'not_sent';
      to = ownerEmail;
      out = endingEmail(await endingEmailFacts(email));
    } catch {
      return 'not_sent';
    }
    try {
      const sent = await sendTransactionalEmail({
        key: out.key, to, vars: out.vars, defaultSubject: out.subject, defaultHtml: out.html,
        orgId: email.account.orgId, askedBy: email.intent.createdBy,
        // The email service's own guard for a retry inside a day; the row's stamp is the real one.
        idempotencyKey: `intent:${email.intent.id}:${email.kind}_email`,
      });
      // 'skipped': no email service here (dev) — nothing to retry. Only a definite refusal is "not sent" (lib/email.ts).
      if (sent.status === 'sent' || sent.status === 'skipped') return 'sent';
      return sent.status === 'provider_error' && sent.refused ? 'not_sent' : 'unknown';
    } catch {
      return 'unknown'; // the request may have reached the email service
    }
  },

  async clearEndedSubscription(account, sub) {
    // What the webhook's `deleted` arm does after its ending (lib/billing-webhook-handler.ts), for an ending finished by
    // hand because that event never arrived. Not shared code: the arm is pinned by its own guard tests.
    if (account.isCoachesPortal) {
      await syncTeamWorkspaceSubscription({
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
        stripeSubscriptionId: sub.id,
        stripeSubscriptionItemId: sub.items?.data?.[0]?.id ?? null,
        subscriptionStatus: 'canceled',
        currentPeriodEnd: sub.items?.data?.[0]?.current_period_end ? new Date(sub.items.data[0].current_period_end * 1000).toISOString() : null,
      });
      return;
    }
    // Only the subscription our record follows (billing-one-subscription-record).
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ stripe_subscription_id: null, subscription_period: null, current_period_end: null, subscription_amount_cents: null, subscription_currency: null })
      .eq('id', account.orgId)
      .eq('stripe_subscription_id', sub.id);
    if (error) throw new Error(`Couldn't clear the ended subscription: ${error.message}`);
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
    }, plan, { actor, restore: true }); // the flow's own put-back: our waiting row does not refuse it (F3)
    return 'code' in result ? { ok: false, error: result.error } : { ok: true };
  },
};

