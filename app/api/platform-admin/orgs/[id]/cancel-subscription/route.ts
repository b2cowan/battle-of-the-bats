import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeAuditBeforeChange, writePlatformAuditLog } from '@/lib/platform-audit';
import { buildCancellationPreflight } from '@/lib/billing-retention';
import { getStripe } from '@/lib/stripe';
import { PLAN_CONFIG, getEffectiveTeamLimit } from '@/lib/plan-config';
import type { OrgPlan, Organization } from '@/lib/types';
import { withObservability, captureAndJson } from '@/lib/observability';
import { endingSection } from '@/lib/online-payment-endings';
import { runningPortalFreeTime } from '@/lib/portal-free-time-server';
import { staffCancelRefusal } from '@/lib/portal-free-time';
import { applyEnding, hasRealSubscription, keepEnding, scheduleEnding, type EndingAccount } from '@/lib/plan-ending';
import { endingDeps, readEndingAccount, readPendingEnding } from '@/lib/plan-ending-server';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';

/**
 * The platform admin's cancel (org record → Access). Plans end at the renewal date (owner ruling 2026-10-31, Stage 1):
 *   POST            Cancel — the SAME scheduled cancel the owner makes: ends on the renewal date, they keep everything until then.
 *   POST endNow     End now — immediate (abuse, fraud, a chargeback): the ending runs now and Stripe stops now. Never offered
 *                   to owners; secondary, behind its own red window.
 *   DELETE          Keep {Plan} on their behalf — withdraws a waiting cancel.
 * Every door needs a typed reason, and its audit row is written BEFORE the change (Stage 0 Part 9). While a cancel waits,
 * operator plan moves stay refused (lib/operator-plan-change.ts refuses while Stripe bills): End now or Keep are the exits.
 */

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan_id: string;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  enabled_addons: string[] | null;
  account_kind: string | null;
  tournament_limit: number | null;
  team_limit: number | null;
  current_period_end: string | null;
};

function mapOrgRow(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    planId: row.plan_id as OrgPlan,
    subscriptionStatus: (row.subscription_status ?? 'active') as Organization['subscriptionStatus'],
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    enabledAddons: row.enabled_addons ?? [],
    accountKind: (row.account_kind ?? 'org') as Organization['accountKind'],
    tournamentLimit: row.tournament_limit ?? 1,
    teamLimit: getEffectiveTeamLimit(row.plan_id as OrgPlan, row.team_limit),
    isPublic: false,
    createdAt: new Date().toISOString(),
    isDiscoverable: false,
    // Billing-only projection of the org — no coach-facing setting is read from it.
    clubBookSharingEnabled: false,
  };
}

const ORG_COLUMNS = 'id, name, slug, plan_id, subscription_status, stripe_subscription_id, enabled_addons, account_kind, tournament_limit, team_limit, current_period_end';

async function readOrg(id: string) {
  const { data, error } = await supabaseAdmin.from('organizations').select(ORG_COLUMNS).eq('id', id).single<OrgRow>();
  return error ? null : data;
}

function readReason(body: { reason?: unknown }): string | null {
  return typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
}

export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const orgRow = await readOrg(id);
  if (!orgRow) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  if (orgRow.account_kind === 'team_workspace') {
    const freeTime = await runningPortalFreeTime(orgRow.id);
    if (freeTime) return NextResponse.json({ error: staffCancelRefusal(orgRow.name, freeTime.lastDay) }, { status: 409 });
  }

  if (orgRow.subscription_status === 'canceled') {
    return NextResponse.json({ error: 'Subscription is already cancelled' }, { status: 400 });
  }

  const org = mapOrgRow(orgRow);
  const [preflight, account, pending] = await Promise.all([buildCancellationPreflight(org), readEndingAccount(id), readPendingEnding(id)]);

  return NextResponse.json({
    subscriptionStatus: orgRow.subscription_status,
    stripeSubscriptionId: orgRow.stripe_subscription_id,
    planId: orgRow.plan_id,
    planLabel: PLAN_CONFIG[orgRow.plan_id as OrgPlan]?.label ?? orgRow.plan_id,
    ...preflight,
    // Plans end at renewal: a real subscription waits for its renewal date (shown as a preview; Stripe's date is the one
    // recorded); with none (comped, Founding Season, a dev mock) the cancel ends now and there is no date to promise.
    waitsForRenewal: !!account && hasRealSubscription(account),
    renewsOn: account && hasRealSubscription(account) ? orgRow.current_period_end : null,
    pending: pending ? { endsAt: pending.effectiveAt, reason: pending.reason, requestedBy: pending.createdByEmail, heldMovePlan: pending.heldMovePlan } : null,
    // 12d-2 (words §4.3): the operator sees what the owner would — what stops, what is owed and clearing.
    onlinePayments: await endingSection(id),
  });
}, { route: '/api/platform-admin/orgs/[id]/cancel-subscription' });

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    reason?: string;
    notifyOwner?: boolean;
    endNow?: boolean;
  };
  const reason = readReason(body);
  const notifyOwner = body.notifyOwner === true;
  const endNow = body.endNow === true;

  if (!reason) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }

  const orgRow = await readOrg(id);
  if (!orgRow) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // A portal on staff-given free time is stored cancelled and held open by its grant: "already cancelled" would be
  // wrong, and a cancel would start the retention clock on it. End it now is the way (Stage 4b, Q11-4/T15).
  if (orgRow.account_kind === 'team_workspace') {
    const freeTime = await runningPortalFreeTime(orgRow.id);
    if (freeTime) return NextResponse.json({ error: staffCancelRefusal(orgRow.name, freeTime.lastDay) }, { status: 409 });
  }

  if (orgRow.subscription_status === 'canceled') {
    return NextResponse.json({ error: 'Subscription is already cancelled' }, { status: 400 });
  }

  const account = await readEndingAccount(id);
  if (!account) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  const actor = { door: 'operator' as const, userId: null, email: auth.user.email ?? null };
  const waits = !endNow && hasRealSubscription(account);

  // Stage 0 Part 9: the cancel's row, with its reason, before anything is written, or nothing is cancelled. Stripe is
  // still asked after it, and a Stripe failure is its own second row (unchanged).
  const change = { status: waits ? 'ends_at_renewal' : 'canceled', stripeSubscriptionId: account.subscriptionId, notifyOwner };
  const changeFailed = endNow
    ? await writeAuditBeforeChange(auth.user.email!, id, 'end_subscription_now', 'subscription_status', orgRow.subscription_status, change, { reason })
    : await writeAuditBeforeChange(auth.user.email!, id, 'cancel_subscription', 'subscription_status', orgRow.subscription_status, change, { reason });

  let outcome: { kind: 'scheduled'; endsAt: string | null; recorded: boolean } | { kind: 'ended'; retentionUntil: string | null; retainedTournamentIds: string[] };
  try {
    if (endNow) {
      const ended = await applyEnding(account, { actor, reason, notifyOwner, origin: 'request' }, endingDeps);
      outcome = { kind: 'ended', retentionUntil: ended.retentionUntil, retainedTournamentIds: ended.retainedTournamentIds };
    } else {
      const scheduled = await scheduleEnding(account, actor, { reason, notifyOwner }, endingDeps);
      if (scheduled.outcome === 'refused') {
        // Stripe refused before anything was written: the change was not made.
        await changeFailed(scheduled.error);
        return NextResponse.json({ error: scheduled.error }, { status: scheduled.status });
      }
      outcome = scheduled.outcome === 'scheduled'
        ? { kind: 'scheduled', endsAt: scheduled.endsAt, recorded: scheduled.recorded }
        : { kind: 'ended', retentionUntil: scheduled.ended.retentionUntil, retainedTournamentIds: scheduled.ended.retainedTournamentIds };
    }
  } catch (error) {
    // Not "not made": the ending may have archived tournaments by now. The cancel's row stays and a second one says it
    // did not finish (the Story tells it), in the way a Stripe failure below is told. Cancelling again finishes it.
    await writePlatformAuditLog(auth.user.email!, id, 'cancel_subscription_incomplete', 'subscription_status',
      orgRow.subscription_status, { error: error instanceof Error ? error.message : String(error) },
      { reason });
    return captureAndJson(error, { error: error instanceof Error ? error.message : 'The cancel did not finish.' }, 500);
  }

  if (outcome.kind === 'scheduled') {
    return NextResponse.json({ ok: true, outcome: 'scheduled', endsAt: outcome.endsAt, recorded: outcome.recorded });
  }

  // Ended now (End now, or no real subscription): Stripe stops now. The ending is recorded first, so the deletion Stripe
  // sends next finds this subscription's applied row and only clears the Stripe fields.
  let stripeWarning: string | null = null;
  const stripeSubscriptionId = endNow ? endNowSubscriptionId(account) : null;
  if (stripeSubscriptionId) {
    try {
      await getStripe().subscriptions.cancel(stripeSubscriptionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[platform-admin cancel-subscription] Stripe cancel failed:', message);
      await writePlatformAuditLog(
        auth.user.email!,
        id,
        'cancel_subscription_stripe_failed',
        'stripe_subscription_id',
        stripeSubscriptionId,
        { error: message },
        { reason },
      );
      stripeWarning = message;
    }
  }

  return NextResponse.json({
    ok: true,
    outcome: 'ended',
    retainedCount: outcome.retainedTournamentIds.length + 1,
    retentionUntil: outcome.retentionUntil,
    stripeWarning,
  });
}, { route: '/api/platform-admin/orgs/[id]/cancel-subscription' });

/** End now stops a real Stripe subscription (any live status); a dev `mock_…` id is not one. */
function endNowSubscriptionId(account: EndingAccount): string | null {
  return account.subscriptionId?.startsWith('sub_') ? account.subscriptionId : null;
}

export const DELETE = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { reason?: string };
  const reason = readReason(body);
  if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });

  const account = await readEndingAccount(id);
  if (!account) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  const pending = await readPendingEnding(id);

  const changeFailed = await writeAuditBeforeChange(
    auth.user.email!, id, 'keep_subscription', 'subscription_status', 'ends_at_renewal',
    { status: account.subscriptionStatus, endsAt: pending?.effectiveAt ?? null }, { reason },
  );
  try {
    const result = await keepEnding(account, { door: 'operator', userId: null, email: auth.user.email ?? null }, endingDeps);
    if (result.outcome !== 'kept') {
      const error = result.outcome === 'nothing' ? W.cancel.nothingToKeep : result.error;
      await changeFailed(error);
      return NextResponse.json({ error }, { status: result.outcome === 'nothing' ? 409 : result.status });
    }
    return NextResponse.json({
      ok: true, renewsOn: result.renewsOn, renewsAs: result.renewsAs,
      ...(result.movePlan && result.moveNotRestored ? { notice: W.cancel.moveNotRestored(PLAN_CONFIG[result.movePlan].label) } : {}),
    });
  } catch (error) {
    await changeFailed(error);
    return captureAndJson(error, { error: error instanceof Error ? error.message : 'The plan could not be kept.' }, 500);
  }
}, { route: '/api/platform-admin/orgs/[id]/cancel-subscription' });
